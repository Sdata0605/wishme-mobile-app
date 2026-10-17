/**
 * Voice search: say what you are looking for and it is typed into the search box as you speak.
 * Uses the phone's own speech recognition (no server, nothing recorded), in Indian English by default.
 */
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

export function useVoiceSearch(onText: (text: string, final: boolean) => void, lang = 'en-IN') {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useSpeechRecognitionEvent('start', () => {
    if (active.current) setListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    active.current = false;
    setListening(false);
  });
  useSpeechRecognitionEvent('result', (e) => {
    if (!active.current) return;
    const text = e.results[0]?.transcript?.trim();
    if (text) onTextRef.current(text, e.isFinal);
  });
  useSpeechRecognitionEvent('error', (e) => {
    if (!active.current) return;
    active.current = false;
    setListening(false);
    // Saying nothing is not worth an error message.
    if (e.error !== 'no-speech' && e.error !== 'aborted' && e.error !== 'speech-timeout') {
      setError(e.error === 'not-allowed' ? 'Allow the microphone to search by voice.' : 'Could not hear that. Try again.');
    }
  });

  const start = useCallback(async () => {
    setError(null);
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Allow the microphone to search by voice.');
        return;
      }
      active.current = true;
      setListening(true);
      ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false });
    } catch {
      active.current = false;
      setListening(false);
      setError('Voice search is not available on this phone.');
    }
  }, [lang]);

  const stop = useCallback(() => {
    if (!active.current) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  return { listening, error, start, stop, toggle: listening ? stop : start };
}
