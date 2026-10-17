import { format } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { SaveToLibraryButton } from '@/components/SaveToLibraryButton';
import { supabaseFetch } from '@/constants/supabase';
import { useTheme } from '@/context/ThemeContext';
import { resolveVideoUrl } from '@/services/library';

type Kind = 'ad' | 'video';
type Stage = 'awaiting' | 'production' | 'ready' | 'failed';
type Filter = 'all' | 'progress' | 'ready' | 'failed';

interface Item {
  id: string;
  title: string;
  subtitle: string;
  stage: Stage;
  price: number;
  createdAt: string;
  ratio: string;
  videoUrl: string | null;
  fileKey: string | null;
  thumb: string | null;
  note: string | null;
}

interface Props {
  kind: Kind;
  gradient: readonly [string, string];
  accent: string;
  token: string | null;
  authUid: string;
  profileId: string;
  refreshKey: number;
  onCreate: () => void;
}

const STAGE: Record<Stage, { label: string; icon: IconName; color: string }> = {
  awaiting: { label: 'Awaiting review', icon: 'clock', color: '#F59E0B' },
  production: { label: 'In production', icon: 'loader', color: '#FF5F1F' },
  ready: { label: 'Ready', icon: 'check-circle', color: '#22C55E' },
  failed: { label: 'Failed', icon: 'alert-circle', color: '#EF4444' },
};

function ratioNum(r: string): number {
  const [a, b] = r.split(':').map(Number);
  return a && b ? a / b : 9 / 16;
}

function toStage(kind: Kind, status: string): Stage {
  if (status === 'completed') return 'ready';
  if (status === 'failed' || status === 'rejected') return 'failed';
  if (kind === 'ad') {
    return ['processing', 'script_generating', 'video_generating', 'video_processing'].includes(status) ? 'production' : 'awaiting';
  }
  return status === 'processing' ? 'production' : 'awaiting';
}

function fmt(iso: string): string {
  try { return format(new Date(iso), 'd MMM yyyy'); } catch { return ''; }
}

function Player({ uri, ratio }: { uri: string; ratio: number }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', aspectRatio: ratio, maxHeight: 420, borderRadius: 12, backgroundColor: '#000' }} />;
}

