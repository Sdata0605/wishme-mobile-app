import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { parseApiError, supabaseFetch } from '@/constants/supabase';

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
  ) => Promise<{ error: string | null }>;
  verifyOtp: (code: string) => Promise<{ error: string | null }>;
  resendOtp: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_SESSION = '@wishme/session';
const STORAGE_USER = '@wishme/user';
const STORAGE_PENDING = '@wishme/pending_signup';

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
    referralCode: (meta.referral_code as string) ?? fallback.referralCode ?? '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pendingRef = useRef<PendingSignup | null>(pendingSignup);
  const internalSignupRef = useRef<InternalSignupData | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => { pendingRef.current = pendingSignup; }, [pendingSignup]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    const restore = async () => {
      try {
        const pairs = await AsyncStorage.multiGet([STORAGE_SESSION, STORAGE_USER, STORAGE_PENDING]);
        const sessionStr = pairs[0][1];
        const userStr = pairs[1][1];
        const pendingStr = pairs[2][1];

        if (userStr) setUser(JSON.parse(userStr));
        if (sessionStr) setSession(JSON.parse(sessionStr));
        if (pendingStr) setPendingSignup(JSON.parse(pendingStr));

        if (!userStr) {
          const oldUser = await AsyncStorage.getItem('user');
          if (oldUser) {
            const parsed = JSON.parse(oldUser) as User;
            setUser(parsed);
            await AsyncStorage.setItem(STORAGE_USER, oldUser);
            await AsyncStorage.removeItem('user');
          }
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ error: string | null; role: 'user' | 'celebrity' | null }> => {
    try {
      const res = await supabaseFetch('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
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
      let u = buildUserFromSupabase(supaUser, { email });

      try {
        const profileRes = await supabaseFetch(
          `/rest/v1/profiles?select=*&user_id=eq.${supaUser.id}&limit=1`,
          {},
          newSession.access_token,
        );
        if (profileRes.ok) {
          const profiles = await profileRes.json() as Array<Record<string, unknown>>;
          if (profiles && profiles.length > 0) {
            const p = profiles[0];
            u = {
              ...u,
              profileId: (p.id as string) ?? '',
              firstName: (p.first_name as string) ?? u.firstName,
              lastName: (p.last_name as string) ?? u.lastName,
              phone: (p.phone as string) ?? u.phone,
              walletBalance: (p.wallet_balance as number) ?? u.walletBalance,
              memberSince: (p.member_since as string) ?? u.memberSince,
              referralCode: (p.referral_code as string) ?? u.referralCode,
            };
          }
        }
      } catch {}

      try {
        const celebRes = await supabaseFetch(
          `/rest/v1/celebrities?select=id,status&user_id=eq.${supaUser.id}&limit=1`,
          {},
          newSession.access_token,
        );
        if (celebRes.ok) {
          const celebs = await celebRes.json() as Array<{ id: string; status: string }>;
          if (celebs && celebs.length > 0 && celebs[0].status === 'approved') {
            u = { ...u, role: 'celebrity' };
          }
        }
      } catch {}

      setSession(newSession);
      setUser(u);
      await AsyncStorage.multiSet([
        [STORAGE_SESSION, JSON.stringify(newSession)],
        [STORAGE_USER, JSON.stringify(u)],
      ]);
      return { error: null, role: u.role };
    } catch {
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
  ): Promise<{ error: string | null }> => {
    try {
      const pending: PendingSignup = { email, firstName, lastName, phone, referral };
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

      const referralCode = (internal.firstName.toUpperCase() + '2025').slice(0, 10);
      const supaUser = (signupData.user ?? signupData) as Record<string, unknown>;
      const u = buildUserFromSupabase(supaUser, {
        firstName: internal.firstName,
        lastName: internal.lastName,
        email: internal.email,
        phone: internal.phone,
        referralCode,
        walletBalance: 0,
        memberSince: new Date().toISOString().split('T')[0],
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
        forgotPasswordByEmail,
        forgotPasswordByPhone,
        applyCelebrity,
        checkCelebrityStatus,
        sendCelebOtp,
        applyCelebrityWithAuth,
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
