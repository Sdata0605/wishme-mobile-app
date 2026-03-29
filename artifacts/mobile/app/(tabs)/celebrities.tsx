import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CelebCard } from '@/components/CelebCard';
import { Icon } from '@/components/Icon';
import { CATEGORIES } from '@/constants/mockData';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrities } from '@/hooks/useCelebrities';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - 52) / 2;
const PAGE_SIZE = 8;

const CATEGORY_MAP: Record<string, string> = {
  'All': '',
  'Actors': 'Actor',
  'Singers': 'Singer',
  'Athletes': 'Athlete',
  'Comedians': 'Comedian',
  'Influencers': 'Influencer',
  'TV Stars': 'TV Stars',
};

const DELIVERY_TIMES = [
  { label: 'All', maxPrice: Infinity },
  { label: 'Under 24h', maxPrice: 1500 },
  { label: '24-48h', maxPrice: 3000 },
  { label: '48-72h', maxPrice: 5000 },
  { label: '1 week+', maxPrice: Infinity },
];

export default function CelebritiesScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDelivery, setActiveDelivery] = useState('All');
  const [sortOrder, setSortOrder] = useState<'rating' | 'price_asc' | 'price_desc'>('rating');
  const [page, setPage] = useState(1);

  const { celebrities, loading, error, refetch } = useCelebrities({ limit: 50 });
  const { hasFavorite, refetch: refetchFavorites } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });

  useFocusEffect(
    useCallback(() => {
      if (user?.profileId && session?.access_token) {
        refetchFavorites();
      }
    }, [user?.profileId, session?.access_token, refetchFavorites]),
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const filtered = useMemo(() => {
    const list = celebrities.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());

      const catValue = CATEGORY_MAP[activeCategory] ?? '';
      const matchCat =
        activeCategory === 'All' ||
        c.category === catValue ||
        c.category.toLowerCase().includes(catValue.toLowerCase()) ||
        catValue.toLowerCase().includes(c.category.toLowerCase());

      const matchDelivery =
        activeDelivery === 'All' ||
        (activeDelivery === 'Under 24h' && c.pricePerWish < 1500) ||
        (activeDelivery === '24-48h' && c.pricePerWish >= 1500 && c.pricePerWish < 3000) ||
        (activeDelivery === '48-72h' && c.pricePerWish >= 3000 && c.pricePerWish < 5000) ||
        (activeDelivery === '1 week+' && c.pricePerWish >= 5000);

      return matchSearch && matchCat && matchDelivery;
    });

    if (sortOrder === 'price_asc') {
      return [...list].sort((a, b) => a.pricePerWish - b.pricePerWish);
    } else if (sortOrder === 'price_desc') {
      return [...list].sort((a, b) => b.pricePerWish - a.pricePerWish);
    }
    return list;
  }, [celebrities, search, activeCategory, activeDelivery, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setPage(1);
  };

  const onDeliveryChange = (label: string) => {
    setActiveDelivery(label);
    setPage(1);
  };

  const onSortChange = (order: 'rating' | 'price_asc' | 'price_desc') => {
    setSortOrder(order);
    setPage(1);
  };

  const SORT_OPTIONS: { key: 'rating' | 'price_asc' | 'price_desc'; label: string }[] = [
    { key: 'rating', label: 'Rating ↓' },
    { key: 'price_asc', label: 'Price ↑' },
    { key: 'price_desc', label: 'Price ↓' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Browse Celebrities</Text>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Search celebrities..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={(t) => { setSearch(t); setPage(1); }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setPage(1); }}>
              <Icon name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                {
                  backgroundColor: activeCategory === cat ? colors.primary : colors.muted,
                  borderColor: activeCategory === cat ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onCategoryChange(cat)}
            >
              <Text style={[styles.chipText, { color: activeCategory === cat ? '#fff' : colors.foreground }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Delivery Time chips */}
        <View style={styles.deliveryRow}>
          <View style={{ marginRight: 4 }}>
            <Icon name="clock" size={13} color={colors.mutedForeground} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {DELIVERY_TIMES.map((dt) => (
              <TouchableOpacity
                key={dt.label}
                style={[
                  styles.chip,
                  styles.chipSm,
                  {
                    backgroundColor: activeDelivery === dt.label ? '#FF6B33' : colors.muted,
                    borderColor: activeDelivery === dt.label ? '#FF6B33' : colors.border,
                  },
                ]}
                onPress={() => onDeliveryChange(dt.label)}
              >
                <Text style={[styles.chipText, { fontSize: 11, color: activeDelivery === dt.label ? '#fff' : colors.foreground }]}>
                  {dt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sort chips */}
        <View style={[styles.deliveryRow, { marginTop: 4 }]}>
          <Text style={[styles.sortLabel, { color: colors.mutedForeground }]}>Sort:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginLeft: 4 }]}>
            {SORT_OPTIONS.map((so) => (
              <TouchableOpacity
                key={so.key}
                style={[
                  styles.chip,
                  styles.chipSm,
                  {
                    backgroundColor: sortOrder === so.key ? '#B44CFF' : colors.muted,
                    borderColor: sortOrder === so.key ? '#B44CFF' : colors.border,
                  },
                ]}
                onPress={() => onSortChange(so.key)}
              >
                <Text style={[styles.chipText, { fontSize: 11, color: sortOrder === so.key ? '#fff' : colors.foreground }]}>
                  {so.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading celebrities...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <Icon name="alert-circle" size={40} color={colors.primary} />
            <Text style={[styles.errorTitle, { color: colors.foreground }]}>Could not load celebrities</Text>
            <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={refetch}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Results count */}
            <View style={styles.resultsRow}>
              <Text style={[styles.resultsText, { color: colors.mutedForeground }]}>
                {filtered.length} {filtered.length === 1 ? 'celebrity' : 'celebrities'} found
              </Text>
            </View>

            {/* Grid */}
            {paged.length > 0 ? (
              <View style={styles.grid}>
                {paged.map((item) => (
                  <CelebCard
                    key={item.id}
                    celebrity={item}
                    width={CARD_WIDTH}
                    isLoggedIn={!!user}
                    isSubscribed={hasFavorite(item.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <Icon name="search" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No celebrities found</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Try a different search or filter</Text>
              </View>
            )}

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, { backgroundColor: colors.card, opacity: page <= 1 ? 0.4 : 1 }]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <Icon name="chevron-left" size={16} color={colors.foreground} />
                  <Text style={[styles.pageBtnText, { color: colors.foreground }]}>Previous</Text>
                </TouchableOpacity>
                <Text style={[styles.pageLabel, { color: colors.mutedForeground }]}>
                  Page {page} of {totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, { backgroundColor: colors.card, opacity: page >= totalPages ? 0.4 : 1 }]}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <Text style={[styles.pageBtnText, { color: colors.foreground }]}>Next</Text>
                  <Icon name="chevron-right" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 44, borderRadius: 12, borderWidth: 1.5, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, height: 44 },
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  chipSm: { paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 },
  sortLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginRight: 2 },
  scrollContent: { paddingHorizontal: 20 },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  errorWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  errorTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  errorSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  resultsRow: { paddingVertical: 10 },
  resultsText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  pageBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  pageLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
