import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CelebGridCard, CelebHeroCard } from '@/components/celebrity/CelebrityCards';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrities, type Celebrity } from '@/hooks/useCelebrities';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const { width: W } = Dimensions.get('window');
const PAD = 16;
const GAP = 12;
const CARD_W = (W - PAD * 2 - GAP) / 2;
const PAGE = 20;

type SortKey = 'top' | 'fast' | 'low' | 'high';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'top', label: 'Top rated' },
  { key: 'fast', label: 'Fastest delivery' },
  { key: 'low', label: 'Price: low to high' },
  { key: 'high', label: 'Price: high to low' },
];

const priceOf = (c: Celebrity) => c.subscription?.price ?? 0;
/** "24-48 hours" -> 24, "1 week" -> 168, unknown -> last. */
function hoursOf(c: Celebrity): number {
  const t = (c.deliveryTime ?? '').toLowerCase();
  const n = parseInt(t.match(/\d+/)?.[0] ?? '', 10);
  if (!Number.isFinite(n)) return 9999;
  if (t.includes('week')) return n * 168;
  if (t.includes('day')) return n * 24;
  return n;
}

function Skeleton() {
  const { colors } = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.5, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={{ opacity: v, paddingHorizontal: PAD, gap: GAP }}>
      <View style={{ aspectRatio: 16 / 10, borderRadius: 20, backgroundColor: colors.border }} />
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {[0, 1].map(i => <View key={i} style={{ width: CARD_W, height: CARD_W * 1.33 + 40, borderRadius: 16, backgroundColor: colors.border }} />)}
      </View>
    </Animated.View>
  );
}

