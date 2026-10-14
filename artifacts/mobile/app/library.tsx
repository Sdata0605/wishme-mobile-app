import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  fetchLibrary,
  getCachedLibrary,
  removeFromLibrary,
  resolveVideoUrl,
  type LibraryItem,
} from '@/services/library';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const { width: SCREEN_W } = Dimensions.get('window');
const GAP = 12;
const PAD = 16;
const TILE_W = (SCREEN_W - PAD * 2 - GAP) / 2;
const TILE_H = Math.round(TILE_W * 1.32);

type Filter = 'all' | 'image' | 'video';

function fmtDate(iso: string): string {
  try { return format(new Date(iso), 'd MMM yyyy'); } catch { return ''; }
}

function VideoPlayerView({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; p.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" />;
}

function SkeletonGrid({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.85, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <View style={s.gridWrap}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <Animated.View key={i} style={[s.tile, { backgroundColor: colors.border, opacity: anim }]} />
      ))}
    </View>
  );
}

const Tile = React.memo(function Tile({ item, onPress }: { item: LibraryItem; onPress: (item: LibraryItem) => void }) {
  const isVideo = item.kind === 'video';
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => onPress(item)} style={s.tile}>
      {item.thumbnailUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.key}
          transition={120}
        />
      ) : (
        <LinearGradient colors={['#3B5BDB', '#7C3AED']} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} style={s.tileShade} />

      <View style={s.kindBadge}>
        <Icon name={isVideo ? 'video' : 'image'} size={11} color="#fff" />
        <Text style={s.kindBadgeText}>{isVideo ? 'Video' : 'Card'}</Text>
      </View>

      {isVideo && (
        <View style={s.playWrap} pointerEvents="none">
          <View style={s.playCircle}><Icon name="play" size={20} color="#fff" /></View>
        </View>
      )}

      <View style={s.tileMeta}>
        <Text style={s.tileTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.tileSub} numberOfLines={1}>{item.subtitle ?? fmtDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function LibraryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const profileId = user?.profileId ?? '';
  const token = session?.access_token ?? null;

  const [items, setItems] = useState<LibraryItem[]>(() => (profileId ? getCachedLibrary(profileId) ?? [] : []));
  const [loading, setLoading] = useState(() => !(profileId && getCachedLibrary(profileId)));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const [active, setActive] = useState<LibraryItem | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState<'save' | 'share' | 'remove' | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!profileId || !token) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    try {
      const fresh = await fetchLibrary(profileId, token);
      setItems(fresh);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId, token]);

  // Show the cached list at once, then refresh quietly in the background.
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: items.length,
    image: items.filter(i => i.kind === 'image').length,
    video: items.filter(i => i.kind === 'video').length,
  }), [items]);
  const visible = useMemo(() => (filter === 'all' ? items : items.filter(i => i.kind === filter)), [items, filter]);

  const open = useCallback(async (item: LibraryItem) => {
    setActive(item);
    setVideoUri(null);
    if (item.kind === 'video' && token) {
      setResolving(true);
      const url = await resolveVideoUrl(item, token);
      setVideoUri(url);
      setResolving(false);
      if (!url) showToast('This video is not available right now.');
    }
  }, [token, showToast]);

  const close = () => { setActive(null); setVideoUri(null); };

  const mediaForDevice = async (item: LibraryItem): Promise<string | null> => {
    const remote = item.kind === 'video' ? (videoUri ?? await resolveVideoUrl(item, token ?? '')) : item.mediaUrl;
    if (!remote) return null;
    const ext = item.kind === 'video' ? 'mp4' : 'png';
    const target = `${FileSystem.cacheDirectory}wishme_${Date.now()}.${ext}`;
    const { uri } = await FileSystem.downloadAsync(remote, target);
    return uri;
  };

  const saveToGallery = async () => {
    if (!active) return;
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to save to your gallery.');
      return;
    }
    setBusy('save');
    try {
      const uri = await mediaForDevice(active);
      if (!uri) throw new Error('no media');
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast('Saved to your gallery');
    } catch {
      showToast('Could not save. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!active) return;
    setBusy('share');
    try {
      if (!(await Sharing.isAvailableAsync())) { showToast('Sharing is not available on this device.'); return; }
      const uri = await mediaForDevice(active);
      if (!uri) throw new Error('no media');
      await Sharing.shareAsync(uri);
    } catch {
      showToast('Could not share. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!active || !token) return;
    const target = active;
    Alert.alert('Remove from Library?', 'It stays in My Bookings. This only removes it from your Library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy('remove');
          try {
            await removeFromLibrary(target, token);
            setItems(prev => prev.filter(i => i.key !== target.key));
            close();
            showToast('Removed from Library');
          } catch {
            showToast('Could not remove. Please try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const FILTERS: { key: Filter; label: string; icon: 'layers' | 'image' | 'video' }[] = [
    { key: 'all', label: 'All', icon: 'layers' },
    { key: 'image', label: 'Cards', icon: 'image' },
    { key: 'video', label: 'Videos', icon: 'video' },
  ];

  const header = (
    <View style={[s.header, { paddingTop: topPad + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="arrow-left" size={20} color={colors.foreground} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: colors.foreground }]}>Library</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
          {counts.all === 0 ? 'Your saved cards and videos' : `${counts.image} cards · ${counts.video} videos`}
        </Text>
      </View>
    </View>
  );

  if (!user || !session) {
    return (
      <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
        {header}
        <View style={s.emptyWrap}>
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Sign in to see your Library</Text>
          <TouchableOpacity style={[s.cta, { backgroundColor: colors.primary }]} onPress={() => router.push('/(auth)' as never)}>
            <Text style={s.ctaText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
      {header}

      <View style={s.filters}>
        {FILTERS.map(f => {
          const activeF = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.85}
              style={[s.chip, activeF
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Icon name={f.icon} size={14} color={activeF ? '#fff' : colors.mutedForeground} />
              <Text style={[s.chipText, { color: activeF ? '#fff' : colors.foreground }]}>{f.label}</Text>
              <Text style={[s.chipCount, { color: activeF ? 'rgba(255,255,255,0.85)' : colors.mutedForeground }]}>{counts[f.key]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <SkeletonGrid colors={colors} />
      ) : error && items.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Couldn't load your Library</Text>
          <TouchableOpacity style={[s.cta, { backgroundColor: colors.primary }]} onPress={() => { setLoading(true); void load(); }}>
            <Text style={s.ctaText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={i => i.key}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 4, paddingBottom: insets.bottom + 28, gap: GAP, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          renderItem={({ item }) => <Tile item={item} onPress={open} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyIcon}>
                <Icon name={filter === 'video' ? 'video' : 'image'} size={34} color="#fff" />
              </LinearGradient>
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {filter === 'video' ? 'No saved videos yet' : filter === 'image' ? 'No saved cards yet' : 'Your Library is empty'}
              </Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {filter === 'video'
                  ? 'Open a delivered video in My Bookings and tap Save to Library.'
                  : 'Tap Save to Library on a greeting card or a delivered video and it shows up here.'}
              </Text>
              <View style={s.emptyBtns}>
                <TouchableOpacity style={[s.cta, { backgroundColor: colors.primary }]} onPress={() => router.push('/greeting-cards' as never)}>
                  <Text style={s.ctaText}>Create a card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.cta, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => router.push('/bookings' as never)}
                >
                  <Text style={[s.ctaText, { color: colors.foreground }]}>My Bookings</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}

      {toast.length > 0 && !active && (
        <View style={[s.toast, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      <Modal visible={!!active} animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={s.viewer}>
          {active && (
            <>
              <View style={s.viewerStage}>
                {active.kind === 'image' ? (
                  <Image source={{ uri: active.mediaUrl ?? undefined }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
                ) : videoUri ? (
                  <VideoPlayerView uri={videoUri} />
                ) : (
                  <View style={s.viewerLoading}>
                    {resolving ? <ActivityIndicator size="large" color="#fff" /> : <Icon name="video" size={44} color="rgba(255,255,255,0.5)" />}
                  </View>
                )}
              </View>

              <View style={[s.viewerTop, { paddingTop: topPad + 6 }]}>
                <TouchableOpacity onPress={close} hitSlop={12} style={s.viewerClose}>
                  <Icon name="x" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={s.viewerTitle} numberOfLines={1}>{active.title}</Text>
                  <Text style={s.viewerSub} numberOfLines={1}>
                    {[active.subtitle, fmtDate(active.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>

              <View style={[s.viewerActions, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity style={s.action} onPress={saveToGallery} disabled={busy !== null || (active.kind === 'video' && !videoUri)}>
                  {busy === 'save' ? <ActivityIndicator color="#fff" /> : <Icon name="download" size={20} color="#fff" />}
                  <Text style={s.actionText}>Save to gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={share} disabled={busy !== null || (active.kind === 'video' && !videoUri)}>
                  {busy === 'share' ? <ActivityIndicator color="#fff" /> : <Icon name="share-2" size={20} color="#fff" />}
                  <Text style={s.actionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.action} onPress={remove} disabled={busy !== null}>
                  {busy === 'remove' ? <ActivityIndicator color="#fff" /> : <Icon name="trash-2" size={20} color="#FCA5A5" />}
                  <Text style={[s.actionText, { color: '#FCA5A5' }]}>Remove</Text>
                </TouchableOpacity>
              </View>

              {toast.length > 0 && (
                <View style={[s.toast, { bottom: insets.bottom + 100 }]} pointerEvents="none">
                  <Text style={s.toastText}>{toast}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: PAD, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: PAD, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chipCount: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD },
  tile: { width: TILE_W, height: TILE_H, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1f2937' },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  kindBadge: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  kindBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  playWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  tileMeta: { position: 'absolute', left: 12, right: 12, bottom: 11 },
  tileTitle: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  tileSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 48, gap: 12 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  emptyBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cta: { paddingHorizontal: 20, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  toast: { position: 'absolute', left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerStage: { ...StyleSheet.absoluteFillObject },
  viewerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerTop: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 18, backgroundColor: 'rgba(0,0,0,0.45)',
  },
  viewerClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  viewerTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  viewerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  viewerActions: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  action: { alignItems: 'center', gap: 6, minWidth: 90, minHeight: 48, justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_500Medium' },
});
