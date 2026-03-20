import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CelebCard } from '@/components/CelebCard';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { useTheme } from '@/context/ThemeContext';
import { CELEBRITIES } from '@/constants/mockData';

const { width: W } = Dimensions.get('window');

const BANNERS = [
  {
    id: '1',
    title: 'Get a Birthday Wish\nfrom Your Idol',
    subtitle: 'Starting from ₹999',
    colors: ['#FF6B33', '#E8527A', '#B44CFF'] as const,
  },
  {
    id: '2',
    title: 'AI Music Studio\nNow Live!',
    subtitle: 'Generate songs in seconds',
    colors: ['#B44CFF', '#7B2FFF', '#4B0082'] as const,
  },
  {
    id: '3',
    title: 'Book a Voice Call\nwith Celebrities',
    subtitle: 'Live 1-on-1 sessions',
    colors: ['#FF6B33', '#FF8C42', '#FFB347'] as const,
  },
];

const QUICK_ACTIONS = [
  { icon: 'video', label: 'Wish a\nFriend', route: '/(tabs)/celebrities', color: '#FF6B33' },
  { icon: 'heart', label: 'Wish a\nCelebrity', route: '/wish-celebrity', color: '#E8527A' },
  { icon: 'music', label: 'AI Music\nStudio', route: '/(tabs)/music', color: '#B44CFF' },
  { icon: 'image', label: 'Photo\nWish', route: '/photo-wish', color: '#FF8C42' },
  { icon: 'mail', label: 'Greeting\nCards', route: '/greeting-cards', color: '#7B2FFF' },
  { icon: 'phone', label: 'Voice\nCall', route: '/(tabs)/voice-call', color: '#FF6B33' },
] as const;

