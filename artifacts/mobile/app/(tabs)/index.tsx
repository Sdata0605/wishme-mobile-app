import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { QrCode } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CelebCard } from '@/components/CelebCard';
import { HomeAllServicesSection } from '@/components/all-services/HomeAllServicesSection';
import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { useTheme } from '@/context/ThemeContext';
import { useTour, useTourTarget } from '@/context/TourContext';
import { CATEGORIES } from '@/constants/celebrities';
import { useCelebrities } from '@/hooks/useCelebrities';
import { useCelebrityFavorites } from '@/hooks/useCelebrityFavorites';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const { width: W } = Dimensions.get('window');
const DASH_PAGE_SIZE = 4;

const BANNERS: { id: string; title: string; subtitle: string; colors: readonly [string, string, string]; route: Href }[] = [
  {
    id: '1',
    title: 'Get a Birthday Wish\nfrom Your Idol',
    subtitle: 'Starting from ₹999',
    colors: ['#7B5CFA', '#D23FE0', '#1F7BFF'] as const,
    route: '/wish-celebrity',
  },
  {
    id: '2',
    title: 'AI Music Studio\nNow Live!',
    subtitle: 'Generate songs in seconds',
    colors: ['#1F7BFF', '#7C3AED', '#4B0082'] as const,
    route: '/(tabs)/music',
  },
  {
    id: '3',
    title: 'Book a Voice Call\nwith Celebrities',
    subtitle: 'Live 1-on-1 sessions',
    colors: ['#7B5CFA', '#F59E0B', '#FFB347'] as const,
    route: '/(tabs)/voice-call',
  },
];

const CATEGORY_MAP: Record<string, string> = {
  'All': '',
  'Actors': 'Actor',
  'Singers': 'Singer',
  'Athletes': 'Athlete',
  'Comedians': 'Comedian',
  'Influencers': 'Influencer',
  'TV Stars': 'TV Stars',
};

const PRICE_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: 'Under ₹1K', min: 0, max: 1000 },
  { label: '₹1K–₹3K', min: 1000, max: 3000 },
  { label: '₹3K–₹6K', min: 3000, max: 6000 },
  { label: 'Above ₹6K', min: 6000, max: Infinity },
];

const VIDEO_CARDS = [
  { id: 'v1', title: 'Graduation Wishes', desc: 'Send a heartfelt congratulations video to your graduate', tag: 'Graduation', gradient: ['#3B5BDB', '#7C3AED'] as const },
  { id: 'v2', title: 'Birthday Magic', desc: 'Make their birthday unforgettable with a celebrity wish', tag: 'Birthday', gradient: ['#7B5CFA', '#D23FE0'] as const },
  { id: 'v3', title: 'Anniversary Special', desc: 'Celebrate love with a romantic celebrity message', tag: 'Anniversary', gradient: ['#1F7BFF', '#D23FE0'] as const },
];

const BIRTHDAY_VIDEO = require('../../assets/videos/happy-birthday.mp4');
const ANNIVERSARY_VIDEO = require('../../assets/videos/wedding-anniversary.mp4');
const GRADUATION_VIDEO = require('../../assets/videos/graduation-wish.mp4');

function BirthdayVideoCard({ tag }: { tag: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const player = useVideoPlayer(BIRTHDAY_VIDEO, p => {
    p.loop = true;
    p.muted = false;
  });

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [isPlaying, player]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  }, [isMuted, player]);

  return (
    <View style={styles.videoThumb}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Play / Pause overlay */}
      <TouchableOpacity
        onPress={togglePlay}
        activeOpacity={0.8}
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
        </View>
      </TouchableOpacity>
      {/* Mute / Unmute */}
      <TouchableOpacity
        onPress={toggleMute}
        activeOpacity={0.8}
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={16} color="#fff" />
      </TouchableOpacity>
      {/* Tag badge */}
      <View style={[{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }]}>
        <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{tag}</Text>
      </View>
    </View>
  );
}

