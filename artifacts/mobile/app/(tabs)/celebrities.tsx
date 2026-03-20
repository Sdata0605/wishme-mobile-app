import React, { useState, useMemo } from 'react';
import {
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
import { CATEGORIES, CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');
const CARD_WIDTH = (W - 52) / 2;
const PAGE_SIZE = 6;

const DELIVERY_TIMES = [
  { label: 'All', maxPrice: Infinity },
  { label: 'Under 24h', maxPrice: 1500 },
  { label: '24–48h', maxPrice: 3000 },
  { label: '48–72h', maxPrice: 5000 },
  { label: '1 week+', maxPrice: Infinity },
];

export default function CelebritiesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeDelivery, setActiveDelivery] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const filtered = useMemo(() => {
    return CELEBRITIES.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());
      const matchCat =
        activeCategory === 'All' ||
        c.category.toLowerCase() === activeCategory.toLowerCase().replace(/s$/, '');
      const deliveryOption = DELIVERY_TIMES.find((d) => d.label === activeDelivery);
      const matchDelivery =
        activeDelivery === 'All' ||
        (activeDelivery === 'Under 24h' && c.pricePerWish < 1500) ||
        (activeDelivery === '24–48h' && c.pricePerWish >= 1500 && c.pricePerWish < 3000) ||
        (activeDelivery === '48–72h' && c.pricePerWish >= 3000 && c.pricePerWish < 5000) ||
        (activeDelivery === '1 week+' && c.pricePerWish >= 5000);
      return matchSearch && matchCat && matchDelivery;
    });
  }, [search, activeCategory, activeDelivery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const onCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setPage(1);
  };

  const onDeliveryChange = (label: string) => {
    setActiveDelivery(label);
    setPage(1);
  };

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
          <Icon name="clock" size={13} color={colors.mutedForeground} style={{ marginRight: 4 }} />
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
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
              <CelebCard key={item.id} celebrity={item} width={CARD_WIDTH} />
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
  scrollContent: { paddingHorizontal: 20 },
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
