import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openCelebrityService, SERVICE_KEYS, SERVICES } from '@/components/celebrity/services';
import { SubscribeSheet } from '@/components/celebrity/SubscribeSheet';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Celebrity } from '@/hooks/useCelebrities';
import { useLovedCelebrities } from '@/hooks/useLovedCelebrities';
import { useWallet } from '@/hooks/useWallet';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}

interface MediaItem {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  title?: string;
}

interface EventItem {
  id: string;
  title: string;
  event_date: string;
  location?: string;
}

type TabKey = 'overview' | 'media' | 'events' | 'releases' | 'about';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'media', label: 'Media' },
  { key: 'events', label: 'Events' },
  { key: 'releases', label: 'Releases' },
  { key: 'about', label: 'About' },
];

const BENEFITS = [
  { emoji: '❤️', label: 'Personalised Video Wishes' },
  { emoji: '🎬', label: 'UGC Brand Promotions' },
  { emoji: '🖼', label: 'AI Image Promotions' },
  { emoji: '💬', label: 'Occasion Greetings' },
  { emoji: '✨', label: 'Lifetime Access' },
];

export default function CelebrityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();

  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [loading, setCelebLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ugcPrice, setUgcPrice] = useState<number>(0);

  const fetchCelebrity = useCallback(async () => {
    if (!id) return;
    setCelebLoading(true);
    setError(null);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${id}&select=*,celebrity_reviews(count)&limit=1`,
      );
      if (!res.ok) throw new Error(`API error (${res.status})`);
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        setCelebrity(null);
      } else {
        const raw = rows[0];
        const sp = raw.service_prices ?? {};
        setUgcPrice(sp.ugc_ad ?? 0);
        setCelebrity({
          id: raw.id,
          name: raw.name,
          category: raw.category,
          bio: raw.bio ?? '',
          imageUrl: raw.image_url ?? '',
          rating: (raw.celebrity_reviews?.[0]?.count ?? 0) > 0 ? raw.rating ?? 0 : 0,
          reviewCount: raw.celebrity_reviews?.[0]?.count ?? 0,
          followers: raw.followers,
          location: raw.location,
          deliveryTime: raw.delivery_time,
          isVerified: raw.is_verified ?? false,
          isAvailable: true,
          pricePerWish: sp.general_wish ?? 0,
          pricePerCall: raw.voice_call_price ?? 0,
          ratePerMinute: raw.voice_call_price ?? 0,
          tags: [],
          subscription: raw.subscription,
          socialMedia: raw.social_media,
          vapiVoiceId: raw.vapi_voice_id,
          vapiPhoneId: raw.vapi_phone_id,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load celebrity');
      setCelebrity(null);
    } finally {
      setCelebLoading(false);
    }
  }, [id]);

  const refetch = fetchCelebrity;

  useEffect(() => {
    fetchCelebrity();
  }, [fetchCelebrity]);

  const { isLoved, toggle: toggleLoved } = useLovedCelebrities();
  const [lovedSaving, setLovedSaving] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [pricingPrice, setPricingPrice] = useState<number | null>(null);
  const [isPricingDisabled, setIsPricingDisabled] = useState(false);

  const [scrolledPast, setScrolledPast] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [subscribeStart, setSubscribeStart] = useState<'offer' | 'pay'>('offer');
  const reopenAfterWallet = useRef(false);
  const wallet = useWallet();
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const loadedTabsRef = useRef<Set<TabKey>>(new Set(['overview']));
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);


  const fetchSubscriptionData = useCallback(async () => {
    if (!id || !user?.profileId || !session?.access_token) return;
    setSubLoading(true);
    try {
      const [subRes, pricingRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/celebrity_favorites?user_id=eq.${user.profileId}&celebrity_id=eq.${id}&status=eq.active&select=id&limit=1`,
          {},
          session.access_token,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_favorite_pricing?celebrity_id=eq.${id}&is_enabled=eq.true&select=price&limit=1`,
          {},
          session.access_token,
        ),
      ]);
      if (subRes.ok) {
        const rows = await subRes.json() as Array<{ id: string }>;
        setIsSubscribed(rows && rows.length > 0);
      }
      if (pricingRes.ok) {
        const pricing = await pricingRes.json() as Array<{ price: number }>;
        if (pricing && pricing.length > 0) {
          setPricingPrice(pricing[0].price);
          setIsPricingDisabled(false);
        } else {
          setPricingPrice(null);
          setIsPricingDisabled(true);
        }
      } else {
        setPricingPrice(null);
        setIsPricingDisabled(true);
      }
    } catch {
    } finally {
      setSubLoading(false);
    }
  }, [id, user?.profileId, session?.access_token]);

  const fetchReviews = useCallback(async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_reviews?celebrity_id=eq.${id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=10`,
        {},
        session?.access_token,
      );
      if (res.ok) {
        const data = await res.json() as Review[];
        setReviews(data ?? []);
      }
    } catch {
    } finally {
      setReviewsLoading(false);
    }
  }, [id, session?.access_token]);

  const fetchMedia = useCallback(async () => {
    if (!id) return;
    setMediaLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_media?celebrity_id=eq.${id}&is_public=eq.true&order=created_at.desc`,
      );
      if (res.ok) {
        const data = await res.json() as MediaItem[];
        setMediaItems(data ?? []);
      }
    } catch {
    } finally {
      setMediaLoading(false);
    }
  }, [id]);

  const fetchEvents = useCallback(async () => {
    if (!id) return;
    setEventsLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_events?celebrity_id=eq.${id}&is_public=eq.true&order=event_date.asc`,
      );
      if (res.ok) {
        const data = await res.json() as EventItem[];
        setEvents(data ?? []);
      }
    } catch {
    } finally {
      setEventsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSubscriptionData();
    fetchReviews();
  }, [fetchSubscriptionData, fetchReviews]);

  const handleTabPress = (tab: TabKey) => {
    setActiveTab(tab);
    if (!loadedTabsRef.current.has(tab)) {
      loadedTabsRef.current.add(tab);
      if (tab === 'media') fetchMedia();
      if (tab === 'events') fetchEvents();
    }
  };

  const openSubscriptionFlow = () => {
    if (!user) {
      router.push('/(auth)');
      return;
    }
    wallet.refetch();
    setSubscribeStart('offer');
    setShowSubscribe(true);
  };

  const handleBookOrSubscribe = () => {
    if (!user) {
      router.push('/(auth)');
      return;
    }
    if (isSubscribed) {
      setShowServiceSheet(true);
    } else if (hasPricing) {
      openSubscriptionFlow();
    }
  };

  const handleToggleLoved = async () => {
    if (!user) {
      router.push('/(auth)');
      return;
    }
    if (!id || lovedSaving) return;
    setLovedSaving(true);
    try {
      // Hold the spinner a moment so the save is visible even though it finishes fast.
      const [result] = await Promise.all([toggleLoved(id), new Promise(r => setTimeout(r, 600))]);
      if (result !== null) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } finally {
      setLovedSaving(false);
    }
  };

  // Back from the wallet with the sheet waiting: refresh the balance and reopen it on the payment step.
  useFocusEffect(
    useCallback(() => {
      if (!reopenAfterWallet.current) return;
      reopenAfterWallet.current = false;
      wallet.refetch();
      setSubscribeStart('pay');
      setShowSubscribe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[{ marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 }]}>
        <Icon name="alert-circle" size={48} color={colors.primary} />
        <Text style={[{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center' }]}>Could not load celebrity</Text>
        <Text style={[{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }]}>{error}</Text>
        <TouchableOpacity
          onPress={refetch}
          style={[{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary }]}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!celebrity) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
        <Icon name="user" size={48} color={colors.mutedForeground} />
        <Text style={[{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground }]}>Celebrity not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary }]}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLoggedIn = !!user;
  const hasPricing = pricingPrice !== null && !isPricingDisabled;
  const bookBtnLabel = !isLoggedIn ? 'Book a Service' : isSubscribed ? 'Book a Service' : !hasPricing ? 'Subscription Not Available' : 'Subscribe to Book';
  const showSubscribeBanner = isLoggedIn && !isSubscribed && !subLoading && hasPricing;
  const walletBalance = wallet.balance;

  // Each service opens its own sidebar screen with this celebrity already chosen. Prices are shown only where the screen charges the celebrity's own price.
  const serviceCards = SERVICE_KEYS.map(key => ({
    key,
    ...SERVICES[key],
    price: key === 'wish' ? celebrity.pricePerWish : key === 'ad' ? ugcPrice : 0,
    onPress: () => openCelebrityService(key, celebrity.id),
  }));
  const loved = isLoved(celebrity.id);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <View>
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{celebrity.bio}</Text>
            <View style={[styles.statRow, { backgroundColor: colors.backgroundSecondary }]}>
              {celebrity.location && (
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>📍</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{celebrity.location}</Text>
                </View>
              )}
              {celebrity.followers !== undefined && celebrity.followers !== null && (
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>👥</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{celebrity.followers.toLocaleString('en-IN')}</Text>
                </View>
              )}
              {celebrity.deliveryTime && (
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>🚚</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{celebrity.deliveryTime}</Text>
                </View>
              )}
              {celebrity.isVerified && (
                <View style={styles.statItem}>
                  <Text style={styles.statEmoji}>✅</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        );
      case 'media':
        if (mediaLoading) {
          return <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 24 }} />;
        }
        if (mediaItems.length === 0) {
          return <Text style={[styles.emptyState, { color: colors.mutedForeground }]}>No media yet</Text>;
        }
        return (
          <View style={styles.mediaGrid}>
            {mediaItems.map((item) => (
              <View key={item.id} style={[styles.mediaCell, { backgroundColor: colors.backgroundSecondary }]}>
                {item.media_type === 'video' ? (
                  <View style={styles.videoCellInner}>
                    <Icon name="play-circle" size={36} color={colors.mutedForeground} />
                  </View>
                ) : (
                  <Image source={{ uri: item.thumbnail_url ?? item.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                )}
              </View>
            ))}
          </View>
        );
      case 'events':
        if (eventsLoading) {
          return <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 24 }} />;
        }
        if (events.length === 0) {
          return <Text style={[styles.emptyState, { color: colors.mutedForeground }]}>No upcoming events</Text>;
        }
        return (
          <View style={{ gap: 12 }}>
            {events.map((ev) => {
              const date = new Date(ev.event_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
              return (
                <View key={ev.id} style={[styles.eventRow, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={styles.statEmoji}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }]}>{ev.title}</Text>
                    <Text style={[{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }]}>{date}{ev.location ? ` · ${ev.location}` : ''}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      case 'releases':
        return <Text style={[styles.emptyState, { color: colors.mutedForeground }]}>No releases available yet</Text>;
      case 'about':
        return (
          <View style={{ gap: 12 }}>
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{celebrity.bio}</Text>
            {celebrity.location && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="globe" size={16} color={colors.mutedForeground} />
                <Text style={[{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>{celebrity.location}</Text>
              </View>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        scrollEventThrottle={32}
        onScroll={e => {
          const past = e.nativeEvent.contentOffset.y > 120;
          setScrolledPast(prev => (prev === past ? prev : past));
        }}
      >
        {/* Header image */}
        <View style={{ height: 300, position: 'relative' }}>
          <Image source={{ uri: celebrity.imageUrl + '?w=800' }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 20 }]}
          >
            <View style={styles.nameBadgeRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text style={styles.name}>{celebrity.name}</Text>
                  {isLoggedIn && isSubscribed && (
                    <View style={styles.subscribedBadge}>
                      <Icon name="check" size={10} color="#fff" />
                      <Text style={styles.subscribedBadgeText}>Subscribed</Text>
                    </View>
                  )}
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.categoryText}>{celebrity.category}</Text>
                  </View>
                  {celebrity.isVerified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: '#22C55E' }]}>
                      <Icon name="check" size={10} color="#fff" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>
          {/* Back btn */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 12 }]}
          >
            <Icon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Heart: marks the celebrity as loved; the Favorites screen keeps only these */}
          <TouchableOpacity
            onPress={handleToggleLoved}
            style={[styles.favBtn, { top: insets.top + 12 }]}
            accessibilityRole="button"
            accessibilityLabel={loved ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityState={{ selected: loved, busy: lovedSaving }}
            disabled={lovedSaving}
          >
            {lovedSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="heart" size={22} color={loved ? '#EF4444' : '#fff'} filled={loved} />
            )}
          </TouchableOpacity>
        </View>

        {/* Subscribe banner for non-subscribers */}
        {showSubscribeBanner && (
          <TouchableOpacity
            onPress={openSubscriptionFlow}
            style={styles.subscribeBanner}
          >
            <Icon name="lock" size={16} color="#fff" />
            <Text style={styles.subscribeBannerText}>Subscribe to unlock all booking services</Text>
            <View style={styles.subscribeBannerPill}>
              <Text style={styles.subscribeBannerPillText}>Subscribe</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Info */}
        <View style={styles.infoSection}>
          {/* Rating + reviews */}
          <View style={styles.ratingRow}>
            <Icon name="star" size={16} color="#FFB347" />
            {celebrity.reviewCount > 0 && celebrity.rating > 0 ? (
              <>
                <Text style={[styles.rating, { color: colors.foreground }]}>{celebrity.rating.toFixed(1)}</Text>
                <Text style={[styles.reviews, { color: colors.mutedForeground }]}>({celebrity.reviewCount.toLocaleString('en-IN')} {celebrity.reviewCount === 1 ? 'review' : 'reviews'})</Text>
              </>
            ) : (
              <Text style={[styles.reviews, { color: colors.mutedForeground }]}>New · no reviews yet</Text>
            )}
          </View>

          {/* Location + Delivery */}
          {(celebrity.location || celebrity.deliveryTime) && (
            <View style={[styles.metaRow, { backgroundColor: colors.backgroundSecondary }]}>
              {celebrity.location && (
                <View style={styles.metaItem}>
                  <Icon name="globe" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{celebrity.location}</Text>
                </View>
              )}
              {celebrity.deliveryTime && (
                <View style={styles.metaItem}>
                  <Icon name="clock" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{celebrity.deliveryTime}</Text>
                </View>
              )}
            </View>
          )}

          {/* Pricing */}
          <View style={[styles.priceRow, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Per Wish</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.priceValue, { color: colors.primary }]}>₹{celebrity.pricePerWish.toLocaleString('en-IN')}</Text>
                {showSubscribeBanner && <Icon name="lock" size={14} color={colors.mutedForeground} />}
              </View>
            </View>
            <View style={[styles.priceDivider, { backgroundColor: colors.border }]} />
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Voice Call</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.priceValue, { color: colors.secondary }]}>₹{celebrity.ratePerMinute}/min</Text>
                {showSubscribeBanner && <Icon name="lock" size={14} color={colors.mutedForeground} />}
              </View>
            </View>
          </View>

          {/* Book a Service section */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Book a Service</Text>
          <View style={{ gap: 12, marginBottom: 24 }}>
            {serviceCards.map((card) => (
              <TouchableOpacity
                key={card.key}
                activeOpacity={0.85}
                onPress={isSubscribed ? card.onPress : handleBookOrSubscribe}
                style={[styles.serviceCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              >
                <View style={styles.serviceCardLeft}>
                  <Text style={styles.serviceEmoji}>{card.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceTitle, { color: colors.foreground }]}>{card.title}</Text>
                    <Text style={[styles.serviceDelivery, { color: colors.mutedForeground }]}>{card.subtitle}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {card.price > 0 && <Text style={[styles.servicePrice, { color: colors.primary }]}>₹{card.price.toLocaleString('en-IN')}</Text>}
                    {isSubscribed ? (
                      <View style={[styles.bookNowPill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.bookNowText}>Book Now</Text>
                      </View>
                    ) : (
                      <View style={[styles.lockPill, { borderColor: colors.border }]}>
                        <Icon name="lock" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.lockPillText, { color: colors.mutedForeground }]}>{hasPricing ? 'Subscribe to Unlock' : 'Not Available'}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {!isSubscribed && (
                  <View style={styles.cardLockOverlay} pointerEvents="none">
                    <View style={styles.cardLockOverlayInner} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Content Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                style={[
                  styles.tabPill,
                  activeTab === tab.key
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.tabLabel, { color: activeTab === tab.key ? '#fff' : colors.mutedForeground }]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tab content */}
          <View style={{ marginBottom: 24 }}>
            {renderTabContent()}
          </View>

          {/* Reviews */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reviews</Text>
          {reviewsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
          ) : reviews.length === 0 ? (
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>No reviews yet.</Text>
          ) : (
            reviews.map((review) => {
              const firstName = review.profiles?.first_name ?? '';
              const lastName = review.profiles?.last_name ?? '';
              const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'User';
              const avatar = (firstName[0] ?? 'U').toUpperCase();
              const date = new Date(review.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
              return (
                <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                    <View style={[styles.reviewAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.reviewAvatarText}>{avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reviewName, { color: colors.foreground }]}>{displayName}</Text>
                      <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>{date}</Text>
                    </View>
                    <View style={styles.starRow}>
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Icon key={i} name="star" size={12} color="#FFB347" />
                      ))}
                    </View>
                  </View>
                  <Text style={[styles.reviewComment, { color: colors.mutedForeground }]}>{review.comment}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.voiceCallBtn, { borderColor: colors.primary }]}
          onPress={() => router.push({ pathname: '/(tabs)/voice-call', params: { celebrity: id } })}
        >
          <Icon name="phone" size={18} color={colors.primary} />
          <Text style={[styles.voiceCallText, { color: colors.primary }]}>Voice Call</Text>
        </TouchableOpacity>
        {isLoggedIn && !isSubscribed && !hasPricing ? (
          <TouchableOpacity
            onPress={handleBookOrSubscribe}
            style={[styles.subscribeToBookBtn, { borderColor: colors.border }]}
          >
            <Icon name="lock" size={16} color={colors.mutedForeground} />
            <Text style={[styles.subscribeToBookText, { color: colors.mutedForeground }]}>{bookBtnLabel}</Text>
          </TouchableOpacity>
        ) : isLoggedIn && !isSubscribed ? (
          <TouchableOpacity
            onPress={handleBookOrSubscribe}
            style={styles.subscribeToBookBtn}
          >
            <Icon name="lock" size={16} color="#7B5CFA" />
            <Text style={styles.subscribeToBookText}>{bookBtnLabel}</Text>
          </TouchableOpacity>
        ) : (
          <Pressable
            onPress={handleBookOrSubscribe}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookBtn}>
              <Text style={styles.bookBtnText}>{bookBtnLabel}</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      {scrolledPast && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background, zIndex: 5 }} />}

      {celebrity && pricingPrice !== null && (
        <SubscribeSheet
          visible={showSubscribe}
          onClose={() => setShowSubscribe(false)}
          celebrity={{ id: celebrity.id, name: celebrity.name, category: celebrity.category, imageUrl: celebrity.imageUrl, isVerified: celebrity.isVerified }}
          price={pricingPrice}
          walletBalance={walletBalance}
          token={session?.access_token ?? null}
          startAt={subscribeStart}
          onSubscribed={() => { setIsSubscribed(true); fetchSubscriptionData(); wallet.refetch(); }}
          onAddMoney={() => { reopenAfterWallet.current = true; setShowSubscribe(false); setTimeout(() => router.push('/wallet' as never), 80); }}
          onBook={(service) => {
            setShowSubscribe(false);
            setTimeout(() => openCelebrityService(service, celebrity.id), 80);
          }}
          servicePrices={{ wish: celebrity.pricePerWish ?? 0, ad: ugcPrice, video: 0 }}
        />
      )}

      {/* Service Selection Sheet */}
      <Modal
        visible={showServiceSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServiceSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowServiceSheet(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Book a Service</Text>
          <Text style={[{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 16 }]}>
            Select a service to book with {celebrity?.name}
          </Text>

          {serviceCards.map((svc) => (
            <TouchableOpacity
              key={svc.key}
              activeOpacity={0.85}
              onPress={() => {
                setShowServiceSheet(false);
                svc.onPress();
              }}
              style={[styles.serviceCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary, borderWidth: 1, marginBottom: 10 }]}
            >
              <View style={styles.serviceCardLeft}>
                <Text style={[styles.serviceEmoji, { fontSize: 28 }]}>{svc.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceTitle, { color: colors.foreground }]}>{svc.title}</Text>
                  <Text style={[styles.serviceDelivery, { color: colors.mutedForeground }]}>{svc.subtitle}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {svc.price > 0 && <Text style={[styles.servicePrice, { color: colors.primary }]}>₹{svc.price.toLocaleString('en-IN')}</Text>}
                  <View style={[styles.bookNowPill, { backgroundColor: colors.primary }]}>
                    <Text style={styles.bookNowText}>Book Now</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={() => setShowServiceSheet(false)} style={styles.cancelLink}>
            <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View></AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  favBtn: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  nameBadgeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  name: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff' },
  subscribedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22C55E', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  subscribedBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  badgeRow: { flexDirection: 'row', gap: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  categoryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  verifiedText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  subscribeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7B5CFA',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  subscribeBannerText: { flex: 1, color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },
  subscribeBannerPill: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999 },
  subscribeBannerPillText: { color: '#7B5CFA', fontSize: 12, fontFamily: 'Inter_700Bold' },
  infoSection: { padding: 20 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  rating: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  reviews: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', gap: 16, borderRadius: 12, padding: 12, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  priceRow: { flexDirection: 'row', borderRadius: 14, padding: 16, marginBottom: 20 },
  priceItem: { flex: 1, alignItems: 'center' },
  priceDivider: { width: 1, marginHorizontal: 8 },
  priceLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  priceValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12, marginTop: 4 },
  bio: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, marginBottom: 16 },
  serviceCard: { borderRadius: 14, borderWidth: 1, padding: 14, overflow: 'hidden' },
  serviceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceEmoji: { fontSize: 28 },
  serviceTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  serviceDelivery: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  servicePrice: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  bookNowPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  bookNowText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  lockPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, borderWidth: 1 },
  lockPillText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  cardLockOverlay: { ...StyleSheet.absoluteFillObject },
  cardLockOverlayInner: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 14 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 },
  tabLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderRadius: 12, padding: 14, marginBottom: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statEmoji: { fontSize: 16 },
  statLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaCell: { width: (SCREEN_WIDTH - 40 - 8) / 2, aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  videoCellInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  emptyState: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginVertical: 20 },
  reviewCard: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  reviewName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  reviewDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  starRow: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  voiceCallBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, borderWidth: 2 },
  voiceCallText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  subscribeToBookBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 12, borderWidth: 2, borderColor: '#7B5CFA' },
  subscribeToBookText: { color: '#7B5CFA', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  bookBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 16 },
  step1CelebRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  step1Avatar: { width: 64, height: 64, borderRadius: 32 },
  step1CelebName: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  step1CategoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
  step1CategoryText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  step1PriceCard: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  step1PriceAmount: { fontSize: 40, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 4 },
  step1PriceSubtitle: { fontSize: 13, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  benefitLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  payBtn: { height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  payBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cancelLink: { alignItems: 'center', paddingVertical: 12 },
  cancelLinkText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  unavailableBox: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  unavailableText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  viewProfileBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  viewProfileText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  step2AmountCard: { borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16 },
  step2AmountLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  step2AmountValue: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  walletRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, marginBottom: 16 },
  walletLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  walletAmount: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  paymentGrid: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  paymentBtn: { flex: 1, height: 128, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', overflow: 'hidden' },
  paymentBtnPrice: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  paymentBtnSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  insufficientBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  insufficientText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});
