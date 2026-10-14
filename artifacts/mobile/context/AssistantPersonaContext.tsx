/**
 * AssistantPersonaContext — loads and saves the user's assistant persona (name, voice,
 * personality, language) in Supabase, with a local cache so the assistant can connect instantly.
 *
 * status:
 *  - 'loading'     fetching from the database
 *  - 'needs-setup' the database has no row for this user yet -> show the setup screens once
 *  - 'ready'       persona loaded (or the user skipped, so the defaults are saved)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_PERSONA,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  PERSONALITIES,
  LANGUAGES,
  VOICES,
  cleanText,
  type AssistantPersona,
} from '@/services/assistant/persona';

export type PersonaStatus = 'loading' | 'needs-setup' | 'ready';

interface Row {
  assistant_name: string;
  voice: string;
  personality: string;
  custom_note: string | null;
  language: string;
  is_default: boolean;
}

interface PersonaContextValue {
  persona: AssistantPersona;
  status: PersonaStatus;
  /** Saves a customised persona. Resolves to an error message, or null on success. */
  save: (next: Omit<AssistantPersona, 'isDefault'>) => Promise<string | null>;
  /** The user chose to skip setup: remembers that the defaults are in use. */
  skip: () => Promise<void>;
}

const Ctx = createContext<PersonaContextValue | null>(null);

const cacheKey = (userId: string) => `@wishme/assistant-persona:${userId}`;

/** Makes sure whatever came from storage is a valid persona. */
function normalise(raw: Partial<AssistantPersona> | null | undefined): AssistantPersona {
  const base = DEFAULT_PERSONA;
  if (!raw) return base;
  const voice = VOICES.some((v) => v.id === raw.voice) ? (raw.voice as string) : base.voice;
  const personality = PERSONALITIES.some((p) => p.id === raw.personality)
    ? (raw.personality as AssistantPersona['personality'])
    : base.personality;
  const language = LANGUAGES.some((l) => l.id === raw.language)
    ? (raw.language as AssistantPersona['language'])
    : base.language;
  return {
    name: cleanName(raw.name ?? '') || base.name,
    voice,
    personality,
    customNote: cleanText(raw.customNote ?? '', MAX_NOTE_LENGTH),
    language,
    isDefault: !!raw.isDefault,
  };
}

/** Names go into prompts, so keep them to plain text (no quotes or markup). */
export function cleanName(name: string) {
  return cleanText(name.replace(/["'`<>{}\\]/g, ''), MAX_NAME_LENGTH);
}

const fromRow = (r: Row): AssistantPersona =>
  normalise({
    name: r.assistant_name,
    voice: r.voice,
    personality: r.personality as AssistantPersona['personality'],
    customNote: r.custom_note ?? '',
    language: r.language as AssistantPersona['language'],
    isDefault: r.is_default,
  });

export function AssistantPersonaProvider({ children }: { children: React.ReactNode }) {
  const { user, getValidSession } = useAuth();
  const userId = user?.id;

  const [persona, setPersona] = useState<AssistantPersona>(DEFAULT_PERSONA);
  const [status, setStatus] = useState<PersonaStatus>('loading');
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      loadedFor.current = null;
      setPersona(DEFAULT_PERSONA);
      setStatus('loading');
      return;
    }
    if (loadedFor.current === userId) return;
    loadedFor.current = userId;
    let cancelled = false;

    (async () => {
      // 1. Cached copy first, so the assistant can connect with the right voice straight away.
      let cached: AssistantPersona | null = null;
      try {
        const raw = await AsyncStorage.getItem(cacheKey(userId));
        if (raw) cached = normalise(JSON.parse(raw));
      } catch {
        /* ignore a bad cache */
      }
      if (cancelled) return;
      if (cached) {
        setPersona(cached);
        setStatus('ready');
      }

      // 2. The database is the source of truth.
      try {
        const session = await getValidSession();
        if (!session?.access_token) throw new Error('no session');
        const res = await supabaseFetch(
          `/rest/v1/assistant_settings?select=*&user_id=eq.${userId}&limit=1`,
          {},
          session.access_token,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = (await res.json()) as Row[];
        if (cancelled) return;

        if (rows.length) {
          const fresh = fromRow(rows[0]);
          setPersona(fresh);
          setStatus('ready');
          AsyncStorage.setItem(cacheKey(userId), JSON.stringify(fresh)).catch(() => {});
        } else if (!cached) {
          // No row anywhere: this user has never been through setup.
          setPersona(DEFAULT_PERSONA);
          setStatus('needs-setup');
        }
      } catch {
        // Offline or a hiccup: never block the app or nag the user. Use the cache or defaults.
        if (!cancelled && !cached) setStatus('ready');
      }
    })();

    return () => {
      cancelled = true;
      loadedFor.current = null;
    };
  }, [userId, getValidSession]);

  const persist = useCallback(
    async (next: AssistantPersona): Promise<string | null> => {
      if (!userId) return 'Please log in first.';
      // Apply immediately; roll back only matters if the database rejects it.
      setPersona(next);
      setStatus('ready');
      AsyncStorage.setItem(cacheKey(userId), JSON.stringify(next)).catch(() => {});
      try {
        const session = await getValidSession();
        if (!session?.access_token) return 'Your session expired. Please log in again.';
        const res = await supabaseFetch(
          '/rest/v1/assistant_settings?on_conflict=user_id',
          {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
              user_id: userId,
              assistant_name: next.name,
              voice: next.voice,
              personality: next.personality,
              custom_note: next.customNote || null,
              language: next.language,
              is_default: next.isDefault,
              updated_at: new Date().toISOString(),
            }),
          },
          session.access_token,
        );
        if (!res.ok) return 'Could not save your assistant settings. Check your connection and try again.';
        return null;
      } catch {
        return 'Could not save your assistant settings. Check your connection and try again.';
      }
    },
    [userId, getValidSession],
  );

  const save = useCallback(
    (next: Omit<AssistantPersona, 'isDefault'>) =>
      persist(normalise({ ...next, name: cleanName(next.name) || DEFAULT_PERSONA.name, isDefault: false })),
    [persist],
  );

  const skip = useCallback(async () => {
    await persist({ ...DEFAULT_PERSONA, isDefault: true });
  }, [persist]);

  const value = useMemo(() => ({ persona, status, save, skip }), [persona, status, save, skip]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistantPersona(): PersonaContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAssistantPersona must be used within AssistantPersonaProvider');
  return ctx;
}
