import { requireOptionalNativeModule } from 'expo';

export interface DeviceVoice {
  name: string;
  /** BCP-47 tag, e.g. "en-IN". */
  language: string;
  /** Android Voice.QUALITY_* (100 very low … 500 very high). */
  quality: number;
  latency: number;
  requiresNetwork: boolean;
  features: string[];
}

export interface SynthesisSpec {
  text: string;
  voiceName?: string;
  language?: string;
  pitch?: number;
  rate?: number;
  /** Absolute path (file:// accepted) of the WAV file to write. */
  path: string;
}

export interface TtsFileNative {
  getVoices(): Promise<DeviceVoice[]>;
  /** Writes the speech to the file and resolves when the engine has finished writing it. */
  synthesize(spec: SynthesisSpec): Promise<boolean>;
}

/** null on iOS and web, and in builds made before this module existed. */
export default requireOptionalNativeModule<TtsFileNative>('TtsFile');
