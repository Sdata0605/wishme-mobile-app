import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';

function imgUri(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return B2_BASE + url;
}

function daysUntil(date: string): number {
  const target = new Date(date + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(date: string, long?: boolean): string {
  const d = new Date(date + 'T00:00:00');
  if (long) {
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

const GRADIENT_PAIRS: [string, string][] = [
  ['#7B5CFA', '#D23FE0'],
  ['#D23FE0', '#1F7BFF'],
  ['#1F7BFF', '#7C3AED'],
  ['#3B5BDB', '#7C3AED'],
  ['#7B5CFA', '#1F7BFF'],
  ['#7C3AED', '#3B5BDB'],
];

function gradientForName(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length];
}

interface Occasion {
  id: string;
  name: string;
  description: string;
  date: string;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
}

export default function OccasionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOccasions = useCallback(async () => {
    try {
      const res = await supabaseFetch(
        '/rest/v1/occasions?is_active=eq.true&order=date.asc',
        {},
        session?.access_token ?? null,
      );
      if (res.ok) {
        const data = await res.json() as Occasion[];
        setOccasions(data ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => { loadOccasions(); }, [loadOccasions]);

  const onRefresh = () => { setRefreshing(true); loadOccasions(); };

  const featured = occasions.filter(o => o.is_featured);

  const featuredPairs: (Occasion | null)[][] = [];
  for (let i = 0; i < featured.length; i += 2) {
    featuredPairs.push([featured[i] ?? null, featured[i + 1] ?? null]);
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasions</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Hero */}
          <LinearGradient
            colors={['#7B5CFA', '#1F7BFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            <Icon name="star" size={32} color="#fff" />
            <Text style={s.heroTitle}>Celebrate Special Occasions</Text>
            <Text style={s.heroSub}>Book a celebrity wish for every moment that matters — birthdays, weddings, anniversaries and more</Text>
          </LinearGradient>

          {/* Featured */}
          {featured.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Featured Occasions</Text>
              <View style={s.featuredGrid}>
                {featuredPairs.map((pair, ri) => (
                  <View key={ri} style={s.gridRow}>
                    {pair.map((occ, ci) => {
                      if (!occ) return <View key={ci} style={{ flex: 1 }} />;
                      const uri = imgUri(occ.image_url);
                      const grad = gradientForName(occ.name);
                      return (
                        <View key={occ.id} style={[s.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          {uri ? (
                            <Image source={{ uri }} style={s.featuredImgArea} contentFit="cover" />
                          ) : (
                            <LinearGradient
                              colors={grad}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={s.featuredImgArea}
                            />
                          )}
                          <View style={s.featuredOverlay}>
                            <Text style={s.featuredName} numberOfLines={1}>{occ.name}</Text>
                            <Text style={s.featuredDesc} numberOfLines={2}>{occ.description}</Text>
                          </View>
                          <View style={s.featuredBottom}>
                            <View style={s.dateRow}>
                              <Icon name="calendar" size={13} color={colors.mutedForeground} />
                              <Text style={[s.dateText, { color: colors.mutedForeground }]}>{fmtDate(occ.date, true)}</Text>
                            </View>
                            <TouchableOpacity
                              style={[s.bookBtn, { backgroundColor: colors.primary }]}
                              onPress={() => router.push(`/occasion-book/${occ.id}` as never)}
                            >
                              <Text style={s.bookBtnText}>Book Now</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* All Occasions */}
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>All Upcoming Occasions</Text>
          {occasions.length === 0 ? (
            <View style={s.emptyState}>
              <Icon name="calendar" size={48} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No upcoming occasions right now</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {occasions.map((occ) => {
                const uri = imgUri(occ.image_url);
                const grad = gradientForName(occ.name);
                const days = daysUntil(occ.date);
                return (
                  <View key={occ.id} style={[s.upcomingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {uri ? (
                      <Image source={{ uri }} style={s.upcomingImg} contentFit="cover" />
                    ) : (
                      <LinearGradient
                        colors={grad}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.upcomingImg}
                      />
                    )}
                    <View style={s.upcomingBody}>
                      <View style={s.upcomingTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.upcomingName, { color: colors.foreground }]} numberOfLines={1}>{occ.name}</Text>
                          <Text style={[s.upcomingDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{occ.description}</Text>
                          <View style={s.dateRow}>
                            <Icon name="calendar" size={12} color={colors.mutedForeground} />
                            <Text style={[s.dateText, { color: colors.mutedForeground }]}>{fmtDate(occ.date)}</Text>
                          </View>
                        </View>
                        <View style={s.daysBox}>
                          <Text style={[s.daysNum, { color: colors.primary }]}>{days >= 0 ? days : 0}</Text>
                          <Text style={[s.daysLabel, { color: colors.mutedForeground }]}>days</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[s.freeBtn, { borderColor: colors.primary }]}
                        onPress={() => router.push(`/occasion-book/${occ.id}` as never)}
                      >
                        <Text style={[s.freeBtnText, { color: colors.primary }]}>Book for Free</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Info Banner */}
          <LinearGradient
            colors={['#1F7BFF', '#D23FE0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.banner}
          >
            <Icon name="zap" size={28} color="#fff" />
            <Text style={s.bannerText}>Book UNLIMITED celebrity videos for every occasion for FREE</Text>
            <TouchableOpacity style={s.bannerBtn} onPress={() => router.push('/wish-celebrity' as never)}>
              <Text style={s.bannerBtnText}>Get Started</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      )}
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  hero: { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  heroTitle: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  featuredGrid: { paddingHorizontal: 12, gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  featuredCard: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  featuredImgArea: { height: 140, width: '100%' },
  featuredOverlay: { padding: 10, gap: 3 },
  featuredName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  featuredDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', lineHeight: 15 },
  featuredBottom: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  bookBtn: { borderRadius: 9999, paddingVertical: 8, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  upcomingCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  upcomingImg: { width: 90, height: '100%', minHeight: 110 },
  upcomingBody: { flex: 1, padding: 12, gap: 8 },
  upcomingTop: { flexDirection: 'row', gap: 8 },
  upcomingName: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  upcomingDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginBottom: 4 },
  daysBox: { alignItems: 'center', minWidth: 44 },
  daysNum: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  daysLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  freeBtn: { borderRadius: 9999, borderWidth: 1.5, paddingVertical: 7, alignItems: 'center' },
  freeBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  banner: { margin: 16, marginTop: 24, borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  bannerText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center', lineHeight: 24 },
  bannerBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 9999, paddingHorizontal: 28, paddingVertical: 12 },
  bannerBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