const VIDEO_CARDS = [
  { id: 'v1', title: 'Graduation Wishes', desc: 'Send a heartfelt congratulations video to your graduate', tag: 'Graduation', gradient: ['#4B83FF', '#7B2FFF'] as const },
  { id: 'v2', title: 'Birthday Magic', desc: 'Make their birthday unforgettable with a celebrity wish', tag: 'Birthday', gradient: ['#FF6B33', '#E8527A'] as const },
  { id: 'v3', title: 'Anniversary Special', desc: 'Celebrate love with a romantic celebrity message', tag: 'Anniversary', gradient: ['#B44CFF', '#E8527A'] as const },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { toggle } = useDrawer();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['#FF6B33', '#E8527A', '#B44CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={toggle} style={styles.menuBtn}>
            <Feather name="menu" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {user ? `Welcome back, ${user.firstName}` : 'Welcome to WishMe'}
            </Text>
            <Text style={styles.greetingSub}>What would you like today?</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.walletPill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
              onPress={() => router.push('/wallet')}
            >
              <Feather name="credit-card" size={13} color="#fff" />
              <Text style={styles.walletText}>₹{user?.walletBalance?.toLocaleString('en-IN') ?? '0'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/messages')} style={styles.iconBtn}>
              <Feather name="message-circle" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <Pressable
          onPress={() => router.push('/(tabs)/celebrities')}
          style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
        >
          <Feather name="search" size={18} color="rgba(255,255,255,0.8)" />
          <Text style={styles.searchPlaceholder}>Search celebrities...</Text>
          <Feather name="sliders" size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Banner Carousel */}
        <View style={{ marginTop: 20 }}>
          <FlatList
            data={BANNERS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
            snapToInterval={W - 36}
            decelerationRate="fast"
            onViewableItemsChanged={({ viewableItems }) => {
              if (viewableItems[0]) setActiveBanner(viewableItems[0].index ?? 0);
            }}
            viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            renderItem={({ item }) => (
              <LinearGradient
                colors={item.colors as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bannerCard, { width: W - 48 }]}
              >
                <Text style={styles.bannerTitle}>{item.title}</Text>
                <Text style={styles.bannerSub}>{item.subtitle}</Text>
                <TouchableOpacity style={styles.bannerBtn}>
                  <Text style={styles.bannerBtnText}>Book Now →</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}
            keyExtractor={(item) => item.id}
          />
          <View style={styles.dotRow}>
            {BANNERS.map((_, i) => (
              <View key={i} style={[styles.dot, i === activeBanner && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.quickRow}>
                {QUICK_ACTIONS.slice(row * 3, row * 3 + 3).map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    style={[styles.quickItem, { backgroundColor: colors.card }]}
                    onPress={() => router.push(action.route as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.quickIcon, { backgroundColor: action.color + '20' }]}>
                      <Feather name={action.icon as any} size={24} color={action.color} />
                    </View>
                    <Text style={[styles.quickLabel, { color: colors.foreground }]}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Featured Celebrities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Featured Celebrities</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/celebrities')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={CELEBRITIES.slice(0, 6)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            renderItem={({ item }) => <CelebCard celebrity={item} />}
            keyExtractor={(item) => item.id}
          />
        </View>

        {/* Video Wish Cards */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personalized Video Wishes</Text>
          <FlatList
            data={VIDEO_CARDS}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            snapToInterval={W - 60}
            decelerationRate="fast"
            renderItem={({ item }) => (
              <View style={[styles.videoCard, { width: W - 60, backgroundColor: colors.card }]}>
                <LinearGradient
                  colors={item.gradient as [string, string]}
                  style={styles.videoThumb}
                >
                  <View style={styles.playBtn}>
                    <Feather name="play" size={28} color="#fff" />
                  </View>
                  <View style={[styles.tagBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <Text style={styles.tagText}>{item.tag}</Text>
                  </View>
                </LinearGradient>
                <View style={styles.videoInfo}>
                  <Text style={[styles.videoTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.videoDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.desc}</Text>
                  <TouchableOpacity onPress={() => router.push('/wish-celebrity')} style={{ marginTop: 10 }}>
                    <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.wishBtn}>
                      <Feather name="video" size={14} color="#fff" />
                      <Text style={styles.wishBtnText}>Create Your Wish</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            keyExtractor={(item) => item.id}
          />
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How It Works</Text>
          <View style={[styles.howCard, { backgroundColor: colors.backgroundSecondary }]}>
            {[
              { num: '1', icon: 'search', title: 'Find Your Star', caption: 'Browse thousands of celebrities' },
              { num: '2', icon: 'edit-2', title: 'Share Details', caption: 'Tell us about the occasion' },
              { num: '3', icon: 'video', title: 'Get Your Wish', caption: 'Receive a personal video' },
            ].map((step, i) => (
              <View key={step.num} style={styles.howStep}>
                <LinearGradient colors={['#FF6B33', '#B44CFF']} style={styles.stepCircle}>
                  <Text style={styles.stepNum}>{step.num}</Text>
                </LinearGradient>
                <Feather name={step.icon as any} size={20} color={colors.primary} style={{ marginTop: 8 }} />
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
                <Text style={[styles.stepCaption, { color: colors.mutedForeground }]}>{step.caption}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Referral Banner */}
        <View style={{ paddingHorizontal: 20 }}>
          <LinearGradient colors={['#7B2FFF', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.referralBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.referralTitle}>Earn with WishMe</Text>
              <Text style={styles.referralSub}>Refer friends & earn up to 10% commission</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/referrals')} style={styles.referralBtn}>
              <Text style={styles.referralBtnText}>Refer Now</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/messages')}
      >
        <Feather name="zap" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  menuBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  greetingSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  walletText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 44, borderRadius: 12 },
  searchPlaceholder: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter_400Regular' },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold', paddingHorizontal: 20, marginBottom: 14 },
  seeAll: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  bannerCard: { height: 160, borderRadius: 20, padding: 20, justifyContent: 'space-between' },
  bannerTitle: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', lineHeight: 28 },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  bannerBtn: { backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 },
  bannerBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ccc' },
  dotActive: { backgroundColor: '#FF6B33', width: 16 },
  quickGrid: { paddingHorizontal: 16 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  quickItem: { width: (W - 52) / 3, alignItems: 'center', padding: 14, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', lineHeight: 16 },
  videoCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  videoThumb: { height: 160, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  tagBadge: { position: 'absolute', bottom: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  tagText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_500Medium' },
  videoInfo: { padding: 14 },
  videoTitle: { fontSize: 17, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 4 },
  videoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  wishBtn: { height: 38, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  wishBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  howCard: { marginHorizontal: 20, borderRadius: 16, padding: 20, flexDirection: 'row' },
  howStep: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  stepTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 6 },
  stepCaption: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 3, lineHeight: 14 },
  referralBanner: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  referralTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  referralSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  referralBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999 },
  referralBtnText: { color: '#7B2FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  fab: { position: 'absolute', bottom: 84, right: 20, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6B33', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});