function OrderCard({
  item, kind, accent, gradient, token, playing, onTogglePlay,
}: { item: Item; kind: Kind; accent: string; gradient: readonly [string, string]; token: string | null; playing: boolean; onTogglePlay: () => void }) {
  const { colors } = useTheme();
  const st = STAGE[item.stage];
  const ratio = ratioNum(item.ratio);
  const posterH = 132;
  const posterW = Math.min(150, Math.max(78, posterH * ratio));
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (!playing || !token) return;
    let cancelled = false;
    resolveVideoUrl({ mediaUrl: item.videoUrl, fileKey: item.fileKey }, token).then(u => { if (!cancelled) setUri(u); });
    return () => { cancelled = true; };
  }, [playing, token, item.videoUrl, item.fileKey]);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardRow}>
        <TouchableOpacity
          activeOpacity={item.stage === 'ready' ? 0.85 : 1}
          onPress={item.stage === 'ready' ? onTogglePlay : undefined}
          style={[s.poster, { width: posterW, height: posterH }]}
        >
          {item.thumb ? (
            <Image source={{ uri: item.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
          )}
          <View style={s.posterShade} />
          <View style={s.posterCenter}>
            <Icon name={item.stage === 'ready' ? 'play' : kind === 'ad' ? 'video' : 'clock'} size={item.stage === 'ready' ? 22 : 20} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1, gap: 3 }}>
          <View style={s.titleRow}>
            <Text style={[s.title, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
          </View>
          <Text style={[s.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.subtitle}</Text>
          <Text style={[s.sub, { color: colors.mutedForeground }]}>{fmt(item.createdAt)} · {item.ratio}</Text>
          <View style={s.metaRow}>
            <View style={[s.chip, { backgroundColor: st.color + '1F' }]}>
              <Icon name={st.icon} size={11} color={st.color} />
              <Text style={[s.chipText, { color: st.color }]}>{st.label}</Text>
            </View>
            {item.price > 0 && <Text style={[s.price, { color: accent }]}>₹{item.price.toLocaleString('en-IN')}</Text>}
          </View>
          <Text style={[s.orderId, { color: colors.mutedForeground }]}>#{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>
      </View>

      {item.stage === 'failed' && item.note ? (
        <Text style={[s.note, { color: '#EF4444' }]}>{item.note}</Text>
      ) : null}

      {item.stage === 'ready' && (
        <>
          {playing ? (
            <View style={{ marginTop: 12 }}>
              {uri ? <Player uri={uri} ratio={ratio} /> : <ActivityIndicator color={accent} style={{ paddingVertical: 24 }} />}
            </View>
          ) : (
            <TouchableOpacity onPress={onTogglePlay} style={[s.watch, { borderColor: accent }]}>
              <Icon name="play-circle" size={16} color={accent} />
              <Text style={{ color: accent, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Watch video</Text>
            </TouchableOpacity>
          )}
          <SaveToLibraryButton
            video={{
              sourceType: kind === 'ad' ? 'ugc_ad' : 'ugc_video',
              sourceId: item.id,
              title: item.title,
              subtitle: item.subtitle,
              mediaUrl: item.videoUrl,
              fileKey: item.fileKey,
              thumbnailUrl: item.thumb,
            }}
          />
        </>
      )}
    </View>
  );
}

export function UgcHistory({ kind, gradient, accent, token, authUid, profileId, refreshKey, onCreate }: Props) {
  const { colors } = useTheme();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    try {
      let rows: any[];
      if (kind === 'ad') {
        const res = await supabaseFetch(
          `/rest/v1/ugc_ads?user_id=eq.${authUid}&select=id,product_name,aspect_ratio,status,price_paid,video_url,video_file_key,created_at,generation_error,celebrities(name,image_url)&order=created_at.desc&limit=30`,
          {}, token,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rows = await res.json();
        setItems(rows.map((r): Item => ({
          id: r.id,
          title: r.product_name,
          subtitle: r.celebrities?.name ? `With ${r.celebrities.name}` : 'UGC ad',
          stage: toStage('ad', r.status),
          price: Math.round(Number(r.price_paid) || 0),
          createdAt: r.created_at,
          ratio: r.aspect_ratio || '9:16',
          videoUrl: r.video_url,
          fileKey: r.video_file_key,
          thumb: r.celebrities?.image_url ?? null,
          note: r.generation_error,
        })));
      } else {
        const res = await supabaseFetch(
          `/rest/v1/wish_friend_orders?user_id=eq.${profileId}&order_type=eq.ugc_video&select=id,recipient_name,occasion,aspect_ratio,status,price_paid,video_url,video_file_key,admin_notes,created_at,celebrities:celebrity_id(name,image_url)&order=created_at.desc&limit=30`,
          {}, token,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rows = await res.json();
        setItems(rows.map((r): Item => ({
          id: r.id,
          title: `${r.occasion} video for ${r.recipient_name}`,
          subtitle: r.celebrities?.name ? `With ${r.celebrities.name}` : 'UGC video',
          stage: toStage('video', r.status),
          price: r.price_paid || 0,
          createdAt: r.created_at,
          ratio: r.aspect_ratio || '9:16',
          videoUrl: r.video_url,
          fileKey: r.video_file_key,
          thumb: r.celebrities?.image_url ?? null,
          note: r.admin_notes,
        })));
      }
      setError(false);
    } catch (e) {
      console.warn('[ugc] history load failed', e);
      setError(true);
      setItems(prev => prev ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [kind, token, authUid, profileId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'progress', label: 'In progress' },
    { key: 'ready', label: 'Ready' },
    { key: 'failed', label: 'Failed' },
  ];
  const visible = (items ?? []).filter(i => {
    if (filter === 'all') return true;
    if (filter === 'progress') return i.stage === 'awaiting' || i.stage === 'production';
    return i.stage === filter;
  });

  if (items === null) {
    return <ActivityIndicator color={accent} style={{ marginTop: 40 }} />;
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={s.filters}>
        {FILTERS.map(f => {
          const on = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[s.filterChip, on ? { backgroundColor: accent, borderColor: accent } : { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={{ color: on ? '#fff' : colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => load(true)} disabled={refreshing} hitSlop={8} style={{ marginLeft: 'auto', justifyContent: 'center' }}>
          {refreshing ? <ActivityIndicator size="small" color={accent} /> : <Icon name="refresh-cw" size={16} color={colors.mutedForeground} />}
        </TouchableOpacity>
      </View>

      {error && items.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 24 }}>Could not load your orders. Tap refresh to try again.</Text>
      ) : visible.length === 0 ? (
        <View style={s.empty}>
          <LinearGradient colors={gradient} style={s.emptyIcon}><Icon name="video" size={30} color="#fff" /></LinearGradient>
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>{items.length === 0 ? 'No orders yet' : 'Nothing here'}</Text>
          <Text style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 13 }}>
            {items.length === 0 ? 'Your video requests will show up here.' : 'Try another filter.'}
          </Text>
          {items.length === 0 && (
            <TouchableOpacity onPress={onCreate} style={[s.createBtn, { backgroundColor: accent }]}>
              <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold' }}>Create your first order</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        visible.map(item => (
          <OrderCard
            key={item.id}
            item={item}
            kind={kind}
            accent={accent}
            gradient={gradient}
            token={token}
            playing={playingId === item.id}
            onTogglePlay={() => setPlayingId(prev => (prev === item.id ? null : item.id))}
          />
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  poster: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#1f2937' },
  posterShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  posterCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row' },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', flex: 1 },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  price: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  orderId: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  note: { fontSize: 12, marginTop: 10 },
  watch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginTop: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  createBtn: { paddingHorizontal: 20, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
});
