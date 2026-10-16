import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { parseApiError, supabaseFetch } from '@/constants/supabase';

/** How the user wants to be addressed: 'male' is sir, 'female' is ma'am, 'other' is no title. Unknown until they say. */
export type Gender = 'male' | 'female' | 'other';

export interface User {
  id: string;
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'user' | 'celebrity';
  walletBalance: number;
  memberSince: string;
  referralCode: string;
  gender?: Gender;
}

export interface Session {
  access_token: string;
  refresh_token: string;
}

export interface PendingSignup {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  referral?: string;
  gender?: Gender;
}

interface InternalSignupData extends PendingSignup {
  password: string;
}

export interface CelebrityApplyData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  stage_name: string;
  category: string;
  bio: string;
  achievements: string;
  instagram: string;
  youtube: string;
  twitter: string;
  portfolio: string;
}

export interface CelebrityFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  stage_name: string;
  category: string;
  bio: string;
  achievements: string;
  portfolio_link: string | null;
  social_media: {
    instagram: string;
    youtube: string;
    twitter: string;
    tiktok: string;
    facebook: string;
    linkedin: string;
    website: string;
    other: string;
  };
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  pendingSignup: PendingSignup | null;
  login: (email: string, password: string) => Promise<{ error: string | null; role: 'user' | 'celebrity' | null }>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone: string,
    referral?: string,
    gender?: Gender,
  ) => Promise<{ error: string | null }>;
  verifyOtp: (code: string) => Promise<{ error: string | null }>;
  resendOtp: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  /** Saves how the user wants to be addressed, on the phone at once and on their account in the background. */
  setGender: (gender: Gender) => void;
  forgotPasswordByEmail: (email: string) => Promise<{ error: string | null }>;
  forgotPasswordByPhone: (phone: string) => Promise<{ error: string | null }>;
  applyCelebrity: (data: CelebrityApplyData) => Promise<{ error: string | null }>;
  checkCelebrityStatus: (email: string) => Promise<{ status: string | null; error: string | null }>;
  sendCelebOtp: (email: string) => Promise<{ error: string | null }>;
  applyCelebrityWithAuth: (
    data: CelebrityFormData,
    password: string,
    otp: string,
  ) => Promise<{ error: string | null }>;
  getValidSession: () => Promise<Session | null>;
  /**
   * Asks the server whether this login still stands (its functions check it more strictly than the data API does).
   * If it was ended, e.g. by signing in on another device, and a new token cannot be had, signs out. Returns false then.
   */
  verifySession: () => Promise<boolean>;
  /** Set (to the time) when the app signed the user out because the server ended their login. */
  sessionEndedAt: number | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_SESSION = '@wishme/session';
const STORAGE_USER = '@wishme/user';
const STORAGE_PENDING = '@wishme/pending_signup';

const PROFILE_COLUMNS = 'id,first_name,last_name,phone,role,wallet_balance,referral_code';

/** Pure-JS base64 character set used as fallback decoder. */
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decode a base64url string to a binary string without relying on atob or Buffer. */
function decodeBase64Url(base64url: string): string {
  // Convert base64url to standard base64 and pad to multiple of 4
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';

  // Use atob if available (Hermes on modern RN)
  try {
    if (typeof atob === 'function') return atob(base64);
  } catch {}

  // Pure-JS fallback — works in any JS environment
  try {
    let result = '';
    let buf = 0;
    let bits = 0;
    for (let i = 0; i < base64.length; i++) {
      const ch = base64[i];
      if (ch === '=') break;
      const idx = BASE64_CHARS.indexOf(ch);
      if (idx === -1) continue;
      buf = (buf << 6) | idx;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        result += String.fromCharCode((buf >> bits) & 0xff);
      }
    }
    return result;
  } catch {
    return '';
  }
}

/** Decode exp claim from a Supabase JWT. Returns ms timestamp or 0 on error. */
function getTokenExpiry(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return 0;
    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) return 0;
    const payload = JSON.parse(decoded) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** True if the token is expired or will expire within 5 minutes. */
