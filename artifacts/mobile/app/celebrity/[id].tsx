import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrities } from '@/hooks/useCelebrities';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}

export default function CelebrityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();

  const { celebrities, loading, error, refetch } = useCelebrities({ limit: 50 });
  const celebrity = celebrities.find((c) => c.id === id);

  const [isFav, setIsFav] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [pricingPrice, setPricingPrice] = useState<number | null>(null);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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
        setPricingPrice(pricing && pricing.length > 0 ? pricing[0].price : null);
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

  useEffect(() => {
    fetchSubscriptionData();
    fetchReviews();
  }, [fetchSubscriptionData, fetchReviews]);

  const handleSubscribe = async () => {
    if (pricingPrice === null) return;
    setPayLoading(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/rpc/purchase_celebrity_subscription',
        {
          method: 'POST',
          body: JSON.stringify({
            p_celebrity_id: id,
            p_price: pricingPrice,
            p_payment_method: 'wallet',
          }),
        },
        session?.access_token,
      );
      const data = await res.json() as Record<string, unknown>;
      if (res.ok && data.success) {
        setShowSubSheet(false);
        setIsSubscribed(true);
        Alert.alert('Subscribed!', 'You can now book services from this celebrity.');
      } else {
        const errMsg = (data.error as string) ?? 'Subscription failed. Please try again.';
        const lower = errMsg.toLowerCase();
        if (lower.includes('insufficient') || lower.includes('balance') || lower.includes('wallet')) {
          Alert.alert('Insufficient Balance', 'Not enough wallet balance. Please add funds.');
        } else {
          Alert.alert('Error', errMsg);
        }
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleBookOrSubscribe = () => {
    if (!user) {
      router.push('/(auth)');
      return;
    }
    if (isSubscribed) {
      router.push({ pathname: '/booking/[id]', params: { id: celebrity!.id } });
    } else {
      setShowSubSheet(true);
    }
  };

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
  const bookBtnLabel = !isLoggedIn ? 'Book a Wish' : isSubscribed ? 'Book a Wish' : 'Subscribe to Book';
  const showSubscribeBanner = isLoggedIn && !isSubscribed && !subLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
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
          {/* Fav btn */}
          <TouchableOpacity
            onPress={() => setIsFav(!isFav)}
            style={[styles.favBtn, { top: insets.top + 12 }]}
          >
            <Icon name="heart" size={22} color={isFav ? '#EF4444' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Subscribe banner for non-subscribers */}
        {showSubscribeBanner && (
          <TouchableOpacity
            onPress={() => setShowSubSheet(true)}
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
            <Text style={[styles.rating, { color: colors.foreground }]}>{celebrity.rating}</Text>
            <Text style={[styles.reviews, { color: colors.mutedForeground }]}>({celebrity.reviewCount.toLocaleString('en-IN')} reviews)</Text>
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

          {/* Bio */}
          <Text style={[styles.bioTitle, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.bio, { color: colors.mutedForeground }]}>{celebrity.bio}</Text>

          {/* Tags */}
          {celebrity.tags.length > 0 && (
            <>
              <Text style={[styles.bioTitle, { color: colors.foreground }]}>What I can do for you</Text>
              <View style={styles.tagsWrap}>
                {celebrity.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Reviews */}
          <Text style={[styles.bioTitle, { color: colors.foreground }]}>Reviews</Text>
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
          onPress={() => router.push('/(tabs)/voice-call')}
        >
          <Icon name="phone" size={18} color={colors.primary} />
          <Text style={[styles.voiceCallText, { color: colors.primary }]}>Voice Call</Text>
        </TouchableOpacity>
        {isLoggedIn && !isSubscribed ? (
          <TouchableOpacity
            onPress={handleBookOrSubscribe}
            style={styles.subscribeToBookBtn}
          >
            <Icon name="lock" size={16} color="#FF6B33" />
            <Text style={styles.subscribeToBookText}>{bookBtnLabel}</Text>
          </TouchableOpacity>
        ) : (
          <Pressable
            onPress={handleBookOrSubscribe}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookBtn}>
              <Text style={styles.bookBtnText}>{bookBtnLabel}</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      {/* Subscription Gate Bottom Sheet */}
      <Modal
        visible={showSubSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowSubSheet(false)}
        />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{celebrity.name}</Text>
          <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>Subscribe to unlock all services</Text>

          {pricingPrice === null ? (
            <View style={styles.unavailableBox}>
              <Icon name="info" size={20} color={colors.mutedForeground} />
              <Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>
                Subscription not available for this celebrity
              </Text>
              <TouchableOpacity onPress={() => setShowSubSheet(false)} style={[styles.viewProfileBtn, { borderColor: colors.border }]}>
                <Text style={[styles.viewProfileText, { color: colors.foreground }]}>View Profile Only</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[styles.priceBox, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.priceBoxLabel, { color: colors.mutedForeground }]}>Subscription Price</Text>
                <Text style={[styles.priceBoxValue, { color: colors.primary }]}>₹{pricingPrice.toLocaleString('en-IN')}</Text>
              </View>

              <Pressable
                onPress={handleSubscribe}
                disabled={payLoading}
                style={({ pressed }) => [{ opacity: payLoading || pressed ? 0.75 : 1, marginBottom: 12 }]}
              >
                <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.payBtn}>
                  {payLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="credit-card" size={18} color="#fff" />
                      <Text style={styles.payBtnText}>Pay from Wallet (₹{pricingPrice.toLocaleString('en-IN')})</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <TouchableOpacity style={[styles.razorpayDisabledBtn, { borderColor: colors.border }]} disabled>
                <Text style={[styles.razorpayDisabledText, { color: colors.mutedForeground }]}>Razorpay — Coming Soon</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => setShowSubSheet(false)} style={styles.cancelLink}>
            <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
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
    backgroundColor: '#FF6B33',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  subscribeBannerText: { flex: 1, color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },
  subscribeBannerPill: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999 },
  subscribeBannerPillText: { color: '#FF6B33', fontSize: 12, fontFamily: 'Inter_700Bold' },
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
  bioTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 8, marginTop: 8 },
  bio: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, marginBottom: 16 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1 },
  tagText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
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
  subscribeToBookBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 12, borderWidth: 2, borderColor: '#FF6B33' },
  subscribeToBookText: { color: '#FF6B33', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  bookBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 4 },
  sheetSub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 24 },
  priceBox: { borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 20 },
  priceBoxLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  priceBoxValue: { fontSize: 32, fontFamily: 'Inter_700Bold' },
  payBtn: { height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  payBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  razorpayDisabledBtn: { height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8, opacity: 0.5 },
  razorpayDisabledText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  cancelLink: { alignItems: 'center', paddingVertical: 12 },
  cancelLinkText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  unavailableBox: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  unavailableText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  viewProfileBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  viewProfileText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
