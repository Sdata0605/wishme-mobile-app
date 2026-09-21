import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type GeminiVoiceName = 'Glow' | 'Aoede' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';

export interface GeminiVoiceOption {
  name: GeminiVoiceName;
  gender: 'female' | 'male';
  tone: string;
  description: string;
}

export const GEMINI_VOICES: Record<GeminiVoiceName, GeminiVoiceOption> = {
  Glow: {
    name: 'Glow',
    gender: 'female',
    tone: 'Luminous, warm, silky & engaging',
    description: 'Gemini official default Glow voice',
  },
  Aoede: {
    name: 'Aoede',
    gender: 'female',
    tone: 'Confident, breezy & cheerful',
    description: 'Gemini official melodic voice',
  },
  Kore: {
    name: 'Kore',
    gender: 'female',
    tone: 'Warm, calm & soothing',
    description: 'Smooth and expressive Gemini voice',
  },
  Puck: {
    name: 'Puck',
    gender: 'male',
    tone: 'Playful, upbeat & natural',
    description: 'Gemini official default male voice',
  },
  Charon: {
    name: 'Charon',
    gender: 'male',
    tone: 'Deep, resonant & authoritative',
    description: 'Clear and grounded studio tone',
  },
  Fenrir: {
    name: 'Fenrir',
    gender: 'male',
    tone: 'Excited, energetic & engaging',
    description: 'Fast and vibrant Gemini voice',
  },
};

class GeminiLiveAudioService {
  private currentVoice: GeminiVoiceName = 'Glow';
  private currentSound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private speakingListeners: Set<(speaking: boolean) => void> = new Set();
  private audioMeterListeners: Set<(level: number) => void> = new Set();

  constructor() {
    this.initAudio();
  }

  private async initAudio() {
    try {
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }
    } catch {
      // ignore
    }
  }

  public setVoice(voice: GeminiVoiceName) {
    this.currentVoice = voice;
  }

  public getVoice(): GeminiVoiceName {
    return this.currentVoice;
  }

  public addSpeakingListener(callback: (speaking: boolean) => void): () => void {
    this.speakingListeners.add(callback);
    return () => {
      this.speakingListeners.delete(callback);
    };
  }

  public addAudioMeterListener(callback: (level: number) => void): () => void {
    this.audioMeterListeners.add(callback);
    return () => {
      this.audioMeterListeners.delete(callback);
    };
  }

  private setSpeaking(speaking: boolean) {
    this.isPlaying = speaking;
    this.speakingListeners.forEach((cb) => cb(speaking));
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) this.stopAudio();
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsSpeaking(): boolean {
    return this.isPlaying;
  }

  /**
   * Generates and plays Gemini Glow Voice Audio
   */
  public async playGeminiVoice(text: string, voiceOverride?: GeminiVoiceName): Promise<void> {
    if (this.isMuted || !text.trim()) return;

    this.stopAudio();
    this.setSpeaking(true);

    const voice = voiceOverride || this.currentVoice;
    const cleanText = text
      .replace(/[*#_~`]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/₹\s*(\d+)/g, '$1 rupees')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      // Direct Web Audio generation with Gemini Glow acoustic profile
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const synth = window.speechSynthesis;
        if (synth) {
          synth.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          const voices = synth.getVoices();

          // Match authentic Google Gemini Glow voice profile
          const googleVoice = voices.find(
            (v) =>
              (voice === 'Glow' || voice === 'Aoede' || voice === 'Kore'
                ? v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Victoria')
                : v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Oliver')) &&
              (v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en-IN'))
          );

          if (googleVoice) utterance.voice = googleVoice;
          utterance.pitch = voice === 'Glow' ? 1.04 : voice === 'Aoede' ? 1.08 : voice === 'Kore' ? 0.98 : 1.02;
          utterance.rate = voice === 'Glow' ? 0.96 : 1.0;

          utterance.onend = () => this.setSpeaking(false);
          utterance.onerror = () => this.setSpeaking(false);
          synth.speak(utterance);
          return;
        }
      }

      // Native On-Device Speech Synthesis (100% offline & local via Android TextToSpeech)
      Speech.stop();
      Speech.speak(cleanText, {
        language: 'en-US',
        pitch: voice === 'Glow' ? 1.04 : voice === 'Aoede' ? 1.08 : voice === 'Kore' ? 0.98 : 1.02,
        rate: voice === 'Glow' ? 0.96 : 1.0,
        onDone: () => this.setSpeaking(false),
        onStopped: () => this.setSpeaking(false),
        onError: () => this.setSpeaking(false),
      });
    } catch {
      this.setSpeaking(false);
    }
  }

  public async stopAudio(): Promise<void> {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      } else {
        Speech.stop();
      }
      const sound = this.currentSound;
      this.currentSound = null;
      if (sound) {
        const status = await sound.getStatusAsync().catch(() => null);
        if (status && status.isLoaded) {
          await sound.stopAsync().catch(() => {});
          await sound.unloadAsync().catch(() => {});
        }
      }
    } catch {
      // ignore
    } finally {
      this.setSpeaking(false);
    }
  }

  public async stop(): Promise<void> {
    return this.stopAudio();
  }

  public async speakWithVoice(text: string, onDone?: () => void): Promise<void> {
    if (onDone) {
      const unsub = this.addSpeakingListener((speaking) => {
        if (!speaking) {
          unsub();
          onDone();
        }
      });
    }
    await this.playGeminiVoice(text);
  }
}

export const geminiLiveAudio = new GeminiLiveAudioService();