function StateView({ icon, title, body, button, onPress }: { icon: 'search' | 'alert-circle' | 'star'; title: string; body: string; button: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={s.state}>
      <LinearGradient colors={['#FF6B33', '#E8527A', '#B44CFF']} style={s.stateRing}>
        <View style={[s.stateInner, { backgroundColor: colors.background }]}>
          <Icon name={icon} size={30} color={colors.primary} />
        </View>
      </LinearGradient>
      <Text style={[s.stateTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[s.stateBody, { color: colors.mutedForeground }]}>{body}</Text>
      <TouchableOpacity onPress={onPress} style={[s.stateBtn, { backgroundColor: colors.primary }]}>
        <Text style={s.stateBtnText}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CelebritiesScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 24 : insets.top;

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('top');
  const [sortOpen, setSortOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  const { celebrities, loading, error, refetch } = useCelebrities({ limit: 50 });
  const { hasFavorite, refetch: refetchFavorites } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });

  useFocusEffect(
    useCallback(() => {
      if (user?.profileId && session?.access_token) refetchFavorites();
    }, [user?.profileId, session?.access_token, refetchFavorites]),
  );

  // Only categories that really have a celebrity.
  const categories = useMemo(() => ['All', ...Array.from(new Set(celebrities.map(c => c.category).filter(Boolean)))], [celebrities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = celebrities.filter(c =>
      (category === 'All' || c.category === category) &&
      (!q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)),
    );
    const byTop = (a: Celebrity, b: Celebrity) => (b.rating - a.rating) || (b.reviewCount - a.reviewCount) || a.name.localeCompare(b.name);
    return [...list].sort(
      sort === 'low' ? (a, b) => priceOf(a) - priceOf(b)
        : sort === 'high' ? (a, b) => priceOf(b) - priceOf(a)
        : sort === 'fast' ? (a, b) => hoursOf(a) - hoursOf(b) || byTop(a, b)
        : byTop,
    );
  }, [celebrities, search, category, sort]);

  const showHero = category === 'All' && !search.trim() && sort === 'top' && filtered.length > 0;
  const hero = showHero ? filtered[0] : null;
  const gridItems = (showHero ? filtered.slice(1) : filtered).slice(0, visible);
  const hasMore = (showHero ? filtered.length - 1 : filtered.length) > visible;

  const clearFilters = () => { setSearch(''); setCategory('All'); setSort('top'); setVisible(PAGE); };
  const sortLabel = SORTS.find(x => x.key === sort)!.label;

  const header = (
    <View>
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headSide}>
          {router.canGoBack() && (
            <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
              <Icon name="chevron-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[s.title, { color: colors.foreground }]}>Celebrities</Text>
        <View style={s.headSide} />
      </View>

      <View style={[s.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="Search celebrities"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={t => { setSearch(t); setVisible(PAGE); }}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
            <Icon name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={c => c}
        contentContainerStyle={s.chips}
        renderItem={({ item }) => {
          const on = item === category;
          return (
            <TouchableOpacity
              onPress={() => { setCategory(item); setVisible(PAGE); }}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[s.chip, on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }]}
            >
              <Text style={{ color: on ? '#fff' : colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={s.resultRow}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          {filtered.length} {filtered.length === 1 ? 'celebrity' : 'celebrities'}
        </Text>
        <TouchableOpacity onPress={() => setSortOpen(true)} style={s.sortBtn} hitSlop={8}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Sort: {sortLabel}</Text>
          <Icon name="chevron-down" size={14} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {hero && (
        <View style={{ paddingHorizontal: PAD, marginBottom: GAP }}>
          <CelebHeroCard celebrity={hero} subscribed={hasFavorite(hero.id)} />
        </View>
      )}
    </View>
  );

  return (
    <AmbientBackground><View style={[s.root, { backgroundColor: 'transparent' }]}>
      {loading && celebrities.length === 0 ? (
        <>
          {header}
          <Skeleton />
        </>
      ) : error && celebrities.length === 0 ? (
        <>
          {header}
          <StateView icon="alert-circle" title="Couldn't load celebrities" body={error} button="Retry" onPress={refetch} />
        </>
      ) : celebrities.length === 0 ? (
        <>
          {header}
          <StateView
            icon="star"
            title="No celebrities available for subscription yet"
            body="We're onboarding verified stars. Check back soon."
            button="Go to Home"
            onPress={() => router.replace('/(tabs)' as never)}
          />
        </>
      ) : (
        <FlatList
          data={gridItems}
          keyExtractor={c => c.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          initialNumToRender={6}
          windowSize={7}
          removeClippedSubviews
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore) setVisible(v => v + PAGE); }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <CelebGridCard celebrity={item} subscribed={hasFavorite(item.id)} width={CARD_W} />}
          ListEmptyComponent={
            !hero ? (
              <StateView
                icon="search"
                title={search.trim() ? `No results for "${search.trim()}"` : 'No celebrities here'}
                body="Try a different search or category."
                button="Clear filters"
                onPress={clearFilters}
              />
            ) : null
          }
        />
      )}

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)} statusBarTranslucent>
        <Pressable style={s.backdrop} onPress={() => setSortOpen(false)}>
          <Pressable onPress={() => {}} style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>Sort by</Text>
            {SORTS.map(o => {
              const on = o.key === sort;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => { setSort(o.key); setVisible(PAGE); setSortOpen(false); }}
                  style={[s.sortRow, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '14' : colors.card }]}
                >
                  <Text style={{ color: on ? colors.primary : colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{o.label}</Text>
                  {on && <Icon name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, paddingBottom: 8 },
  headSide: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: PAD, height: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: 44, fontSize: 15, fontFamily: 'Inter_400Regular' },
  chips: { gap: 8, paddingHorizontal: PAD, paddingVertical: 12 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, marginBottom: 10 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, justifyContent: 'center' },
  state: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48, gap: 10 },
  stateRing: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', padding: 3 },
  stateInner: { width: '100%', height: '100%', borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 6 },
  stateBody: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  stateBtn: { paddingHorizontal: 24, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  stateBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 8 },
  sheetTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.2 },
});
