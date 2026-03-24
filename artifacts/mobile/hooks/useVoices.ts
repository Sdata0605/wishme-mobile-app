import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';

export interface VoiceItem {
  voice_id: string;
  name: string;
  category: string;
  preview_url?: string;
}

export interface VoiceList {
  premadeVoices: VoiceItem[];
  clonedVoices: VoiceItem[];
}

export function useVoices() {
  const { session } = useAuth();
  const [voices, setVoices] = useState<VoiceList>({ premadeVoices: [], clonedVoices: [] });
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await supabaseFetch(
        '/functions/v1/get-user-voices',
        { method: 'POST', body: JSON.stringify({}) },
        session.access_token,
      );
      if (res.ok) {
        const data = await res.json() as { premadeVoices?: VoiceItem[]; clonedVoices?: VoiceItem[] };
        setVoices({ premadeVoices: data.premadeVoices ?? [], clonedVoices: data.clonedVoices ?? [] });
        setLoading(false);
        return;
      }
    } catch {}
    try {
      const fallback = await supabaseFetch(
        '/functions/v1/elevenlabs-get-user-voices',
        { method: 'POST', body: JSON.stringify({}) },
        session.access_token,
      );
      if (fallback.ok) {
        const data = await fallback.json() as { premadeVoices?: VoiceItem[]; clonedVoices?: VoiceItem[] };
        setVoices({ premadeVoices: data.premadeVoices ?? [], clonedVoices: data.clonedVoices ?? [] });
      }
    } catch {}
    setLoading(false);
  }, [session]);

  return { voices, loading, refetch };
}
