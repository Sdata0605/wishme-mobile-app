import { router } from 'expo-router';
import { Audio } from 'expo-av';
import { VideoView, useVideoPlayer } from 'expo-video';
import { format } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';
import { useTheme } from '@/context/ThemeContext';

function useRealtimeBookings(
  profileId: string | null,
  accessToken: string | null,
  onUpdate: (table: string) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!profileId || !accessToken) return;
    const wsBase = SUPABASE_URL.replace('https://', 'wss://');
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;

    const send = (msg: object) => {
      try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {}
    };

    const join = (table: string) => {
      send({
        topic: `realtime:public:${table}`,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            postgres_changes: [{ event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${profileId}` }],
          },
          access_token: accessToken,
        },
        ref: String(++ref),
      });
    };

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        join('bookings');
        join('music_generations');
        heartbeat = setInterval(() => {
          send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) });
        }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          const isUpdate =
            msg.event === 'postgres_changes' &&
            (msg.payload?.data?.type === 'UPDATE' || msg.payload?.eventType === 'UPDATE');
          if (isUpdate) {
            const topic: string = msg.topic ?? '';
            if (topic.includes('music_generations')) {
              onUpdateRef.current('music_generations');
            } else if (topic.includes('bookings')) {
              onUpdateRef.current('bookings');
            }
          }
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      ws?.close();
    };
  }, [profileId, accessToken]);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  try { return format(new Date(s), 'PP'); } catch { return s; }
}
function fmtDateLong(s: string): string {
  try { return format(new Date(s), "EEEE, MMMM do, yyyy"); } catch { return s; }
}
function fmtTime(s: string): string {
  try { return format(new Date(s), "h:mm a"); } catch { return ''; }
}
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s2 = sec % 60;
  return `${m}m ${s2}s`;
}
function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

type Colors = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

const BOOKING_TABS = [
  'Celebrity',
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
  'Occasions',
] as const;
type BookingTab = (typeof BOOKING_TABS)[number];

interface CelebBooking {
  id: string; user_id: string; celebrity_id: string;
  service_type: string; status: string; generation_status: string | null;
  video_status: string | null; video_file_key: string | null; video_url: string | null;
  message: string | null; final_price: number; created_at: string;
  generation_error: string | null;
  celebrities: { name: string; image_url: string; category: string } | null;
}
interface WishOrder {
  id: string; celebrity_id: string; occasion_type: string; recipient_name: string;
  message: string; amount_paid: number; status: string;
  generated_card_image_url: string | null; card_url: string | null; created_at: string;
  celebrities: { name: string; image_url: string } | null;
}
interface GreetingCard {
  id: string; occasion_name: string; recipient_name: string; original_prompt: string;
  generated_image_url: string | null; amount_charged: number; status: string; created_at: string;
}
interface PhotoWish {
  id: string; occasion_type: string; recipient_name: string; message: string;
  output_url: string | null; credits_used: number; status: string; created_at: string;
}
interface VoiceCall {
  id: string; celebrity_id: string; recipient_name: string; recipient_phone: string;
  occasion: string; sender_name: string; call_status: string;
  scheduled_at: string | null; call_duration_seconds: number | null;
  price_paid: number; vapi_voice_name: string | null; created_at: string;
  celebrities: { name: string; image_url: string } | null;
}
interface MusicGen {
  id: string; title: string; genre: string; mood: string; lyrics: string | null;
  audio_url: string | null; credits_used: number; has_vocals: boolean;
  status: string; error_message: string | null; created_at: string;
}
interface ImgMusicGen {
  id: string; genre: string; mood: string; has_vocals: boolean; description: string;
  image_url: string | null; audio_url: string | null; amount_charged: number;
  status: string; created_at: string;
}
interface TtsGen {
  id: string; text: string; voice_name: string; audio_url: string | null;
  credits_used: number; status: string; created_at: string;
}
interface SfxGen {
  id: string; description: string; duration_seconds: number | null;
  audio_url: string | null; credits_used: number; status: string; created_at: string;
}
interface VoiceConversion {
  id: string; target_voice_name: string; original_file_name: string;
  audio_url: string | null; credits_used: number; status: string; created_at: string;
}
interface AudioIsolation {
  id: string; original_file_name: string; audio_url: string | null;
  credits_used: number; status: string; created_at: string;
}
interface OccasionBooking {
  id: string; recipient_name: string; message: string; price: number;
  status: string; created_at: string;
  celebrities: { name: string; image_url: string } | null;
  occasions: { name: string } | null;
}

interface TabData {
  celeb: CelebBooking[];
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
  occasions: OccasionBooking[];
}

type TabDataKey = keyof TabData;

function getCelebStatus(row: CelebBooking): { label: string; color: string; pulse: boolean } {
  if (row.status === 'cancelled') return { label: '❌ Cancelled', color: '#EF4444', pulse: false };
  if (row.video_status === 'failed' || row.generation_status === 'failed')
    return { label: '⚠️ Failed', color: '#EF4444', pulse: false };
  if (row.generation_status === 'timeout') return { label: '⚠️ Timed Out', color: '#F97316', pulse: false };
  if (row.status === 'completed') return { label: '✅ Completed', color: '#22C55E', pulse: false };
  if (row.status === 'video_sent' || row.status === 'sent')
    return { label: '📤 Delivered to You', color: '#22C55E', pulse: false };
  if (row.generation_status === 'completed' && row.video_status === 'ready')
    return { label: '🎥 Video Ready — Pending Admin Review', color: '#8B5CF6', pulse: false };
  if (row.generation_status === 'uploading')
    return { label: '⬆️ Uploading Video', color: '#3B82F6', pulse: true };
  if (row.generation_status === 'downloading')
    return { label: '⬇️ Processing Video', color: '#3B82F6', pulse: true };
  if (row.generation_status === 'video_generating')
    return { label: '🎬 Creating Video...', color: '#F59E0B', pulse: true };
  if (row.generation_status === 'script_generating')
    return { label: '🤖 Writing Script...', color: '#F59E0B', pulse: true };
  if (row.status === 'confirmed') return { label: '✅ Confirmed — In Queue', color: '#22C55E', pulse: false };
  return { label: '⏳ Awaiting Confirmation', color: '#F59E0B', pulse: false };
}

function getStatusColor(status: string): string {
  const s = status?.toLowerCase();
  if (s === 'completed') return '#22C55E';
  if (s === 'failed' || s === 'cancelled') return '#EF4444';
  if (s === 'processing' || s === 'scheduled') return '#3B82F6';
  if (s === 'ready') return '#8B5CF6';
  return '#F59E0B';
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  video_wish: 'Video Wish',
  voice_message: 'Voice Message',
  live_call: 'Live Call',
  personalized_song: 'Personalized Song',
  shoutout: 'Shoutout',
};

function SmallStatusBadge({ status, colors }: { status: string; colors: Colors }) {
  const color = getStatusColor(status);
  return (
    <View style={[s.statusBadge, { backgroundColor: color + '22' }]}>
      <Text style={[s.statusText, { color }]}>{status}</Text>
    </View>
  );
}

function PulseStatusBadge({ label, color, pulse }: { label: string; color: string; pulse: boolean }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) { anim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, anim]);
  return (
    <Animated.View style={[s.statusBadge, { backgroundColor: color + '22', opacity: pulse ? anim : 1 }]}>
      <Text style={[s.statusText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

function BookingAudioPlayer({ audioUrl, colors }: { audioUrl: string | null; colors: Colors }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const toggle = async () => {
    if (!audioUrl || loading) return;
    if (!soundRef.current) {
      setLoading(true);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
        await sound.setProgressUpdateIntervalAsync(500);
        sound.setOnPlaybackStatusUpdate(st => {
          if (!st.isLoaded) return;
          setPosition(st.positionMillis);
          if (st.durationMillis) setDuration(st.durationMillis);
          if (st.didJustFinish) { setPlaying(false); setPosition(0); }
        });
        soundRef.current = sound;
        setPlaying(true);
      } catch { setPlaying(false); }
      setLoading(false);
      return;
    }
    if (playing) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  };

  const progress = duration > 0 ? position / duration : 0;
  return (
    <View style={[s.audioPlayer, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <TouchableOpacity onPress={toggle} style={[s.playBtn, { backgroundColor: '#FF6B33' }]} disabled={!audioUrl}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={13} color="#fff" />
        )}
      </TouchableOpacity>
      <View style={s.audioBar}>
        <View style={[s.audioProgress, { backgroundColor: '#FF6B33', width: `${progress * 100}%` }]} />
      </View>
      <Text style={[s.audioDuration, { color: colors.mutedForeground }]}>
        {duration > 0 ? `${fmtMs(position)} / ${fmtMs(duration)}` : audioUrl ? '--:--' : 'N/A'}
      </Text>
    </View>
  );
}

function DownloadLink({ url, colors }: { url: string; colors: Colors }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={s.downloadLink}
    >
      <Icon name="download" size={13} color="#3B82F6" />
      <Text style={[s.downloadLinkText, { color: '#3B82F6' }]}>Download</Text>
    </TouchableOpacity>
  );
}

function ImagePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.imgModalOverlay]}>
        <TouchableOpacity style={[s.imgModalClose, { top: insets.top + 16 }]} onPress={onClose}>
          <Icon name="x" size={22} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri: url }} style={s.imgModalImage} resizeMode="contain" />
      </View>
    </Modal>
  );
}

function InlineCelebVideoPlayer({ videoUri, colors }: { videoUri: string; colors: Colors }) {
  const player = useVideoPlayer(videoUri, p => { p.loop = false; });
  return (
    <View style={[s.videoWrapper, { borderColor: colors.border }]}>
      <VideoView player={player} style={s.videoView} nativeControls />
    </View>
  );
}

function useCelebSignedVideoUrl(row: CelebBooking, accessToken: string | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  useEffect(() => {
    const canShow =
      (row.status === 'video_sent' || row.status === 'sent' || row.status === 'completed') &&
      row.video_file_key;

    if (!canShow || !accessToken) {
      setSignedUrl(null);
      return;
    }

    let cancelled = false;
    setLoadingVideo(true);

    supabaseFetch(
      '/functions/v1/b2-get-signed-url',
      {
        method: 'POST',
        body: JSON.stringify({ fileKey: row.video_file_key }),
      },
      accessToken,
    )
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (!cancelled) setSignedUrl(data?.signedUrl ?? data?.url ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingVideo(false); });

    return () => { cancelled = true; };
  }, [row.id, row.status, row.video_file_key, accessToken]);

  return { signedUrl, loadingVideo };
}

function parseCelebMessage(msg: string | null): { recipientName?: string; occasion?: string; message?: string } {
  if (!msg) return {};
  try {
    const parsed = JSON.parse(msg);
    return {
      recipientName: parsed?.requestDetails?.recipientName,
      occasion: parsed?.requestDetails?.occasion,
      message: parsed?.requestDetails?.message,
    };
  } catch {
    return { message: msg };
  }
}

function OrderTimeline({ row, colors }: { row: CelebBooking; colors: Colors }) {
  const gs = row.generation_status;
  const vs = row.video_status;
  const steps = [
    { label: 'Booking Placed', done: true },
    { label: 'Confirmed by Team', done: row.status !== 'pending' },
    { label: 'Script Generated', done: ['video_generating', 'downloading', 'uploading', 'completed'].includes(gs ?? '') },
    { label: 'Video Being Created', done: ['downloading', 'uploading', 'completed'].includes(gs ?? '') },
    { label: 'Video Ready', done: vs === 'ready' },
    { label: 'Delivered', done: ['video_sent', 'sent', 'completed'].includes(row.status) },
  ];
  return (
    <View style={s.timeline}>
      {steps.map((step, i) => (
        <View key={i} style={s.timelineStep}>
          <View style={s.timelineLeft}>
            <View style={[s.timelineDot, { backgroundColor: step.done ? '#22C55E' : colors.border }]}>
              {step.done && <Icon name="check" size={10} color="#fff" />}
            </View>
            {i < steps.length - 1 && (
              <View style={[s.timelineLine, { backgroundColor: steps[i + 1].done ? '#22C55E' : colors.border }]} />
            )}
          </View>
          <Text style={[s.timelineLabel, { color: step.done ? colors.foreground : colors.mutedForeground }]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CelebCard({ item, colors, accessToken }: { item: CelebBooking; colors: Colors; accessToken: string | null }) {
  const { label, color, pulse } = getCelebStatus(item);
  const parsed = parseCelebMessage(item.message);
  const [showTimeline, setShowTimeline] = useState(false);
  const { signedUrl, loadingVideo } = useCelebSignedVideoUrl(item, accessToken);

  const serviceLabel = SERVICE_TYPE_LABELS[item.service_type] ?? item.service_type ?? null;

  const isVideoReady =
    (item.status === 'video_sent' || item.status === 'sent' || item.status === 'completed') &&
    item.video_file_key != null;

  const isUnderReview =
    item.status === 'confirmed' &&
    item.video_file_key != null &&
    item.video_status === 'ready';

  const isBeingCreated =
    item.status === 'confirmed' &&
    !isUnderReview;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="star" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.celebrities?.name ?? 'Celebrity'}
            </Text>
            <PulseStatusBadge label={label} color={color} pulse={pulse} />
          </View>
          {item.celebrities?.category ? (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.celebrities.category}</Text>
          ) : null}
          {serviceLabel ? (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{serviceLabel}</Text>
          ) : null}
          {parsed.occasion || parsed.recipientName ? (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {parsed.occasion}{parsed.recipientName ? ` for ${parsed.recipientName}` : ''}
            </Text>
          ) : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.final_price > 0 && (
            <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.final_price.toLocaleString('en-IN')}</Text>
          )}
          <Text style={[s.orderId, { color: colors.mutedForeground }]}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      {isUnderReview && (
        <View style={[s.infoBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
          <Icon name="clock" size={14} color="#92400E" />
          <Text style={[s.infoBoxText, { color: '#92400E' }]}>Video Under Review — our team will send it to you shortly.</Text>
        </View>
      )}

      {isBeingCreated && (
        <View style={[s.infoBox, { backgroundColor: colors.border + '44', borderColor: colors.border }]}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={[s.infoBoxText, { color: colors.mutedForeground }]}>Video Being Created...</Text>
        </View>
      )}

      {isVideoReady && loadingVideo && (
        <View style={s.videoLoadingRow}>
          <ActivityIndicator size="small" color="#FF6B33" />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>Loading video...</Text>
        </View>
      )}

      {isVideoReady && signedUrl && Platform.OS !== 'web' && (
        <InlineCelebVideoPlayer videoUri={signedUrl} colors={colors} />
      )}
      {isVideoReady && signedUrl && Platform.OS === 'web' && (
        <View style={[s.videoWrapper, { borderColor: colors.border }]}>
          <video src={signedUrl} controls style={{ width: '100%', borderRadius: 10 }} />
        </View>
      )}

      {item.status !== 'pending' && (
        <TouchableOpacity onPress={() => setShowTimeline(t => !t)} style={s.timelineToggle}>
          <Text style={{ color: '#FF6B33', fontSize: 12, fontFamily: 'Inter_500Medium' }}>
            {showTimeline ? 'Hide Timeline' : 'Order Timeline'}
          </Text>
          <Icon name={showTimeline ? 'chevron-up' : 'chevron-down'} size={14} color="#FF6B33" />
        </TouchableOpacity>
      )}
      {showTimeline && item.status !== 'pending' && <OrderTimeline row={item} colors={colors} />}
    </View>
  );
}

function WishCard({ item, colors }: { item: WishOrder; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  const imgUrl = item.generated_card_image_url ?? item.card_url;
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="heart" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.celebrities?.name ?? 'Celebrity Wish'}
            </Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.occasion_type} for {item.recipient_name}</Text>
          {item.message ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.message}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.amount_paid > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.amount_paid.toLocaleString('en-IN')}</Text>}
          {imgUrl ? (
            <TouchableOpacity onPress={() => setPreview(imgUrl)}>
              <Image source={{ uri: imgUrl }} style={s.cardImg} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

function CardCard({ item, colors }: { item: GreetingCard; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  const cardTitle = [item.occasion_name, item.original_prompt].filter(Boolean).join(' - ');
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="gift" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{cardTitle || item.occasion_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>For {item.recipient_name}</Text>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.amount_charged > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.amount_charged.toLocaleString('en-IN')}</Text>}
          {item.generated_image_url ? (
            <TouchableOpacity onPress={() => setPreview(item.generated_image_url!)}>
              <Image source={{ uri: item.generated_image_url }} style={s.cardImg} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
          {item.status === 'completed' && item.generated_image_url ? (
            <DownloadLink url={item.generated_image_url} colors={colors} />
          ) : null}
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

function PhotoCard({ item, colors }: { item: PhotoWish; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  const photoTitle = item.occasion_type ? `${item.occasion_type} Photo Wish` : 'Photo Wish';
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="image" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{photoTitle}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>For {item.recipient_name}</Text>
          {item.message ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.message}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.credits_used}</Text>}
          {item.output_url ? (
            <TouchableOpacity onPress={() => setPreview(item.output_url!)}>
              <Image source={{ uri: item.output_url }} style={s.cardImg} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

function CallCard({ item, colors }: { item: VoiceCall; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="phone" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.celebrities?.name ?? 'Celebrity Call'}
            </Text>
            <SmallStatusBadge status={item.call_status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.occasion} for {item.recipient_name}</Text>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>From: {item.sender_name} → {item.recipient_phone}</Text>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.price_paid > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.price_paid.toLocaleString('en-IN')}</Text>}
        </View>
      </View>
      {item.scheduled_at && (
        <View style={[s.infoBox, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}>
          <Icon name="calendar" size={14} color="#1D4ED8" />
          <Text style={[s.infoBoxText, { color: '#1D4ED8' }]}>
            Scheduled: {fmtDateLong(item.scheduled_at)} at {fmtTime(item.scheduled_at)}
          </Text>
        </View>
      )}
      {item.call_status === 'completed' && item.call_duration_seconds != null && (
        <Text style={[s.cardSub, { color: '#22C55E', marginTop: 6 }]}>Duration: {fmtDuration(item.call_duration_seconds)}</Text>
      )}
    </View>
  );
}

function MusicCard({ item, colors }: { item: MusicGen; colors: Colors }) {
  const audioUrl = item.audio_url ?? null;
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="music" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title || 'Song'}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.genre}{item.mood ? ` · ${item.mood}` : ''}</Text>
          {item.has_vocals && (
            <View style={[s.vocBadge, { borderColor: '#8B5CF6' }]}>
              <Text style={{ color: '#8B5CF6', fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>🎤 Vocals</Text>
            </View>
          )}
          {item.lyrics ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.lyrics}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.credits_used}</Text>}
          {item.error_message ? <Text style={{ color: '#EF4444', fontSize: 11, fontFamily: 'Inter_400Regular' }}>{item.error_message}</Text> : null}
          {item.status === 'completed' && audioUrl ? (
            <>
              <BookingAudioPlayer audioUrl={audioUrl} colors={colors} />
              <DownloadLink url={audioUrl} colors={colors} />
            </>
          ) : item.status === 'processing' ? (
            <View style={s.processingRow}>
              <ActivityIndicator size="small" color="#FF6B33" />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>Processing...</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ImgMusicCard({ item, colors }: { item: ImgMusicGen; colors: Colors }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {item.image_url && (
        <TouchableOpacity onPress={() => setPreview(item.image_url!)}>
          <Image source={{ uri: item.image_url }} style={s.fullCardImg} resizeMode="cover" />
        </TouchableOpacity>
      )}
      <View style={{ padding: item.image_url ? 12 : 0 }}>
        <View style={!item.image_url ? s.cardRow : undefined}>
          {!item.image_url && (
            <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
              <Icon name="image" size={28} color={colors.mutedForeground} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={s.cardTop}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>{item.genre} · {item.mood}</Text>
              <SmallStatusBadge status={item.status} colors={colors} />
            </View>
            {item.has_vocals && (
              <View style={[s.vocBadge, { borderColor: '#8B5CF6' }]}>
                <Text style={{ color: '#8B5CF6', fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>🎤 Vocals</Text>
              </View>
            )}
            {item.description ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text> : null}
            <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
            {item.amount_charged > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.amount_charged.toLocaleString('en-IN')}</Text>}
            {item.status === 'completed' && item.audio_url ? (
              <>
                <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
                <DownloadLink url={item.audio_url} colors={colors} />
              </>
            ) : null}
          </View>
        </View>
      </View>
      {preview && <ImagePreviewModal url={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

function TtsCard({ item, colors }: { item: TtsGen; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="volume-2" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.voice_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          {item.text ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={3}>{item.text}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SfxCard({ item, colors }: { item: SfxGen; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="zap" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.description}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          {item.duration_seconds != null && (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>Duration: {item.duration_seconds}s</Text>
          )}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ConvertCard({ item, colors }: { item: VoiceConversion; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="mic" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.target_voice_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>File: {item.original_file_name}</Text>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function IsolateCard({ item, colors }: { item: AudioIsolation; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
          <Icon name="volume-x" size={28} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{item.original_file_name}</Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.credits_used > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.credits_used}</Text>}
          {item.status === 'completed' && item.audio_url ? (
            <BookingAudioPlayer audioUrl={item.audio_url} colors={colors} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function OccasionCard({ item, colors }: { item: OccasionBooking; colors: Colors }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        {item.celebrities?.image_url ? (
          <Image source={{ uri: item.celebrities.image_url }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="gift" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.occasions?.name ?? 'Occasion'}
            </Text>
            <SmallStatusBadge status={item.status} colors={colors} />
          </View>
          {item.celebrities?.name && (
            <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{item.celebrities.name}</Text>
          )}
          <Text style={[s.cardSub, { color: colors.mutedForeground }]}>For: {item.recipient_name}</Text>
          {item.message ? <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={2}>{item.message}</Text> : null}
          <Text style={[s.cardDate, { color: colors.mutedForeground }]}>{fmtDate(item.created_at)}</Text>
          {item.price > 0 && <Text style={[s.cardPrice, { color: '#FF6B33' }]}>₹{item.price.toLocaleString('en-IN')}</Text>}
        </View>
      </View>
    </View>
  );
}

const EMPTY_CONFIG: Record<BookingTab, { icon: string; label: string; route: string; btnLabel: string }> = {
  Celebrity: { icon: 'star', label: 'No celebrity bookings yet', route: '/(tabs)/home', btnLabel: 'Book a Celebrity' },
  Wishes: { icon: 'heart', label: 'No wishes yet', route: '/(tabs)/home', btnLabel: 'Send a Wish' },
  Cards: { icon: 'gift', label: 'No greeting cards yet', route: '/create-card', btnLabel: 'Create a Card' },
  Photo: { icon: 'image', label: 'No photo wishes yet', route: '/photo-wish', btnLabel: 'Create Photo Wish' },
  Calls: { icon: 'phone', label: 'No celebrity calls yet', route: '/(tabs)/home', btnLabel: 'Book a Call' },
  Music: { icon: 'music', label: 'No music generated yet', route: '/(tabs)/music', btnLabel: 'Generate Music' },
  'Img+Music': { icon: 'image', label: 'No image+music yet', route: '/(tabs)/music', btnLabel: 'Create Img+Music' },
  TTS: { icon: 'volume-2', label: 'No text-to-speech yet', route: '/(tabs)/music', btnLabel: 'Create TTS' },
  SFX: { icon: 'zap', label: 'No sound effects yet', route: '/(tabs)/music', btnLabel: 'Generate SFX' },
  Convert: { icon: 'mic', label: 'No voice conversions yet', route: '/(tabs)/music', btnLabel: 'Convert Voice' },
  Isolate: { icon: 'volume-x', label: 'No audio isolations yet', route: '/(tabs)/music', btnLabel: 'Isolate Audio' },
  Occasions: { icon: 'gift', label: 'No occasion bookings yet', route: '/occasions', btnLabel: 'Book an Occasion' },
};

function EmptyState({ tab, colors }: { tab: BookingTab; colors: Colors }) {
  const cfg = EMPTY_CONFIG[tab];
  return (
    <View style={s.empty}>
      <Icon name={cfg.icon as any} size={52} color={colors.mutedForeground} />
      <Text style={[s.emptyTitle, { color: colors.foreground }]}>{cfg.label}</Text>
      <TouchableOpacity style={s.emptyBtn} onPress={() => router.push(cfg.route as any)}>
        <Text style={s.emptyBtnText}>{cfg.btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const TAB_TO_TABLES: Record<BookingTab, { table: string; select: string; dataKey: TabDataKey }[]> = {
  Celebrity: [{ table: 'bookings', select: 'id,user_id,celebrity_id,service_type,status,generation_status,video_status,video_file_key,video_url,message,final_price,created_at,generation_error,celebrities:celebrity_id(name,image_url,category)', dataKey: 'celeb' }],
  Wishes: [{ table: 'wish_celebrity_orders', select: 'id,celebrity_id,occasion_type,recipient_name,message,amount_paid,status,generated_card_image_url,card_url,created_at,celebrities:celebrity_id(name,image_url)', dataKey: 'wishes' }],
  Cards: [{ table: 'greeting_card_generations', select: 'id,occasion_name,recipient_name,original_prompt,generated_image_url,amount_charged,status,created_at', dataKey: 'cards' }],
  Photo: [{ table: 'photo_wishes', select: 'id,occasion_type,recipient_name,message,output_url,credits_used,status,created_at', dataKey: 'photo' }],
  Calls: [{ table: 'voice_call_wishes', select: 'id,celebrity_id,recipient_name,recipient_phone,occasion,sender_name,call_status,scheduled_at,call_duration_seconds,price_paid,vapi_voice_name,created_at,celebrities:celebrity_id(name,image_url)', dataKey: 'calls' }],
  Music: [{ table: 'music_generations', select: 'id,title,genre,mood,lyrics,audio_url,credits_used,has_vocals,status,error_message,created_at', dataKey: 'music' }],
  'Img+Music': [{ table: 'image_music_generations', select: 'id,genre,mood,has_vocals,description,image_url,audio_url,amount_charged,status,created_at', dataKey: 'imgMusic' }],
  TTS: [{ table: 'tts_generations', select: 'id,text,voice_name,audio_url,credits_used,status,created_at', dataKey: 'tts' }],
  SFX: [{ table: 'sound_effect_generations', select: 'id,description,duration_seconds,audio_url,credits_used,status,created_at', dataKey: 'sfx' }],
  Convert: [{ table: 'voice_conversion_generations', select: 'id,target_voice_name,original_file_name,audio_url,credits_used,status,created_at', dataKey: 'convert' }],
  Isolate: [{ table: 'audio_isolation_generations', select: 'id,original_file_name,audio_url,credits_used,status,created_at', dataKey: 'isolate' }],
  Occasions: [{ table: 'occasion_bookings', select: 'id,recipient_name,message,price,status,created_at,celebrities:celebrity_id(name,image_url),occasions:occasion_id(name)', dataKey: 'occasions' }],
};

const TABLE_TO_TAB: Record<string, BookingTab> = {
  bookings: 'Celebrity',
  music_generations: 'Music',
};

export default function BookingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { user, getValidSession } = useAuth();
  const [activeTab, setActiveTab] = useState<BookingTab>('Celebrity');
  const [tabLoading, setTabLoading] = useState<Partial<Record<BookingTab, boolean>>>({});
  const [fetchError, setFetchError] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Partial<Record<BookingTab, number>>>({});
  const [data, setData] = useState<TabData>({
    celeb: [], wishes: [], cards: [], photo: [],
    calls: [], music: [], imgMusic: [], tts: [],
    sfx: [], convert: [], isolate: [], occasions: [],
  });
  const loadedTabsRef = useRef<Set<BookingTab>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeToken, setRealtimeToken] = useState<string | null>(null);

  useEffect(() => {
    getValidSession().then(s => setRealtimeToken(s?.access_token ?? null));
  }, [getValidSession]);

  const fetchBadgeCounts = useCallback(async () => {
    if (!user?.profileId) return;
    const validSession = await getValidSession();
    if (!validSession?.access_token) return;
    const pid = user.profileId;
    const tok = validSession.access_token;

    const countFetches = BOOKING_TABS.map(async (tab) => {
      const configs = TAB_TO_TABLES[tab];
      let total = 0;
      for (const cfg of configs) {
        try {
          const res = await supabaseFetch(
            `/rest/v1/${cfg.table}?select=id&user_id=eq.${pid}&limit=1`,
            { method: 'HEAD', headers: { Prefer: 'count=exact' } },
            tok,
          );
          const rangeHeader = res.headers.get('content-range');
          if (rangeHeader) {
            const match = rangeHeader.match(/\/(\d+)$/);
            if (match) total += parseInt(match[1], 10);
          }
        } catch {}
      }
      return { tab, count: total };
    });

    const results = await Promise.all(countFetches);
    const counts: Partial<Record<BookingTab, number>> = {};
    for (const { tab, count } of results) {
      counts[tab] = count;
    }
    setBadgeCounts(counts);
  }, [user?.profileId, getValidSession]);

  const fetchTab = useCallback(async (tab: BookingTab, force = false) => {
    if (!user?.profileId) return;
    if (!force && loadedTabsRef.current.has(tab)) return;

    const validSession = await getValidSession();
    if (!validSession?.access_token) return;

    const pid = user.profileId;
    const tok = validSession.access_token;
    setTabLoading(prev => ({ ...prev, [tab]: true }));

    const configs = TAB_TO_TABLES[tab];
    try {
      for (const cfg of configs) {
        const res = await supabaseFetch(
          `/rest/v1/${cfg.table}?select=${encodeURIComponent(cfg.select)}&user_id=eq.${pid}&order=created_at.desc&limit=20`,
          {},
          tok,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        setData(prev => ({ ...prev, [cfg.dataKey]: rows }));
      }
      loadedTabsRef.current.add(tab);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, [user?.profileId, getValidSession]);

  const handleRefreshButton = useCallback(async () => {
    setRefreshing(true);
    loadedTabsRef.current.delete(activeTab);
    await Promise.all([fetchBadgeCounts(), fetchTab(activeTab, true)]);
    setRefreshing(false);
  }, [activeTab, fetchBadgeCounts, fetchTab]);

  useEffect(() => {
    fetchBadgeCounts();
  }, [fetchBadgeCounts]);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  const handleRealtimeUpdate = useCallback((table: string) => {
    const tab = TABLE_TO_TAB[table];
    if (tab) {
      loadedTabsRef.current.delete(tab);
      if (tab === activeTab) {
        fetchTab(tab, true);
      }
      fetchBadgeCounts();
    }
  }, [activeTab, fetchTab, fetchBadgeCounts]);

  useRealtimeBookings(
    user?.profileId ?? null,
    realtimeToken,
    handleRealtimeUpdate,
  );

  function renderTabItems(tab: BookingTab) {
    const isLoading = tabLoading[tab];
    if (isLoading) {
      return (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B33" />
        </View>
      );
    }
    const showEmpty = !fetchError;
    switch (tab) {
      case 'Celebrity':
        return data.celeb.length === 0 ? (showEmpty ? <EmptyState tab="Celebrity" colors={colors} /> : null) :
          data.celeb.map(item => <CelebCard key={item.id} item={item} colors={colors} accessToken={realtimeToken} />);
      case 'Wishes':
        return data.wishes.length === 0 ? (showEmpty ? <EmptyState tab="Wishes" colors={colors} /> : null) :
          data.wishes.map(item => <WishCard key={item.id} item={item} colors={colors} />);
      case 'Cards':
        return data.cards.length === 0 ? (showEmpty ? <EmptyState tab="Cards" colors={colors} /> : null) :
          data.cards.map(item => <CardCard key={item.id} item={item} colors={colors} />);
      case 'Photo':
        return data.photo.length === 0 ? (showEmpty ? <EmptyState tab="Photo" colors={colors} /> : null) :
          data.photo.map(item => <PhotoCard key={item.id} item={item} colors={colors} />);
      case 'Calls':
        return data.calls.length === 0 ? (showEmpty ? <EmptyState tab="Calls" colors={colors} /> : null) :
          data.calls.map(item => <CallCard key={item.id} item={item} colors={colors} />);
      case 'Music':
        return data.music.length === 0 ? (showEmpty ? <EmptyState tab="Music" colors={colors} /> : null) :
          data.music.map(item => <MusicCard key={item.id} item={item} colors={colors} />);
      case 'Img+Music':
        return data.imgMusic.length === 0 ? (showEmpty ? <EmptyState tab="Img+Music" colors={colors} /> : null) :
          data.imgMusic.map(item => <ImgMusicCard key={item.id} item={item} colors={colors} />);
      case 'TTS':
        return data.tts.length === 0 ? (showEmpty ? <EmptyState tab="TTS" colors={colors} /> : null) :
          data.tts.map(item => <TtsCard key={item.id} item={item} colors={colors} />);
      case 'SFX':
        return data.sfx.length === 0 ? (showEmpty ? <EmptyState tab="SFX" colors={colors} /> : null) :
          data.sfx.map(item => <SfxCard key={item.id} item={item} colors={colors} />);
      case 'Convert':
        return data.convert.length === 0 ? (showEmpty ? <EmptyState tab="Convert" colors={colors} /> : null) :
          data.convert.map(item => <ConvertCard key={item.id} item={item} colors={colors} />);
      case 'Isolate':
        return data.isolate.length === 0 ? (showEmpty ? <EmptyState tab="Isolate" colors={colors} /> : null) :
          data.isolate.map(item => <IsolateCard key={item.id} item={item} colors={colors} />);
      case 'Occasions':
        return data.occasions.length === 0 ? (showEmpty ? <EmptyState tab="Occasions" colors={colors} /> : null) :
          data.occasions.map(item => <OccasionCard key={item.id} item={item} colors={colors} />);
    }
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>My Bookings</Text>
        <TouchableOpacity onPress={handleRefreshButton} disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#FF6B33" />
          ) : (
            <Icon name="refresh-cw" size={18} color={colors.foreground} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.tabBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={s.tabBarContent}
      >
        {BOOKING_TABS.map(tab => {
          const active = tab === activeTab;
          const count = badgeCounts[tab];
          const label = count != null ? `${tab} (${count})` : tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[s.tabPill, active && { backgroundColor: '#FF6B33' }]}
            >
              <Text style={[s.tabPillText, { color: active ? '#fff' : colors.mutedForeground },
                active && s.tabPillTextActive]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {fetchError && (
        <TouchableOpacity
          style={s.errorBanner}
          onPress={() => {
            loadedTabsRef.current.delete(activeTab);
            fetchTab(activeTab, true);
          }}
          activeOpacity={0.8}
        >
          <Icon name="alert-circle" size={16} color="#fff" />
          <Text style={s.errorBannerText}>Couldn't load bookings — tap to retry</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderTabItems(activeTab)}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabBar: { borderBottomWidth: 1, height: 54, flexShrink: 0 },
  tabBarContent: { paddingHorizontal: 14, alignItems: 'center', gap: 8, paddingVertical: 9 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999 },
  tabPillText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  tabPillTextActive: { fontFamily: 'Inter_700Bold' },
  listContent: { padding: 14, gap: 14 },
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
  emptyBtn: { backgroundColor: '#FF6B33', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 9999, marginTop: 4 },
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
