import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { FEATURED_OCCASIONS, MOCK_OCCASIONS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const OCCASION_ICONS: Record<string, IconName> = {
  Birthday: 'gift',
  Anniversary: 'heart',
  Wedding: 'star',
  Graduation: 'award',
};
const OCCASION_COLORS: Record<string, [string, string]> = {
  Birthday: ['#FF6B33', '#E8527A'],
  Anniversary: ['#E8527A', '#B44CFF'],
  Wedding: ['#B44CFF', '#7B2FFF'],
  Graduation: ['#4B83FF', '#7B2FFF'],
};

export default function OccasionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const featuredPairs: (typeof FEATURED_OCCASIONS[0] | null)[][] = [];
  for (let i = 0; i < FEATURED_OCCASIONS.length; i += 2) {
    featuredPairs.push([FEATURED_OCCASIONS[i] ?? null, FEATURED_OCCASIONS[i + 1] ?? null]);
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasions</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Icon name="star" size={32} color="#fff" />
          <Text style={s.heroTitle}>Celebrate Special Occasions</Text>
          <Text style={s.heroSub}>Book a celebrity wish for every moment that matters — birthdays, weddings, anniversaries and more</Text>
        </LinearGradient>

        {/* Featured Occasions */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Featured Occasions</Text>
        <View style={s.featuredGrid}>
          {featuredPairs.map((pair, ri) => (
            <View key={ri} style={s.gridRow}>
              {pair.map((occ, ci) => {
                if (!occ) return <View key={ci} style={{ flex: 1 }} />;
                return (
                  <View key={occ.id} style={[s.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <LinearGradient
                      colors={occ.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.featuredImgArea}
                    >
                      <View style={s.featuredImgContent}>
                        <Text style={s.featuredName}>{occ.name}</Text>
                        <Text style={s.featuredDesc} numberOfLines={2}>{occ.description}</Text>
                      </View>
                    </LinearGradient>
                    <View style={s.featuredBottom}>
                      <View style={s.dateRow}>
                        <Icon name="calendar" size={13} color={colors.mutedForeground} />
                        <Text style={[s.dateText, { color: colors.mutedForeground }]}>{occ.date}</Text>
                      </View>
                      <TouchableOpacity style={[s.bookBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/wish-celebrity' as never)}>
                        <Text style={s.bookBtnText}>Book Now</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* All Upcoming */}
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>All Upcoming Occasions</Text>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {MOCK_OCCASIONS.map((item) => (
            <LinearGradient
              key={item.id}
              colors={(OCCASION_COLORS[item.type] ?? ['#FF6B33', '#B44CFF']) as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.upcomingCard}
            >
              <View style={s.cardLeft}>
                <View style={s.iconCircle}>
                  <Icon name={OCCASION_ICONS[item.type] ?? 'calendar'} size={22} color="#fff" />
                </View>
                <View>
                  <Text style={s.cardTitle}>{item.name}</Text>
                  <Text style={s.cardPerson}>{item.person}</Text>
                  <Text style={s.cardDate}>{item.date}</Text>
                </View>
              </View>
              <View style={s.daysLeft}>
                <Text style={s.daysNum}>{item.daysLeft}</Text>
                <Text style={s.daysLabel}>days</Text>
              </View>
            </LinearGradient>
          ))}
        </View>

        {/* Info Banner */}
        <LinearGradient
          colors={['#B44CFF', '#E8527A']}
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

      <TouchableOpacity style={[s.fab, { backgroundColor: colors.primary }]} onPress={() => {}}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  hero: { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  heroTitle: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  featuredGrid: { paddingHorizontal: 12, gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  featuredCard: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  featuredImgArea: { height: 160, justifyContent: 'flex-end' },
  featuredImgContent: { padding: 12, gap: 4 },
  featuredName: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  featuredDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  featuredBottom: { padding: 12, gap: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  bookBtn: { borderRadius: 9999, paddingVertical: 8, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  upcomingCard: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  cardPerson: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  cardDate: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  daysLeft: { alignItems: 'center' },
  daysNum: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold' },
  daysLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  banner: { margin: 16, marginTop: 24, borderRadius: 20, padding: 24, alignItems: 'center', gap: 12 },
  bannerText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center', lineHeight: 24 },
  bannerBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 9999, paddingHorizontal: 28, paddingVertical: 12 },
  bannerBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
