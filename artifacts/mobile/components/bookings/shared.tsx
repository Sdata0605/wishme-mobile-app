/**
 * Everything the My Bookings cards have in common: date formatting, the tab list, one row type per Supabase
 * table, status colours, the small status badge, and the stylesheet. The cards, the media blocks, the tab
 * config and the realtime hook live beside this file.
 */
import { format } from 'date-fns';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  try { return format(new Date(s), 'PP'); } catch { return s; }
}

export function fmtDateLong(s: string): string {
  try { return format(new Date(s), "EEEE, MMMM do, yyyy"); } catch { return s; }
}

export function fmtTime(s: string): string {
  try { return format(new Date(s), "h:mm a"); } catch { return ''; }
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s2 = sec % 60;
  return `${m}m ${s2}s`;
}

export function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export type Colors = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

export const BOOKING_TABS = [
  'Celebrity',
  'Wish a Friend',
  'Wishes',
  'Cards',
  'Photo',
  'Calls',
  'Music',
  'Img+Music',
  'TTS',
  'SFX',
  'Convert',
  'Isolate',
] as const;

export type BookingTab = (typeof BOOKING_TABS)[number];

export interface CelebBooking {
  id: string; user_id: string; celebrity_id: string;
  service_type: string; status: string; generation_status: string | null;
  video_status: string | null; video_file_key: string | null; video_url: string | null;
  message: string | null; final_price: number; created_at: string;
  generation_error: string | null;
  celebrities: { name: string; image_url: string; category: string } | null;
}

export interface WishFriendOrder {
  id: string; order_type: 'video_wish' | 'ugc_video'; status: 'pending' | 'processing' | 'completed' | 'rejected';
  recipient_name: string; occasion: string; prompt: string; price_paid: number;
  video_url: string | null; video_file_key: string | null; admin_notes: string | null; created_at: string;
  celebrities: { name: string; image_url: string } | null;
}

export interface WishOrder {
  id: string; celebrity_id: string; occasion_type: string; recipient_name: string;
  message: string; amount_paid: number; status: string;
  generated_card_image_url: string | null; card_url: string | null; created_at: string;
  celebrities: { name: string; image_url: string } | null;
}

export interface GreetingCard {
  id: string; occasion_name: string; recipient_name: string; original_prompt: string;
  generated_image_url: string | null; amount_charged: number; status: string; created_at: string;
}

export interface PhotoWish {
  id: string; occasion_type: string; recipient_name: string; message: string;
  output_url: string | null; credits_used: number; status: string; created_at: string;
}

export interface VoiceCall {
  id: string; celebrity_id: string; recipient_name: string; recipient_phone: string;
  occasion: string; sender_name: string; call_status: string;
  scheduled_at: string | null; call_duration_seconds: number | null;
  price_paid: number; vapi_voice_name: string | null; created_at: string;
  celebrities: { name: string; image_url: string } | null;
}

export interface MusicGen {
  id: string; title: string; genre: string; mood: string; lyrics: string | null;
  audio_url: string | null; credits_used: number; has_vocals: boolean;
  status: string; error_message: string | null; created_at: string;
}

export interface ImgMusicGen {
  id: string; genre: string; mood: string; has_vocals: boolean; description: string;
  image_url: string | null; audio_url: string | null; amount_charged: number;
  status: string; created_at: string;
}

export interface TtsGen {
  id: string; text: string; voice_name: string; audio_url: string | null;
  credits_used: number; status: string; created_at: string;
}

export interface SfxGen {
  id: string; description: string; duration_seconds: number | null;
  audio_url: string | null; credits_used: number; status: string; created_at: string;
}

export interface VoiceConversion {
  id: string; target_voice_name: string; original_file_name: string;
  audio_url: string | null; credits_used: number; status: string; created_at: string;
}

export interface AudioIsolation {
  id: string; original_file_name: string; audio_url: string | null;
  credits_used: number; status: string; created_at: string;
}

export interface TabData {
  celeb: CelebBooking[];
  wishFriend: WishFriendOrder[];
  wishes: WishOrder[];
  cards: GreetingCard[];
  photo: PhotoWish[];
  calls: VoiceCall[];
  music: MusicGen[];
  imgMusic: ImgMusicGen[];
  tts: TtsGen[];
  sfx: SfxGen[];
  convert: VoiceConversion[];
  isolate: AudioIsolation[];
}

export type TabDataKey = keyof TabData;

function getStatusColor(status: string): string {
  const s = status?.toLowerCase();
  if (s === 'completed') return '#22C55E';
  if (s === 'failed' || s === 'cancelled') return '#EF4444';
  if (s === 'processing' || s === 'scheduled') return '#3B82F6';
  if (s === 'ready') return '#8B5CF6';
  return '#F59E0B';
}

export function SmallStatusBadge({ status, colors }: { status: string; colors: Colors }) {
  const color = getStatusColor(status);
  return (
    <View style={[s.statusBadge, { backgroundColor: color + '22' }]}>
      <Text style={[s.statusText, { color }]}>{status}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  body: { flex: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, marginTop: 12,
    padding: 12, borderRadius: 16, borderWidth: 1,
  },
  sectionBarIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#7B5CFA', alignItems: 'center', justifyContent: 'center' },
  sectionBarTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  sectionBarHint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  listContent: { padding: 12, gap: 12 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  card: {
    borderRadius: 16, padding: 14, borderWidth: 1, overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 4, marginTop: 2 },
  cardPrice: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  orderId: { fontSize: 10, fontFamily: 'Inter_400Regular', marginBottom: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  cardImg: { width: '100%', height: 140, borderRadius: 10, marginTop: 8 },
  fullCardImg: { width: '100%', height: 180, borderRadius: 10, marginBottom: 2 },
  audioPlayer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 9999, padding: 8, borderWidth: 1, marginTop: 8,
  },
  playBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  audioBar: { flex: 1, height: 3, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden' },
  audioProgress: { height: '100%' },
  audioDuration: { fontSize: 10, fontFamily: 'Inter_500Medium', minWidth: 60, textAlign: 'right' },
  videoWrapper: { marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, height: 200 },
  videoView: { flex: 1 },
  videoLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  timelineToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  timeline: { marginTop: 12, paddingLeft: 4 },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, height: 22, marginVertical: 2 },
  timelineLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', paddingTop: 3, flex: 1 },
  imgModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  imgModalClose: { position: 'absolute', right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  imgModalImage: { width: '100%', height: '80%' },
  vocBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  emptyBtn: { backgroundColor: '#7B5CFA', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999, marginTop: 4 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#DC2626', paddingHorizontal: 16, paddingVertical: 12,
  },
  errorBannerText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10,
  },
  infoBoxText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  downloadLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
  },
  downloadLinkText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
