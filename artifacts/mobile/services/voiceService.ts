import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type VoicePersona = 'nova' | 'alloy' | 'aura' | 'echo';

export interface VoicePreset {
  id: VoicePersona;
  name: string;
  description: string;
  language: string;
  pitch: number;
  rate: number;
  preferredVoiceName?: string;
}

export const VOICE_PRESETS: Record<VoicePersona, VoicePreset> = {
  nova: {
    id: 'nova',
    name: 'Gemini Nova',
    description: 'Warm, natural & friendly',
    language: 'en-US',
    pitch: 1.02,
    rate: 0.95,
  },
  alloy: {
    id: 'alloy',
    name: 'Gemini Alloy',
    description: 'Crisp, modern & confident',
    language: 'en-IN',
    pitch: 1.0,
    rate: 0.98,
  },
  aura: {
    id: 'aura',
    name: 'Gemini Aura',
    description: 'Gentle, clear & soothing',
    language: 'en-US',
    pitch: 1.08,
    rate: 0.92,
  },
  echo: {
    id: 'echo',
    name: 'Gemini Echo',
    description: 'Deep, calm & balanced',
    language: 'en-GB',
    pitch: 0.94,
    rate: 0.95,
  },
};

class VoiceService {
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private currentPersona: VoicePersona = 'nova';
  private speakingListeners: Set<(speaking: boolean) => void> = new Set();
  private audioMeterListeners: Set<(meterLevel: number) => void> = new Set();
  private recording: Audio.Recording | null = null;
  private isRecording: boolean = false;
  private availableVoices: Speech.Voice[] = [];

  constructor() {
    this.isMuted = false;
    this.initVoices();
  }

  private async initVoices() {
    try {
      if (Platform.OS !== 'web') {
        this.availableVoices = await Speech.getAvailableVoicesAsync();
      }
    } catch {
      // fallback
    }
  }

  public setVoicePersona(persona: VoicePersona) {
    this.currentPersona = persona;
  }

  public getVoicePersona(): VoicePersona {
    return this.currentPersona;
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
    this.isSpeaking = speaking;
    this.speakingListeners.forEach((cb) => cb(speaking));
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public async speak(text: string): Promise<void> {
    if (this.isMuted || !text.trim()) return;

    try {
      this.stop();
      this.setSpeaking(true);

      const preset = VOICE_PRESETS[this.currentPersona] || VOICE_PRESETS.nova;

      // Clean markdown, emojis, asterisks, URLs and currency symbols for smooth speech
      const cleanText = text
        .replace(/[*#_~`]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/₹\s*(\d+)/g, '$1 rupees')
        .replace(/[\u{1F600}-\u{1F6FF}|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        this.setSpeaking(false);
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = preset.rate;
        utterance.pitch = preset.pitch;
        utterance.lang = preset.language;

        // Try selecting best web voice
        const webVoices = window.speechSynthesis.getVoices();
        const matched = webVoices.find((v) => v.lang.startsWith(preset.language.slice(0, 2)) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
        if (matched) utterance.voice = matched;

        utterance.onend = () => this.setSpeaking(false);
        utterance.onerror = () => this.setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        // Native device speech synthesis
        const matchedVoice = this.availableVoices.find(
          (v) => v.language.startsWith(preset.language.slice(0, 2)) && (v.quality === Speech.VoiceQuality.Enhanced || v.name.toLowerCase().includes('natural'))
        );

        Speech.speak(cleanText, {
          language: preset.language,
          pitch: preset.pitch,
          rate: preset.rate,
          voice: matchedVoice?.identifier,
          onDone: () => this.setSpeaking(false),
          onStopped: () => this.setSpeaking(false),
          onError: () => this.setSpeaking(false),
        });
      }
    } catch {
      this.setSpeaking(false);
    }
  }

  public stop(): void {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      } else {
        Speech.stop();
      }
    } catch {
      // ignore
    } finally {
      this.setSpeaking(false);
    }
  }

  // ─── Real Audio Recording on Native Devices ────────────────────────────────
  public async startAudioRecording(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') return true;

      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') return false;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.metering !== undefined) {
            // Map -160dB ... 0dB to 0 ... 1
            const normalized = Math.max(0, (status.metering + 60) / 60);
            this.audioMeterListeners.forEach((cb) => cb(normalized));
          }
        },
        100
      );

      this.recording = recording;
      this.isRecording = true;
      return true;
    } catch {
      this.isRecording = false;
      return false;
    }
  }

  public async stopAudioRecording(): Promise<string | null> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        const uri = this.recording.getURI();
        this.recording = null;
        this.isRecording = false;
        return uri;
      }
    } catch {
      this.recording = null;
      this.isRecording = false;
    }
    return null;
  }
}

export const voiceService = new VoiceService();