function isTokenStale(token: string): boolean {
  const exp = getTokenExpiry(token);
  return exp === 0 || Date.now() > exp - 5 * 60 * 1000;
}

function asGender(v: unknown): Gender | undefined {
  return v === 'male' || v === 'female' || v === 'other' ? v : undefined;
}

function buildUserFromSupabase(supaUser: Record<string, unknown>, fallback: Partial<User> = {}): User {
  const meta = (supaUser.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: (supaUser.id as string) ?? fallback.id ?? 'usr_' + Date.now(),
    profileId: fallback.profileId ?? '',
    firstName: (meta.first_name as string) ?? (meta.firstName as string) ?? fallback.firstName ?? '',
    lastName: (meta.last_name as string) ?? (meta.lastName as string) ?? fallback.lastName ?? '',
    email: (supaUser.email as string) ?? fallback.email ?? '',
    phone: (meta.phone as string) ?? fallback.phone ?? '',
    role: ((meta.role as string) === 'celebrity' ? 'celebrity' : 'user'),
    walletBalance: (meta.wallet_balance as number) ?? fallback.walletBalance ?? 0,
    memberSince:
      (meta.member_since as string) ??
      fallback.memberSince ??
      new Date().toISOString().split('T')[0],
    // meta.referral_code is the code the user signed up WITH (their referrer's), never their own.
    referralCode: fallback.referralCode ?? '',
    gender: asGender(meta.gender) ?? fallback.gender,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionEndedAt, setSessionEndedAt] = useState<number | null>(null);

  const pendingRef = useRef<PendingSignup | null>(pendingSignup);
  const internalSignupRef = useRef<InternalSignupData | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => { pendingRef.current = pendingSignup; }, [pendingSignup]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Single-flight: Supabase rotates refresh tokens, so two overlapping refreshes would make the
  // second one fail and (wrongly) look like a revoked session.
  const refreshInFlight = useRef<Promise<Session | null> | null>(null);

  /** Resolves to the new session, `null` if the server rejected the refresh token, or `'offline'`. */
  const doRefresh = useCallback(async (
    currentSession: Session,
  ): Promise<Session | null | 'offline'> => {
    try {
      const res = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
      });
      if (!res.ok) return res.status >= 500 ? 'offline' : null;
      const data = await res.json() as Record<string, unknown>;
      if (!data.access_token) return null;
      const newSession: Session = {
        access_token: data.access_token as string,
        refresh_token: (data.refresh_token as string) ?? currentSession.refresh_token,
      };
      setSession(newSession);
      sessionRef.current = newSession;
      await AsyncStorage.setItem(STORAGE_SESSION, JSON.stringify(newSession));
      return newSession;
    } catch {
      return 'offline';
    }
  }, []);

  const refreshSession = useCallback((currentSession: Session): Promise<Session | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = doRefresh(currentSession)
        .then((r) => (r === 'offline' ? null : r))
        .finally(() => { refreshInFlight.current = null; });
    }
    return refreshInFlight.current;
  }, [doRefresh]);

  useEffect(() => {
    // The app opens straight from what is stored on the phone. A stale token is renewed in the
    // background — never in front of the user — and only a refusal from the server signs them out
    // (being offline must not).
    const restore = async () => {
      let toRefresh: { session: Session; user: User } | null = null;
      try {
        const pairs = await AsyncStorage.multiGet([STORAGE_SESSION, STORAGE_USER, STORAGE_PENDING]);
        const sessionStr = pairs[0][1];
        const userStr    = pairs[1][1];
        const pendingStr = pairs[2][1];

        if (pendingStr) setPendingSignup(JSON.parse(pendingStr));

        if (userStr && sessionStr) {
          const storedSession = JSON.parse(sessionStr) as Session;
          const storedUser    = JSON.parse(userStr) as User;
          setSession(storedSession);
          sessionRef.current = storedSession;
          setUser(storedUser);
          if (isTokenStale(storedSession.access_token)) toRefresh = { session: storedSession, user: storedUser };
        } else if (userStr && !sessionStr) {
          // Legacy: had user but no session — clear both
          await AsyncStorage.removeItem(STORAGE_USER);
        }

        // Legacy key migration
        if (!userStr) {
          const oldUser = await AsyncStorage.getItem('user');
          if (oldUser) {
            await AsyncStorage.setItem(STORAGE_USER, oldUser);
            await AsyncStorage.removeItem('user');
            // Still need session to be useful — skip hydration without it
          }
        }
      } catch {
        // Don't block the app if restore fails
      } finally {
        setIsLoading(false);
      }

      if (!toRefresh) return;
      const { session: stored, user: storedUser } = toRefresh;
      const refreshed = await doRefresh(stored);
      if (refreshed === 'offline') return;
      if (!refreshed) {
        setUser(null);
        setSession(null);
        sessionRef.current = null;
        await AsyncStorage.multiRemove([STORAGE_SESSION, STORAGE_USER]);
        return;
      }
      // Pick up anything that changed while the app was closed (wallet balance, role...).
      try {
        const profileRes = await supabaseFetch(
          `/rest/v1/profiles?select=${PROFILE_COLUMNS}&user_id=eq.${storedUser.id}&limit=1`,
          {},
          refreshed.access_token,
        );
        if (!profileRes.ok) return;
        const rows = await profileRes.json() as Array<Record<string, unknown>>;
        if (!rows?.length) return;
        const p = rows[0];
        const freshUser: User = {
          ...storedUser,
          profileId: (p.id as string) ?? storedUser.profileId,
          firstName: (p.first_name as string) ?? storedUser.firstName,
          lastName:  (p.last_name  as string) ?? storedUser.lastName,
          phone:     (p.phone      as string) ?? storedUser.phone,
          role: ((p.role as string) === 'celebrity' ? 'celebrity' : storedUser.role),
          walletBalance: (p.wallet_balance as number) ?? storedUser.walletBalance,
          memberSince:   (p.member_since as string)   ?? storedUser.memberSince,
          referralCode:  (p.referral_code as string)  ?? storedUser.referralCode,
        };
        setUser(freshUser);
        await AsyncStorage.setItem(STORAGE_USER, JSON.stringify(freshUser));
      } catch {}
    };
    restore();
  }, [doRefresh]);

  // Keep `session.access_token` fresh while the app is open. The token lives about an hour, and
  // most screens read it straight from state; renewing only at launch meant any screen opened after
  // that sent an expired token and the server answered "Unauthorized" (Image Promotions, the voice
  // service, ...). Checked every minute and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!session?.access_token) return;
    const renewIfStale = () => {
      const current = sessionRef.current;
      if (current?.access_token && isTokenStale(current.access_token)) void refreshSession(current);
    };
    renewIfStale();
    const timer = setInterval(renewIfStale, 60_000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') renewIfStale(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [session?.access_token, refreshSession]);

  const verifySession = useCallback(async (): Promise<boolean> => {
    const current = sessionRef.current;
    if (!current?.access_token) return false;
    try {
      const res = await supabaseFetch('/auth/v1/user', {}, current.access_token);
      if (res.ok) return true;
      // Anything but a refusal of the login itself (a busy server, say) is not a reason to sign anyone out.
      if (res.status !== 401 && res.status !== 403) return true;
    } catch {
      return true; // offline
    }
    // The server refused this token: try for a new one, and only if that is refused too is the login over.
    const renewed = refreshInFlight.current ? await refreshInFlight.current : await doRefresh(current);
    if (renewed === 'offline' || renewed) return true;
    setUser(null);
    setSession(null);
    sessionRef.current = null;
    await AsyncStorage.multiRemove([STORAGE_SESSION, STORAGE_USER]);
    setSessionEndedAt(Date.now());
    return false;
  }, [doRefresh]);

  const getValidSession = useCallback(async (): Promise<Session | null> => {
    const current = sessionRef.current;
    if (!current?.access_token) return null;
    if (!isTokenStale(current.access_token)) return current;
    const refreshed = await refreshSession(current);
    return refreshed;
  }, [refreshSession]);

  const login = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ error: string | null; role: 'user' | 'celebrity' | null }> => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await supabaseFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        const friendly = msg.toLowerCase().includes('invalid')
          ? 'Incorrect email or password. Please try again.'
          : msg;
        return { error: friendly, role: null };
      }
      const data = await res.json() as Record<string, unknown>;
      const newSession: Session = {
        access_token: data.access_token as string,
        refresh_token: data.refresh_token as string,
      };
      const supaUser = data.user as Record<string, unknown>;
      let u = buildUserFromSupabase(supaUser, { email: normalizedEmail });

      // One request for the profile AND the celebrity check (celebrities(id) is an embedded join).
      const profileRes = await supabaseFetch(
        `/rest/v1/profiles?select=${PROFILE_COLUMNS},celebrities(id)&user_id=eq.${supaUser.id}&limit=1`,
        {},
        newSession.access_token,
      );
      if (!profileRes.ok) {
        console.error('[AUTH] Profile fetch failed:', profileRes.status);
        return { error: 'Unable to load account profile. Please try again.', role: null };
      }
      const profiles = await profileRes.json() as Array<Record<string, unknown>>;
      if (!profiles || profiles.length === 0) {
        console.error('[AUTH] No profile row found for user_id:', supaUser.id);
        return { error: 'Account profile not found. Please contact support.', role: null };
      }
      const p = profiles[0];
      const celebs = p.celebrities as Array<{ id: string }> | null | undefined;
      u = {
        ...u,
        profileId: (p.id as string) ?? '',
        firstName: (p.first_name as string) ?? u.firstName,
        lastName: (p.last_name as string) ?? u.lastName,
        phone: (p.phone as string) ?? u.phone,
        role: ((p.role as string) === 'celebrity' || (celebs && celebs.length > 0)) ? 'celebrity' : 'user',
        walletBalance: (p.wallet_balance as number) ?? u.walletBalance,
        memberSince: (p.member_since as string) ?? u.memberSince,
        referralCode: (p.referral_code as string) ?? u.referralCode,
      };

      setSession(newSession);
      sessionRef.current = newSession;
      setUser(u);
      // Persist without making the user wait for the disk.
      void AsyncStorage.multiSet([
        [STORAGE_SESSION, JSON.stringify(newSession)],
        [STORAGE_USER, JSON.stringify(u)],
      ]);
      return { error: null, role: u.role };
    } catch (ex) {
      console.error('[AUTH] Login exception:', ex);
      return { error: 'Network error. Please check your connection.', role: null };
    }
  }, []);

  const signup = useCallback(async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    phone: string,
    referral?: string,
    gender?: Gender,
  ): Promise<{ error: string | null }> => {
    try {
      const pending: PendingSignup = { email, firstName, lastName, phone, referral, gender };
      const internal: InternalSignupData = { ...pending, password };
      setPendingSignup(pending);
      pendingRef.current = pending;
      internalSignupRef.current = internal;
      await AsyncStorage.setItem(STORAGE_PENDING, JSON.stringify(pending));

      const res = await supabaseFetch('/functions/v1/send-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          return { error: 'An account with this email already exists. Please sign in instead.' };
        }
        if (res.status === 429) {
          let retryAfter = 60;
          try {
            const body = await res.json() as Record<string, unknown>;
            retryAfter = (body.retryAfter ?? body.retry_after ?? 60) as number;
          } catch {}
          return { error: `Too many attempts. Please wait ${retryAfter} seconds before trying again.` };
        }
        if (res.status === 400) {
          return { error: 'Please enter a valid email address.' };
        }
        const msg = await parseApiError(res);
        return { error: msg };
      }
      return { error: null };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const verifyOtp = useCallback(async (code: string): Promise<{ error: string | null }> => {
    const internal = internalSignupRef.current;
    const pending = pendingRef.current;
    if (!internal || !pending) {
      return { error: 'Registration session expired. Please start sign-up again.' };
    }
    if (!internal.password) {
      return { error: 'Registration session expired. Please start sign-up again.' };
    }
    try {
      const verifyRes = await supabaseFetch('/functions/v1/verify-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email: internal.email, otp: code }),
      });
      if (!verifyRes.ok) {
        const msg = await parseApiError(verifyRes);
        const lower = msg.toLowerCase();
        if (lower.includes('expir')) return { error: 'This code has expired. Please request a new one.' };
        if (lower.includes('invalid') || lower.includes('incorrect') || lower.includes('wrong'))
          return { error: 'Invalid code. Please check your email and try again.' };
        if (lower.includes('used') || lower.includes('already'))
          return { error: 'This code has already been used. Please request a new one.' };
        return { error: msg };
      }

      const signupRes = await supabaseFetch('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: internal.email,
          password: internal.password,
          data: {
            first_name: internal.firstName,
            last_name: internal.lastName,
            phone: internal.phone,
            referral_code: internal.referral ?? '',
            gender: internal.gender ?? null,
            role: 'user',
            wallet_balance: 0,
            member_since: new Date().toISOString().split('T')[0],
          },
        }),
      });
      if (!signupRes.ok) {
        const msg = await parseApiError(signupRes);
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists'))
          return { error: 'An account with this email already exists. Please sign in instead.' };
        return { error: msg };
      }
      const signupData = await signupRes.json() as Record<string, unknown>;

      let newSession: Session = { access_token: '', refresh_token: '' };
      if (signupData.access_token) {
        newSession = {
          access_token: signupData.access_token as string,
          refresh_token: (signupData.refresh_token as string) ?? '',
        };
      } else {
        const loginRes = await supabaseFetch('/auth/v1/token?grant_type=password', {
          method: 'POST',
          body: JSON.stringify({ email: internal.email, password: internal.password }),
        });
        if (!loginRes.ok) {
          return {
            error:
              'Account created but sign-in failed. Please return to Sign In and use your credentials.',
          };
        }
        const ld = await loginRes.json() as Record<string, unknown>;
        newSession = {
          access_token: ld.access_token as string,
          refresh_token: (ld.refresh_token as string) ?? '',
        };
      }

      // The real code is created by the database; it is read from the profile just below.
      const referralCode = '';
      const supaUser = (signupData.user ?? signupData) as Record<string, unknown>;
      const u = buildUserFromSupabase(supaUser, {
        firstName: internal.firstName,
        lastName: internal.lastName,
        email: internal.email,
        phone: internal.phone,
        referralCode,
        walletBalance: 0,
        memberSince: new Date().toISOString().split('T')[0],
        gender: internal.gender,
      });

      setSession(newSession);
      setUser(u);
      setPendingSignup(null);
      pendingRef.current = null;
      internalSignupRef.current = null;

      await AsyncStorage.multiSet([
        [STORAGE_SESSION, JSON.stringify(newSession)],
        [STORAGE_USER, JSON.stringify(u)],
      ]);
      await AsyncStorage.removeItem(STORAGE_PENDING);

      // Fetch profileId after signup (profile created by DB trigger, may take a moment)
      ;(async () => {
        const fetchProfileId = async (token: string): Promise<void> => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const res = await supabaseFetch(
                `/rest/v1/profiles?select=id,wallet_balance,referral_code&user_id=eq.${supaUser.id}&limit=1`,
                {},
                token,
              );
              if (res.ok) {
                const rows = await res.json() as Array<Record<string, unknown>>;
                if (rows?.length > 0) {
                  const profileId = rows[0].id as string;
                  const referralCodeFromDb = (rows[0].referral_code as string) ?? u.referralCode;
                  const walletBalance = (rows[0].wallet_balance as number) ?? 0;
                  setUser(prev => {
                    if (!prev) return prev;
                    const updated = { ...prev, profileId, referralCode: referralCodeFromDb, walletBalance };
                    AsyncStorage.setItem(STORAGE_USER, JSON.stringify(updated));
                    return updated;
                  });
                  return;
                }
              }
            } catch {}
            // Wait 1.5s between retries (DB trigger may be slow)
            await new Promise(r => setTimeout(r, 1500));
          }
        };
        await fetchProfileId(newSession.access_token);
      })();

      const formattedPhone = internal.phone.startsWith('+91')
        ? internal.phone
        : `+91${internal.phone.replace(/^91/, '')}`;
      supabaseFetch(
        '/functions/v1/send-whatsapp-welcome',
        { method: 'POST', body: JSON.stringify({ phone: formattedPhone, name: internal.firstName }) },
        newSession.access_token || null,
      ).catch(() => {});
      supabaseFetch(
        '/functions/v1/trigger-message-event',
        {
          method: 'POST',
          body: JSON.stringify({ event: 'signup_complete', user_id: u.id, email: u.email }),
        },
        newSession.access_token || null,
      ).catch(() => {});

      return { error: null };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const resendOtp = useCallback(async (): Promise<{ error: string | null }> => {
    const pending = pendingRef.current;
    if (!pending) return { error: 'Session expired. Please start registration again.' };
    try {
      const res = await supabaseFetch('/functions/v1/send-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email: pending.email }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        return { error: msg };
      }
      return { error: null };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const tok = sessionRef.current?.access_token;
      if (tok) {
        await supabaseFetch('/auth/v1/logout', { method: 'POST' }, tok);
      }
    } catch {}
    setUser(null);
    setSession(null);
    setPendingSignup(null);
    sessionRef.current = null;
    pendingRef.current = null;
    internalSignupRef.current = null;
    await AsyncStorage.multiRemove([STORAGE_SESSION, STORAGE_USER, STORAGE_PENDING, 'user']);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_USER, JSON.stringify(next));
      return next;
    });
  }, []);

  const setGender = useCallback((gender: Gender) => {
    updateUser({ gender });
    // Keep it on the account too (auth user metadata, so no database change is needed). Best effort: the phone copy is what counts.
    void (async () => {
      try {
        const token = (await getValidSession())?.access_token;
        if (!token) return;
        await supabaseFetch('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ data: { gender } }) }, token);
      } catch {
        // offline: it syncs the next time the user picks
      }
    })();
  }, [updateUser, getValidSession]);

  const forgotPasswordByEmail = useCallback(async (email: string): Promise<{ error: string | null }> => {
    try {
      const res = await supabaseFetch('/auth/v1/recover', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        return { error: msg };
      }
      return { error: null };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const forgotPasswordByPhone = useCallback(async (phone: string): Promise<{ error: string | null }> => {
    try {
      const cleaned = phone.replace(/[\s\-]/g, '');
      const tenDigit = cleaned.replace(/^(\+91|91)/, '').slice(-10);
      const normalized = `+91${tenDigit}`;
      const lookupPhones = [normalized, tenDigit, `91${tenDigit}`];

      let foundEmail: string | null = null;
      for (const ph of lookupPhones) {
        const res = await supabaseFetch(
          `/rest/v1/profiles?select=email&phone=eq.${encodeURIComponent(ph)}&limit=1`,
        );
        if (res.ok) {
          const rows = await res.json() as Array<{ email: string }>;
          if (rows && rows.length > 0) { foundEmail = rows[0].email; break; }
        }
      }
      if (!foundEmail) {
        return { error: 'No account found with this mobile number.' };
      }
      const email = foundEmail;

      const recoverRes = await supabaseFetch('/auth/v1/recover', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!recoverRes.ok) {
        const msg = await parseApiError(recoverRes);
        return { error: msg };
      }
      return { error: null };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const applyCelebrity = useCallback(async (data: CelebrityApplyData): Promise<{ error: string | null }> => {
    try {
      const res = await supabaseFetch(
        '/rest/v1/celebrity_applications',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify(data),
        },
        null,
      );
      if (res.status === 201 || res.ok) return { error: null };
      const msg = await parseApiError(res);
      return { error: msg };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const sendCelebOtp = useCallback(async (email: string): Promise<{ error: string | null }> => {
    try {
      const res = await supabaseFetch('/functions/v1/send-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          let retryAfter = 60;
          try {
            const body = await res.json() as Record<string, unknown>;
            retryAfter = (body.retryAfter ?? body.retry_after ?? 60) as number;
          } catch {}
          return { error: `Too many attempts. Please wait ${retryAfter} seconds before trying again.` };
        }
        const msg = await parseApiError(res);
        return { error: msg };
      }
      return { error: null };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const applyCelebrityWithAuth = useCallback(async (
    data: CelebrityFormData,
    password: string,
    otp: string,
  ): Promise<{ error: string | null }> => {
    try {
      const verifyRes = await supabaseFetch('/functions/v1/verify-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, otp }),
      });
      if (!verifyRes.ok) {
        const msg = await parseApiError(verifyRes);
        const lower = msg.toLowerCase();
        if (lower.includes('expir')) return { error: 'This code has expired. Please request a new one.' };
        if (lower.includes('invalid') || lower.includes('incorrect') || lower.includes('wrong'))
          return { error: 'Invalid code. Please check your email and try again.' };
        return { error: msg };
      }

      const signupRes = await supabaseFetch('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          password,
          data: {
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
            role: 'celebrity_pending',
            member_since: new Date().toISOString().split('T')[0],
          },
        }),
      });
      if (!signupRes.ok) {
        const msg = await parseApiError(signupRes);
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists'))
          return { error: 'An account with this email already exists. Please sign in instead.' };
        return { error: msg };
      }
      const signupData = await signupRes.json() as Record<string, unknown>;

      let accessToken: string | null = null;
      if (signupData.access_token) {
        accessToken = signupData.access_token as string;
      } else {
        const loginRes = await supabaseFetch('/auth/v1/token?grant_type=password', {
          method: 'POST',
          body: JSON.stringify({ email: data.email, password }),
        });
        if (loginRes.ok) {
          const ld = await loginRes.json() as Record<string, unknown>;
          accessToken = (ld.access_token as string) ?? null;
        }
      }

      const appRes = await supabaseFetch(
        '/rest/v1/celebrity_applications',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify(data),
        },
        accessToken,
      );
      if (appRes.status === 201 || appRes.ok) return { error: null };
      const appMsg = await parseApiError(appRes);
      return { error: appMsg || 'Failed to submit application. Please try again.' };
    } catch {
      return { error: 'Network error. Please check your connection.' };
    }
  }, []);

  const checkCelebrityStatus = useCallback(async (
    email: string,
  ): Promise<{ status: string | null; error: string | null }> => {
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_applications?select=id,status&email=eq.${encodeURIComponent(email)}&limit=1`,
      );
      if (!res.ok) return { status: null, error: null };
      const apps = await res.json() as Array<{ id: string; status: string }>;
      if (!apps || apps.length === 0) return { status: null, error: null };
      return { status: apps[0].status, error: null };
    } catch {
      return { status: null, error: null };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        pendingSignup,
        login,
        signup,
        verifyOtp,
        resendOtp,
        logout,
        updateUser,
        setGender,
        forgotPasswordByEmail,
        forgotPasswordByPhone,
        applyCelebrity,
        checkCelebrityStatus,
        sendCelebOtp,
        applyCelebrityWithAuth,
        getValidSession,
        verifySession,
        sessionEndedAt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
