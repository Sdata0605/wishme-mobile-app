import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');
const CARD_SIZE = (W - 52) / 2;

const FAV_TABS = ['Browse Celebrities', 'My Favorites'] as const;
type FavTab = (typeof FAV_TABS)[number];

const MOCK_SUBSCRIBED_DATES: Record<string, string> = {
  '1': '10 Jan 2025',
  '2': '5 Dec 2024',
  '5': '20 Nov 2024',
  '7': '15 Oct 2024',
  '8': '2 Feb 2025',
  '9': '28 Sep 2024',
};

function BrowseTab({ colors, bottomPad }: { colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']; bottomPad: number }) {
  const [search, setSearch] = useState('');
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set(['1', '2']));

  const filtered = CELEBRITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) =>
    setSubscribed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <ScrollView contentContainerStyle={[styles.listPad, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search celebrities..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      <View style={styles.grid}>
        {filtered.map((celeb) => {
          const isSub = subscribed.has(celeb.id);
          return (
            <TouchableOpacity
              key={celeb.id}
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/celebrity/[id]', params: { id: celeb.id } })}
              style={[styles.browseCard, { backgroundColor: colors.card, borderColor: colors.border, width: CARD_SIZE }]}
            >
              <Image source={{ uri: celeb.imageUrl }} style={styles.browseImage} />
              <View style={styles.browseInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.browseName, { color: colors.foreground }]} numberOfLines={1}>{celeb.name}</Text>
                  {celeb.isVerified && (
                    <View style={styles.verifiedDot}>
                      <Icon name="check" size={8} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[styles.browseCat, { color: colors.mutedForeground }]}>{celeb.category}</Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={11} color="#F59E0B" />
                  <Text style={[styles.ratingText, { color: colors.foreground }]}>{celeb.rating}</Text>
                </View>
                <Text style={[styles.browsePrice, { color: '#FF6B33' }]}>₹{celeb.pricePerWish.toLocaleString('en-IN')}/wish</Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); toggle(celeb.id); }}
                  style={[styles.subBtn, { backgroundColor: isSub ? '#EF444420' : '#FF6B3320', borderColor: isSub ? '#EF4444' : '#FF6B33' }]}
                >
                  <Text style={[styles.subBtnText, { color: isSub ? '#EF4444' : '#FF6B33' }]}>
                    {isSub ? 'Unsubscribe' : 'Subscribe'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function MyFavoritesTab({ colors, bottomPad }: { colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']; bottomPad: number }) {
  const [favs, setFavs] = useState(CELEBRITIES.slice(0, 6));

  const remove = (id: string) => setFavs((prev) => prev.filter((f) => f.id !== id));

  if (favs.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Icon name="heart" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No favorites yet</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Subscribe to celebrities to save them here</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.listPad, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      <View style={styles.grid}>
        {favs.map((celeb) => {
          const dateSub = MOCK_SUBSCRIBED_DATES[celeb.id] ?? '1 Jan 2025';
          return (
            <TouchableOpacity
              key={celeb.id}
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/celebrity/[id]', params: { id: celeb.id } })}
              style={[styles.browseCard, { backgroundColor: colors.card, borderColor: colors.border, width: CARD_SIZE }]}
            >
              <Image source={{ uri: celeb.imageUrl }} style={styles.browseImage} />
              <View style={styles.browseInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.browseName, { color: colors.foreground }]} numberOfLines={1}>{celeb.name}</Text>
                  {celeb.isVerified && (
                    <View style={styles.verifiedDot}>
                      <Icon name="check" size={8} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[styles.browseCat, { color: colors.mutedForeground }]}>{celeb.category}</Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={11} color="#F59E0B" />
                  <Text style={[styles.ratingText, { color: colors.foreground }]}>{celeb.rating}</Text>
                </View>
                <Text style={[styles.subDate, { color: colors.mutedForeground }]}>Since {dateSub}</Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); remove(celeb.id); }}
                  style={[styles.subBtn, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}
                >
                  <Text style={[styles.subBtnText, { color: '#EF4444' }]}>Unsubscribe</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;
  const [activeTab, setActiveTab] = useState<FavTab>('Browse Celebrities');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Favorites</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {FAV_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, active && styles.tabItemActive]}
            >
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.mutedForeground },
                active && styles.tabLabelActive]}
              >
                {tab}
              </Text>
              {active && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'Browse Celebrities' ? (
        <BrowseTab colors={colors} bottomPad={bottomPad} />
      ) : (
        <MyFavoritesTab colors={colors} bottomPad={bottomPad} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabItemActive: {},
  tabLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  tabLabelActive: { fontFamily: 'Inter_700Bold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 2, borderRadius: 1 },
  listPad: { padding: 16, gap: 12 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  browseCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  browseImage: { width: 96, height: 96, alignSelf: 'center' },
  browseInfo: { padding: 10, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  browseName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  verifiedDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  browseCat: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  browsePrice: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  subDate: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  subBtn: {
    borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 5,
    alignItems: 'center', marginTop: 4,
  },
  subBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
