/**
 * Everything the AI Music Studio tabs have in common: the tab context type, the price list and option lists,
 * the audio file helpers, and the stylesheet. The building blocks live in AudioPlayer, AudioInputs and
 * FormControls beside this file; each studio tab has a file of its own.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, StyleSheet } from 'react-native';
import { type VoiceList } from '@/hooks/useVoices';

export interface MusicCtx {
  voices: VoiceList;
  voicesLoading: boolean;
  walletBalance: number;
  refreshWallet: () => void;
  session: { access_token: string } | null;
  profileId: string;
  onVoiceCloned: () => void;
}

interface MusicResult {
  twoTrack: boolean;
  audioUrl?: string;
  instrumentalUrl?: string;
  vocalsUrl?: string;
}

export const MUSIC_TABS = [
  { label: 'Generate Song', icon: 'sparkles' },
  { label: 'TTS', icon: 'volume-2' },
  { label: 'Voice Conversion', icon: 'mic' },
  { label: 'SFX', icon: 'zap' },
  { label: 'Clone', icon: 'user-plus' },
  { label: 'Isolate', icon: 'file-audio' },
  { label: 'Img+Music', icon: 'image' },
];

export const GENERATE_SONG_GENRES = ['bollywood', 'pop', 'romantic', 'happy', 'lofi', 'classical', 'hip-hop', 'r&b', 'edm', 'folk'];

export const GENERATE_SONG_MOODS = ['happy', 'sad', 'energetic', 'calm', 'romantic', 'epic', 'melancholic', 'uplifting'];

export const SONG_LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi', 'Bengali'];

export const IMG_MUSIC_GENRES = ['ambient', 'pop', 'classical', 'electronic', 'rock', 'r&b'];

export const IMG_MUSIC_MOODS = ['calm', 'happy', 'romantic', 'epic', 'sad', 'energetic'];

export const COSTS = {
  tts: 50,
  voiceConversion: 75,
  sfx: 60,
  audioIsolation: 40,
  instrumental: 100,
  fullSong: 150,
  voiceClone: 150,
  imgInstrumental: 120,
  imgVocals: 150,
};

export const PROGRESS_MESSAGES = [
  'Composing your melody...',
  'Arranging instruments...',
  'Adding rhythm and beat...',
  'Mixing tracks...',
  'Applying AI magic...',
  'Polishing the sound...',
  'Almost there...',
  'Finalizing your song...',
];

export async function saveAudioToCache(dataUri: string): Promise<string> {
  const isMP3 = dataUri.startsWith('data:audio/mpeg');
  const ext = isMP3 ? 'mp3' : 'wav';
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const path = (FileSystem.cacheDirectory ?? '') + `wishme_${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

export async function downloadToDevice(dataUri: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
    const mime = mimeMatch?.[1] ?? 'application/octet-stream';
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('media_library_permission_denied');
  }

  if (dataUri.startsWith('file://')) {
    await MediaLibrary.saveToLibraryAsync(dataUri);
    return;
  }

  if (dataUri.startsWith('http://') || dataUri.startsWith('https://')) {
    const tempPath = (FileSystem.cacheDirectory ?? '') + filename;
    await FileSystem.downloadAsync(dataUri, tempPath);
    await MediaLibrary.saveToLibraryAsync(tempPath);
    return;
  }

  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const tempPath = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(tempPath, base64, { encoding: FileSystem.EncodingType.Base64 });
  await MediaLibrary.saveToLibraryAsync(tempPath);
}

export async function downloadUrlToDevice(url: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('media_library_permission_denied');
  }

  const tempPath = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.downloadAsync(url, tempPath);
  await MediaLibrary.saveToLibraryAsync(tempPath);
}

export async function fileUriToBase64(uri: string, mimeType = 'audio/wav'): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mimeType};base64,${base64}`;
}

export function fmtMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

export const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTagline: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', lineHeight: 34 },
  headerTaglineItalic: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', fontStyle: 'italic', color: '#fff', lineHeight: 34 },
  walletCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 4, gap: 10 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  walletBalance: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#B44CFF' },
  priceRow: { gap: 8, paddingVertical: 2 },
  priceChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 2 },
  priceChipName: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  priceChipVal: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  tabBarWrap: { borderBottomWidth: 1 },
  tabBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: '#FF6B33',
    shadowColor: '#FF6B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 4,
  },
  tabPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tabContent: { padding: 20, gap: 4 },
  sectionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9999 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, height: 48 },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  genBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  genBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  playerCard: { marginTop: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  playerGradient: { padding: 18 },
  playerTitle: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, marginVertical: 12 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  playerDuration: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  dlText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },
  badgePill: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  recorderBtn: { borderRadius: 12, borderWidth: 1.5, padding: 16, alignItems: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  recLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  recHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  recorderPreview: { borderRadius: 12, borderWidth: 1.5, padding: 16, gap: 10, flexDirection: 'row', alignItems: 'center' },
  recDuration: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  reRecordBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reRecordText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  uploadOrRec: { gap: 8 },
  uploadBtn: { borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  uploadText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  dropdown: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  voiceGroupHeader: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  voiceGroupLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  voiceGroupDivider: { height: 1, marginVertical: 4 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderBtn: { width: 36, height: 36, borderRadius: 9999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sliderTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: 6, backgroundColor: '#B44CFF', borderRadius: 3 },
  sliderLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 4 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 8 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#B44CFF', flex: 1 },
  errBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  errorText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#ef4444', flex: 1 },
  lyricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  aiLyricsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  aiLyricsBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#B44CFF' },
  radioGroup: { gap: 10 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B44CFF' },
  radioText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  successCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 12, marginTop: 16 },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#22c55e20', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  successSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  imageUploadArea: { height: 140, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  imageUploadText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  imagePreview: { borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  changeImageBtn: { padding: 12, alignItems: 'center', backgroundColor: 'rgba(31,123,255,0.12)' },
  changeImageText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#B44CFF' },
  toggleRow: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
  toggleOpt: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  toggleOptActive: { backgroundColor: '#B44CFF' },
  toggleOptText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  imgMusicResult: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  imgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  overlayPlayBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(31,123,255,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  imgWaveRow: { position: 'absolute', bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 3 },
  imgBadgeTop: { position: 'absolute', top: 10, right: 10, backgroundColor: '#B44CFF', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  imgBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  imgMusicActions: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#1a1a2e' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  generatingBox: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8, marginTop: 8 },
  generatingText: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  generatingHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  resultPanel: { borderRadius: 16, borderWidth: 1, marginTop: 16, overflow: 'hidden' },
  resultPanelEmpty: { minHeight: 200 },
  resultPanelLoading: { padding: 24, alignItems: 'center', gap: 10 },
  resultEmptyGradient: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  resultEmptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  resultEmptyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  decorativeWaveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, opacity: 0.4, marginTop: 4 },
  resultControls: { flexDirection: 'row', gap: 10, marginTop: 4 },
  resultControlBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  genSpinner: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, marginTop: 4 },
});