function AnniversaryVideoCard({ tag }: { tag: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const player = useVideoPlayer(ANNIVERSARY_VIDEO, p => {
    p.loop = true;
    p.muted = false;
  });

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [isPlaying, player]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  }, [isMuted, player]);

  return (
    <View style={styles.videoThumb}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />
      <TouchableOpacity
        onPress={togglePlay}
        activeOpacity={0.8}
        style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleMute}
        activeOpacity={0.8}
        style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={16} color="#fff" />
      </TouchableOpacity>
      <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{tag}</Text>
      </View>
    </View>
  );
}

function GraduationVideoCard({ tag }: { tag: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const player = useVideoPlayer(GRADUATION_VIDEO, p => {
    p.loop = true;
    p.muted = false;
  });

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [isPlaying, player]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
  }, [isMuted, player]);

  return (
    <View style={styles.videoThumb}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />
      <TouchableOpacity
        onPress={togglePlay}
        activeOpacity={0.8}
        style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleMute}
        activeOpacity={0.8}
        style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={16} color="#fff" />
      </TouchableOpacity>
      <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{tag}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const { toggle } = useDrawer();
  const { hasFavorite } = useCelebrityFavorites({
    profileId: user?.profileId,
    accessToken: session?.access_token,
  });
  const insets = useSafeAreaInsets();
  const { begin: beginTour } = useTour();
  const menuTarget = useTourTarget('menu');
  const scanTarget = useTourTarget('scan');
  // First time on Home after install: walk the user through the menu, scanner and bottom bar.
  useFocusEffect(useCallback(() => beginTour(), [beginTour]));
  const [refreshing, setRefreshing] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activePriceRange, setActivePriceRange] = useState('All');
  const [dashPage, setDashPage] = useState(1);

  const { celebrities, loading, error, refetch } = useCelebrities({ limit: 20 });

  const onRefresh = () => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const priceRange = PRICE_RANGES.find((p) => p.label === activePriceRange) ?? PRICE_RANGES[0];

  const filteredCelebs = celebrities.filter((c) => {
    const catValue = CATEGORY_MAP[activeCategory] ?? '';
    const matchCat = activeCategory === 'All' ||
      c.category === catValue ||
      c.category.toLowerCase().includes(catValue.toLowerCase()) ||
      catValue.toLowerCase().includes(c.category.toLowerCase());
    const subPrice = c.subscription?.price;
    const matchPrice = priceRange.label === 'All'
      ? true
      : subPrice != null && subPrice >= priceRange.min && subPrice < priceRange.max;
    return matchCat && matchPrice;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCelebs.length / DASH_PAGE_SIZE));
  const pagedCelebs = filteredCelebs.slice((dashPage - 1) * DASH_PAGE_SIZE, dashPage * DASH_PAGE_SIZE);

  const onFilterCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setDashPage(1);
  };

  const onFilterPriceChange = (label: string) => {
    setActivePriceRange(label);
    setDashPage(1);
  };

  const ITEM_W = (W - 52) / 4;

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Header */}
      <LinearGradient
        colors={['#7B5CFA', '#D23FE0', '#1F7BFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <View style={styles.headerRow}>
          <View ref={menuTarget} collapsable={false}>
            <TouchableOpacity onPress={toggle} style={styles.menuBtn}>
              <Icon name="menu" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {user ? `Welcome back, ${user.firstName}` : 'Welcome to WishMe'}
            </Text>
            <Text style={styles.greetingSub}>What would you like today?</Text>
          </View>
          <View style={styles.headerRight}>
            <View ref={scanTarget} collapsable={false}>
              <TouchableOpacity
                style={[styles.scanBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
                onPress={() => router.push('/(tabs)/scan-pay')}
                accessibilityRole="button"
                accessibilityLabel="Scan and pay"
              >
                <QrCode size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.walletPill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
              onPress={() => router.push('/wallet')}
            >
              <Icon name="credit-card" size={13} color="#fff" />
              <Text style={styles.walletText}>₹{user?.walletBalance?.toLocaleString('en-IN') ?? '0'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <Pressable
          onPress={() => router.push('/(tabs)/celebrities')}
          style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
        >
          <Icon name="search" size={18} color="rgba(255,255,255,0.8)" />
          <Text style={styles.searchPlaceholder}>Search celebrities...</Text>
          <Icon name="sliders" size={18} color="rgba(255,255,255,0.8)" />
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
                <TouchableOpacity style={styles.bannerBtn} onPress={() => router.push(item.route)} activeOpacity={0.7}>
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

        {/* All Services (from Wish-Me) — replaces Quick Actions */}
        <HomeAllServicesSection />

        {/* Featured Celebrities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Featured Celebrities</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/celebrities')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.featuredSkeletonRow}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.featuredSkeleton, { backgroundColor: colors.muted }]} />
              ))}
            </View>
          ) : error ? (
            <TouchableOpacity style={[styles.errorBanner, { backgroundColor: colors.muted }]} onPress={refetch}>
              <Icon name="alert-circle" size={16} color={colors.primary} />
              <Text style={[styles.errorText, { color: colors.foreground }]}>Tap to retry</Text>
            </TouchableOpacity>
          ) : (
            <FlatList
              data={celebrities.slice(0, 6)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => <CelebCard celebrity={item} isSubscribed={hasFavorite(item.id)} />}
              keyExtractor={(item) => item.id}
            />
          )}
        </View>

        {/* Browse with Filters + Pagination */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.filterToggleRow}
            onPress={() => setFiltersExpanded((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 0, marginBottom: 0 }]}>
              Browse Celebrities
            </Text>
            <View style={[styles.filterToggleChip, { backgroundColor: colors.muted }]}>
              <Icon name="sliders" size={14} color={colors.primary} />
              <Text style={[styles.filterToggleText, { color: colors.primary }]}>
                {filtersExpanded ? 'Hide Filters' : 'Show Filters'}
              </Text>
              <Icon name={filtersExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {filtersExpanded && (
            <View style={styles.filterBlock}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, { backgroundColor: activeCategory === cat ? colors.primary : colors.muted, borderColor: activeCategory === cat ? colors.primary : colors.border }]}
                    onPress={() => onFilterCategoryChange(cat)}
                  >
                    <Text style={[styles.chipText, { color: activeCategory === cat ? '#fff' : colors.foreground }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Price Range</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {PRICE_RANGES.map((pr) => (
                  <TouchableOpacity
                    key={pr.label}
                    style={[styles.chip, { backgroundColor: activePriceRange === pr.label ? colors.primary : colors.muted, borderColor: activePriceRange === pr.label ? colors.primary : colors.border }]}
                    onPress={() => onFilterPriceChange(pr.label)}
                  >
                    <Text style={[styles.chipText, { color: activePriceRange === pr.label ? '#fff' : colors.foreground }]}>{pr.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Paginated Celebrity Grid */}
          {loading ? (
            <View style={[styles.celebGrid, { paddingHorizontal: 20 }]}>
              <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1, marginVertical: 32 }} />
            </View>
          ) : error ? (
            <TouchableOpacity style={[styles.errorBanner, { backgroundColor: colors.muted, marginHorizontal: 20 }]} onPress={refetch}>
              <Icon name="alert-circle" size={16} color={colors.primary} />
              <Text style={[styles.errorText, { color: colors.foreground }]}>Failed to load. Tap to retry.</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.celebGrid}>
                {pagedCelebs.map((celeb) => (
                  <CelebCard key={celeb.id} celebrity={celeb} width={(W - 52) / 2} isSubscribed={hasFavorite(celeb.id)} />
                ))}
                {pagedCelebs.length === 0 && (
                  <View style={styles.emptyState}>
                    <Icon name="search" size={36} color={colors.mutedForeground} />
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No celebrities found</Text>
                  </View>
                )}
              </View>

              {/* Pagination Controls */}
              {filteredCelebs.length > DASH_PAGE_SIZE && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[styles.pageBtn, { backgroundColor: colors.card, opacity: dashPage <= 1 ? 0.4 : 1 }]}
                    onPress={() => setDashPage((p) => Math.max(1, p - 1))}
                    disabled={dashPage <= 1}
                  >
                    <Icon name="chevron-left" size={16} color={colors.foreground} />
                    <Text style={[styles.pageBtnText, { color: colors.foreground }]}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={[styles.pageLabel, { color: colors.mutedForeground }]}>
                    Page {dashPage} of {totalPages}
                  </Text>
                  <TouchableOpacity
                    style={[styles.pageBtn, { backgroundColor: colors.card, opacity: dashPage >= totalPages ? 0.4 : 1 }]}
                    onPress={() => setDashPage((p) => Math.min(totalPages, p + 1))}
                    disabled={dashPage >= totalPages}
                  >
                    <Text style={[styles.pageBtnText, { color: colors.foreground }]}>Next</Text>
                    <Icon name="chevron-right" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
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
                {item.id === 'v1' ? (
                  <GraduationVideoCard tag={item.tag} />
                ) : item.id === 'v2' ? (
                  <BirthdayVideoCard tag={item.tag} />
                ) : item.id === 'v3' ? (
                  <AnniversaryVideoCard tag={item.tag} />
                ) : (
                  <LinearGradient
                    colors={item.gradient as [string, string]}
                    style={styles.videoThumb}
                  >
                    <View style={styles.playBtn}>
                      <Icon name="play" size={28} color="#fff" />
                    </View>
                    <View style={[styles.tagBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                      <Text style={styles.tagText}>{item.tag}</Text>
                    </View>
                  </LinearGradient>
                )}
                <View style={styles.videoInfo}>
                  <Text style={[styles.videoTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.videoDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.desc}</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/celebrities')} style={{ marginTop: 10 }}>
                    <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.wishBtn}>
                      <Icon name="video" size={14} color="#fff" />
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
              { num: '1', icon: 'search' as IconName, title: 'Find Your Star', caption: 'Browse thousands of celebrities' },
              { num: '2', icon: 'edit-2' as IconName, title: 'Share Details', caption: 'Tell us about the occasion' },
              { num: '3', icon: 'video' as IconName, title: 'Get Your Wish', caption: 'Receive a personal video' },
            ].map((step) => (
              <View key={step.num} style={styles.howStep}>
                <LinearGradient colors={['#7B5CFA', '#1F7BFF']} style={styles.stepCircle}>
                  <Text style={styles.stepNum}>{step.num}</Text>
                </LinearGradient>
                <Icon name={step.icon} size={20} color={colors.primary} />
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.title}</Text>
                <Text style={[styles.stepCaption, { color: colors.mutedForeground }]}>{step.caption}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Referral Banner */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <LinearGradient colors={['#7C3AED', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.referralBanner}>
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


    </View></AmbientBackground>
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
  scanBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
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
  dotActive: { backgroundColor: '#7B5CFA', width: 16 },
  quickGrid: { paddingHorizontal: 16 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  quickItem: { alignItems: 'center', padding: 10, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quickIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center', lineHeight: 15 },
  badge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  featuredSkeletonRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  featuredSkeleton: { width: 130, height: 180, borderRadius: 12 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginHorizontal: 20 },
  errorText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  filterToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  filterToggleChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  filterToggleText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  filterBlock: { paddingHorizontal: 20, marginBottom: 14 },
  filterLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  chipRow: { gap: 8, paddingBottom: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  celebGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },
  emptyState: { flex: 1, alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 16 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  pageBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  pageLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  videoCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  videoThumb: { height: 160, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  tagBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  tagText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  videoInfo: { padding: 16 },
  videoTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  videoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  wishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 10 },
  wishBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  howCard: { marginHorizontal: 20, borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between' },
  howStep: { flex: 1, alignItems: 'center', gap: 8 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  stepTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  stepCaption: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 15 },
  referralBanner: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center' },
  referralTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  referralSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  referralBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999 },
  referralBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
