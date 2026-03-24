import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { format } from 'date-fns';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
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
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 44) / 2;
const IMG_H = CARD_W * (3 / 4);

type ColorsType = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

interface Celebrity {
  id: string;
  name: string;
  category: string;
  image_url: string;
  location?: string;
  rating?: number;
  review_count?: number;
  is_verified: boolean;
  is_active: boolean;
}

interface CelebrityPricing {
  id: string;
  celebrity_id: string;
  price: number;
  referrer_commission_percentage: number;
  celebrity_commission_percentage: number;
  is_enabled: boolean;
}

interface FavoriteRow {
  id: string;
  user_id: string;
  celebrity_id: string;
  price_paid: number;
  referrer_commission: number;
  celebrity_commission: number;
  status: string;
  created_at: string;
  celebrities: {
    id: string;
    name: string;
    category: string;
    image_url: string;
    rating?: number;
    review_count?: number;
    is_verified: boolean;
  };
}

interface PaymentModalProps {
  visible: boolean;
  celeb: Celebrity;
  pricing: CelebrityPricing;
  walletBalance: number;
  onClose: () => void;
  onWalletPay: () => Promise<void>;
  onRazorpayPay: () => Promise<void>;
  payingWallet: boolean;
  payingRazorpay: boolean;
  colors: ColorsType;
}

function PaymentModal({
  visible, celeb, pricing, walletBalance,
  onClose, onWalletPay, onRazorpayPay,
  payingWallet, payingRazorpay, colors,
}: PaymentModalProps) {
  const walletInsufficient = walletBalance < pricing.price;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Subscribe to {celeb.name}</Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
            Lifetime access to UGC videos, wishes & promotions
          </Text>

          <View style={styles.amtBox}>
            <Text style={[styles.amtLabel, { color: colors.mutedForeground }]}>Total Amount</Text>
            <Text style={styles.amtValue}>₹{pricing.price.toLocaleString('en-IN')}</Text>
            <Text style={[styles.lifetimeText, { color: colors.mutedForeground }]}>Lifetime access</Text>
          </View>

          <View style={[styles.balanceRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Icon name="credit-card" size={16} color={colors.mutedForeground} />
            <Text style={[styles.balanceText, { color: colors.mutedForeground }]}>Wallet Balance</Text>
            <Text style={[styles.balanceAmt, { color: walletInsufficient ? '#EF4444' : '#22C55E' }]}>
              ₹{walletBalance.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.payRow}>
            <TouchableOpacity
              style={[
                styles.payBtn,
                { backgroundColor: colors.background, borderColor: walletInsufficient ? '#EF4444' : colors.primary, opacity: walletInsufficient ? 0.6 : 1 },
              ]}
              onPress={onWalletPay}
              disabled={walletInsufficient || payingWallet || payingRazorpay}
              activeOpacity={0.8}
            >
              {payingWallet ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Icon name="credit-card" size={22} color={walletInsufficient ? '#EF4444' : colors.primary} />
              )}
              <Text style={[styles.payBtnLabel, { color: walletInsufficient ? '#EF4444' : colors.primary }]}>
                Pay ₹{pricing.price.toLocaleString('en-IN')}
              </Text>
              <Text style={[styles.payBtnSub, { color: colors.mutedForeground }]}>Wallet</Text>
              {walletInsufficient && (
                <View style={styles.insufficientBadge}>
                  <Text style={styles.insufficientText}>Insufficient</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: '#FF6B3312', borderColor: '#FF6B33' }]}
              onPress={onRazorpayPay}
              disabled={payingWallet || payingRazorpay}
              activeOpacity={0.8}
            >
              {payingRazorpay ? (
                <ActivityIndicator size="small" color="#FF6B33" />
              ) : (
                <Icon name="credit-card" size={22} color="#FF6B33" />
              )}
              <Text style={[styles.payBtnLabel, { color: '#FF6B33' }]}>
                Pay ₹{pricing.price.toLocaleString('en-IN')}
              </Text>
              <Text style={[styles.payBtnSub, { color: colors.mutedForeground }]}>Razorpay</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

interface BrowseTabProps {
  celebrities: Celebrity[];
  pricingMap: Map<string, CelebrityPricing>;
  subscribedIds: Set<string>;
  walletBalance: number;
  colors: ColorsType;
  bottomPad: number;
  refreshing: boolean;
  onRefresh: () => void;
  onSubscribePress: (celeb: Celebrity, pricing: CelebrityPricing) => void;
}

function BrowseTab({
  celebrities, pricingMap, subscribedIds,
  walletBalance, colors, bottomPad, refreshing, onRefresh, onSubscribePress,
}: BrowseTabProps) {
  const [search, setSearch] = useState('');

  const filtered = celebrities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.listPad, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B33" />}
    >
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search celebrities..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="search" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No celebrities found</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Try a different name or category
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {filtered.map((celeb) => {
            const pricing = pricingMap.get(celeb.id);
            const isSub = subscribedIds.has(celeb.id);
            const imageUri = celeb.image_url
              ? celeb.image_url.startsWith('http')
                ? celeb.image_url
                : `https://f005.backblazeb2.com/file/wishmetoday/${celeb.image_url}`
              : null;

            return (
              <TouchableOpacity
                key={celeb.id}
                activeOpacity={0.92}
                onPress={() => router.push({ pathname: '/celebrity/[id]', params: { id: celeb.id } })}
                style={[styles.browseCard, { backgroundColor: colors.card, borderColor: colors.border, width: CARD_W }]}
              >
                <View style={[styles.imgContainer, { height: IMG_H }]}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.browseImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.imgPlaceholder, { backgroundColor: colors.border }]}>
                      <Icon name="user" size={32} color={colors.mutedForeground} />
                    </View>
                  )}
                  {celeb.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Icon name="check-circle" size={14} color="#fff" />
                    </View>
                  )}
                  {isSub && (
                    <View style={styles.subscribedBadge}>
                      <Text style={styles.subscribedBadgeText}>Subscribed</Text>
                    </View>
                  )}
                </View>

                <View style={styles.browseInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.browseName, { color: colors.foreground }]} numberOfLines={1}>
                      {celeb.name}
                    </Text>
                  </View>
                  <Text style={[styles.browseCat, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {celeb.category}
                  </Text>
                  {celeb.location ? (
                    <Text style={[styles.browseLocation, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {celeb.location}
                    </Text>
                  ) : null}

                  {(celeb.rating != null || celeb.review_count != null) && (
                    <View style={styles.ratingRow}>
                      <Icon name="star" size={11} color="#F59E0B" />
                      <Text style={[styles.ratingText, { color: colors.foreground }]}>
                        {celeb.rating?.toFixed(1) ?? '–'}
                      </Text>
                      {celeb.review_count != null && (
                        <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>
                          ({celeb.review_count})
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={styles.badgesRow}>
                    <View style={[styles.featureBadge, { backgroundColor: '#FF6B3318' }]}>
                      <Icon name="video" size={9} color="#FF6B33" />
                      <Text style={[styles.featureBadgeText, { color: '#FF6B33' }]}>UGC</Text>
                    </View>
                    <View style={[styles.featureBadge, { backgroundColor: '#B44CFF18' }]}>
                      <Icon name="zap" size={9} color="#B44CFF" />
                      <Text style={[styles.featureBadgeText, { color: '#B44CFF' }]}>Wishes</Text>
                    </View>
                    <View style={[styles.featureBadge, { backgroundColor: '#22C55E18' }]}>
                      <Icon name="image" size={9} color="#22C55E" />
                      <Text style={[styles.featureBadgeText, { color: '#22C55E' }]}>Promo</Text>
                    </View>
                  </View>

                  {pricing ? (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceText}>₹{pricing.price.toLocaleString('en-IN')}</Text>
                      <Text style={[styles.lifetimeLabel, { color: colors.mutedForeground }]}>lifetime</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!pricing) {
                        router.push({ pathname: '/celebrity/[id]', params: { id: celeb.id } });
                      } else if (!isSub) {
                        onSubscribePress(celeb, pricing);
                      }
                    }}
                    style={[
                      styles.subBtn,
                      isSub
                        ? { backgroundColor: '#22C55E18', borderColor: '#22C55E' }
                        : pricing
                          ? { backgroundColor: '#FF6B3318', borderColor: '#FF6B33' }
                          : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    disabled={isSub}
                  >
                    <Text
                      style={[
                        styles.subBtnText,
                        isSub
                          ? { color: '#22C55E' }
                          : pricing
                            ? { color: '#FF6B33' }
                            : { color: colors.mutedForeground },
                      ]}
                    >
                      {isSub ? 'Subscribed' : pricing ? 'Subscribe' : 'View Profile'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

interface MyFavTabProps {
  favorites: FavoriteRow[];
  colors: ColorsType;
  bottomPad: number;
  refreshing: boolean;
  onRefresh: () => void;
  onBrowse: () => void;
}

function MyFavoritesTab({ favorites, colors, bottomPad, refreshing, onRefresh, onBrowse }: MyFavTabProps) {
  if (favorites.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyFull}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B33" />}
      >
        <Icon name="heart" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No favorites yet</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Subscribe to celebrities to save them here
        </Text>
        <TouchableOpacity
          style={[styles.browseCelebsBtn, { borderColor: colors.primary }]}
          onPress={onBrowse}
        >
          <Text style={[styles.browseCelebsBtnText, { color: colors.primary }]}>Browse Celebrities</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.listPad, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B33" />}
    >
      <View style={styles.grid}>
        {favorites.map((fav) => {
          const celeb = fav.celebrities;
          const imageUri = celeb.image_url
            ? celeb.image_url.startsWith('http')
              ? celeb.image_url
              : `https://f005.backblazeb2.com/file/wishmetoday/${celeb.image_url}`
            : null;
          let dateStr = '';
          try {
            dateStr = format(new Date(fav.created_at), 'PP');
          } catch {
            dateStr = fav.created_at.slice(0, 10);
          }

          return (
            <TouchableOpacity
              key={fav.id}
              activeOpacity={0.92}
              onPress={() => router.push({ pathname: '/celebrity/[id]', params: { id: celeb.id } })}
              style={[styles.browseCard, { backgroundColor: colors.card, borderColor: colors.border, width: CARD_W }]}
            >
              <View style={[styles.imgContainer, { height: IMG_H }]}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.browseImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.imgPlaceholder, { backgroundColor: colors.border }]}>
                    <Icon name="user" size={32} color={colors.mutedForeground} />
                  </View>
                )}
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
                {celeb.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <Icon name="check-circle" size={14} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.browseInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.browseName, { color: colors.foreground }]} numberOfLines={1}>
                    {celeb.name}
                  </Text>
                </View>
                <Text style={[styles.browseCat, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {celeb.category}
                </Text>

                {(celeb.rating != null) && (
                  <View style={styles.ratingRow}>
                    <Icon name="star" size={11} color="#F59E0B" />
                    <Text style={[styles.ratingText, { color: colors.foreground }]}>
                      {celeb.rating.toFixed(1)}
                    </Text>
                    {celeb.review_count != null && (
                      <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>
                        ({celeb.review_count})
                      </Text>
                    )}
                  </View>
                )}

                <Text style={[styles.subDate, { color: colors.mutedForeground }]}>Since {dateStr}</Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({ pathname: '/wish-celebrity', params: { id: celeb.id } });
                  }}
                  style={styles.wishBtn}
                >
                  <Text style={styles.wishBtnText}>Wish Celebrity</Text>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FF6B3314', borderColor: '#FF6B3340' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/occasions', params: { celebrity: celeb.id } });
                    }}
                  >
                    <Icon name="video" size={12} color="#FF6B33" />
                    <Text style={[styles.actionBtnText, { color: '#FF6B33' }]}>UGC</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#3B82F614', borderColor: '#3B82F640' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/booking/[id]', params: { id: celeb.id, service: 'wish' } });
                    }}
                  >
                    <Icon name="calendar" size={12} color="#3B82F6" />
                    <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Book</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#22C55E14', borderColor: '#22C55E40' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/image-promotions', params: { celebrity: celeb.id } });
                    }}
                  >
                    <Icon name="image" size={12} color="#22C55E" />
                    <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Promo</Text>
                  </TouchableOpacity>
                </View>
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
  const { user, session, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;

  const [activeTab, setActiveTab] = useState<'browse' | 'favorites'>('browse');

  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [pricingMap, setPricingMap] = useState<Map<string, CelebrityPricing>>(new Map());
  const [userFavorites, setUserFavorites] = useState<FavoriteRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCeleb, setSelectedCeleb] = useState<Celebrity | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<CelebrityPricing | null>(null);
  const [payingWallet, setPayingWallet] = useState(false);
  const [payingRazorpay, setPayingRazorpay] = useState(false);

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;
  const walletBalance = user?.walletBalance ?? 0;

  const subscribedIds = new Set(userFavorites.map((f) => f.celebrity_id));

  const fetchCelebrities = useCallback(async () => {
    try {
      const [celebRes, pricingRes] = await Promise.all([
        supabaseFetch('/rest/v1/celebrities?is_active=eq.true&order=name.asc', {}, accessToken),
        supabaseFetch('/rest/v1/celebrity_favorite_pricing?is_enabled=eq.true', {}, accessToken),
      ]);
      if (celebRes.ok) {
        const rows = await celebRes.json() as Celebrity[];
        setCelebrities(rows ?? []);
      }
      if (pricingRes.ok) {
        const prows = await pricingRes.json() as CelebrityPricing[];
        const map = new Map<string, CelebrityPricing>();
        (prows ?? []).forEach((p) => map.set(p.celebrity_id, p));
        setPricingMap(map);
      }
    } catch {}
  }, [accessToken]);

  const fetchUserFavorites = useCallback(async () => {
    if (!profileId || !accessToken) return;
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_favorites?select=*,celebrities(*)&user_id=eq.${profileId}&status=eq.active`,
        {},
        accessToken,
      );
      if (res.ok) {
        const rows = await res.json() as FavoriteRow[];
        setUserFavorites(rows ?? []);
      }
    } catch {}
  }, [profileId, accessToken]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchCelebrities(), fetchUserFavorites()]);
  }, [fetchCelebrities, fetchUserFavorites]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const openPaymentModal = (celeb: Celebrity, pricing: CelebrityPricing) => {
    setSelectedCeleb(celeb);
    setSelectedPricing(pricing);
    setModalVisible(true);
  };

  const processSubscription = useCallback(async (
    celeb: Celebrity,
    pricing: CelebrityPricing,
  ) => {
    if (!profileId || !accessToken) return;

    const referrerCommission = Math.floor(pricing.price * pricing.referrer_commission_percentage / 100);
    const celebrityCommission = Math.floor(pricing.price * pricing.celebrity_commission_percentage / 100);

    try {
      await supabaseFetch(
        '/rest/v1/celebrity_favorites',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({
            user_id: profileId,
            celebrity_id: celeb.id,
            price_paid: pricing.price,
            referrer_commission: referrerCommission,
            celebrity_commission: celebrityCommission,
            status: 'active',
          }),
        },
        accessToken,
      );
    } catch {}

    try {
      const profileRes = await supabaseFetch(
        `/rest/v1/profiles?select=referred_by&id=eq.${profileId}&limit=1`,
        {},
        accessToken,
      );
      if (profileRes.ok) {
        const profiles = await profileRes.json() as Array<{ referred_by: string | null }>;
        const referredBy = profiles?.[0]?.referred_by;
        if (referredBy) {
          await supabaseFetch(
            '/rest/v1/referral_transactions',
            {
              method: 'POST',
              headers: { Prefer: 'return=minimal' } as Record<string, string>,
              body: JSON.stringify({
                referrer_id: referredBy,
                referred_id: profileId,
                booking_id: null,
                commission_level: 1,
                commission_amount: referrerCommission,
                status: 'completed',
              }),
            },
            accessToken,
          );
        }
      }
    } catch {}

    try {
      const celebDetailsRes = await supabaseFetch(
        `/rest/v1/celebrities?select=pan_verified,total_earnings,available_balance&id=eq.${celeb.id}&limit=1`,
        {},
        accessToken,
      );
      if (celebDetailsRes.ok) {
        const celebDetails = await celebDetailsRes.json() as Array<{
          pan_verified: boolean;
          total_earnings: number;
          available_balance: number;
        }>;
        const details = celebDetails?.[0];
        if (details) {
          const tdsRate = details.pan_verified ? 10 : 20;
          const tdsAmount = Math.floor(celebrityCommission * tdsRate / 100);
          const netCommission = celebrityCommission - tdsAmount;

          await supabaseFetch(
            '/rest/v1/celebrity_wallet_transactions',
            {
              method: 'POST',
              headers: { Prefer: 'return=minimal' } as Record<string, string>,
              body: JSON.stringify({
                celebrity_id: celeb.id,
                transaction_type: 'favorite_subscription',
                gross_amount: celebrityCommission,
                tds_percentage: tdsRate,
                tds_amount: tdsAmount,
                amount: netCommission,
                description: `Favorite subscription commission (TDS ${tdsRate}% deducted)`,
                status: 'completed',
              }),
            },
            accessToken,
          );

          await supabaseFetch(
            `/rest/v1/celebrities?id=eq.${celeb.id}`,
            {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' } as Record<string, string>,
              body: JSON.stringify({
                total_earnings: (details.total_earnings ?? 0) + netCommission,
                available_balance: (details.available_balance ?? 0) + netCommission,
              }),
            },
            accessToken,
          );
        }
      }
    } catch {}

    supabaseFetch(
      '/functions/v1/send-celebrity-subscription-email',
      {
        method: 'POST',
        body: JSON.stringify({
          celebrity_id: celeb.id,
          subscriber_name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          subscriber_email: user?.email ?? '',
          price_paid: pricing.price,
        }),
      },
      accessToken,
    ).catch(() => {});

    await fetchUserFavorites();
  }, [profileId, accessToken, user, fetchUserFavorites]);

  const handleWalletPay = useCallback(async () => {
    if (!selectedCeleb || !selectedPricing || !profileId || !accessToken) return;
    if (walletBalance < selectedPricing.price) {
      Alert.alert('Insufficient Balance', 'Please add money to your wallet first.');
      return;
    }
    setPayingWallet(true);
    try {
      const txRes = await supabaseFetch(
        '/rest/v1/wallet_transactions',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({
            user_id: profileId,
            transaction_type: 'celebrity_subscription',
            amount: selectedPricing.price,
            status: 'completed',
            payment_method: 'wallet',
            transaction_details: {
              celebrity_id: selectedCeleb.id,
              celebrity_name: selectedCeleb.name,
              subscription_type: 'favorite',
            },
          }),
        },
        accessToken,
      );
      if (!txRes.ok) {
        const e = await txRes.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Payment Failed', e.message ?? 'Could not deduct from wallet. Please try again.');
        return;
      }

      updateUser({ walletBalance: walletBalance - selectedPricing.price });

      await processSubscription(selectedCeleb, selectedPricing);

      setModalVisible(false);
      Alert.alert('Subscribed!', `You are now subscribed to ${selectedCeleb.name}!`);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setPayingWallet(false);
    }
  }, [selectedCeleb, selectedPricing, profileId, accessToken, walletBalance, updateUser, processSubscription]);

  const handleRazorpayPay = useCallback(async () => {
    if (!selectedCeleb || !selectedPricing || !profileId || !accessToken) return;
    setPayingRazorpay(true);

    try {
      const orderRes = await supabaseFetch(
        '/functions/v1/create-razorpay-order',
        {
          method: 'POST',
          body: JSON.stringify({
            amount: selectedPricing.price,
            currency: 'INR',
            receipt: `fav_${Date.now()}_${profileId.slice(0, 6)}`,
            notes: {
              user_id: profileId,
              celebrity_id: selectedCeleb.id,
              type: 'celebrity_favorite',
            },
          }),
        },
        accessToken,
      );

      if (!orderRes.ok) {
        const e = await orderRes.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', e.error ?? 'Failed to create payment order. Please try again.');
        return;
      }

      const order = await orderRes.json() as { id: string; amount: number; currency: string; key_id: string };
      const prefillName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

      const onPaymentSuccess = async () => {
        await processSubscription(selectedCeleb, selectedPricing);
        setModalVisible(false);
        Alert.alert('Subscribed!', `You are now subscribed to ${selectedCeleb.name}!`);
      };

      if (Platform.OS === 'web') {
        await loadRazorpayScript();
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency ?? 'INR',
          order_id: order.id,
          name: 'WishMe',
          description: `Subscribe to ${selectedCeleb.name}`,
          prefill: {
            name: prefillName,
            email: user?.email ?? '',
            contact: user?.phone ?? '',
          },
          theme: { color: '#FF6B33' },
          handler: async () => {
            await onPaymentSuccess();
          },
        });
        rzp.open();
      } else {
        let usedNativeSDK = false;
        try {
          const mod = require('react-native-razorpay');
          const RazorpayCheckout = mod.default ?? mod;
          if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
            usedNativeSDK = true;
            const data = await RazorpayCheckout.open({
              key: order.key_id,
              amount: String(order.amount),
              currency: order.currency ?? 'INR',
              order_id: order.id,
              name: 'WishMe',
              description: `Subscribe to ${selectedCeleb.name}`,
              prefill: {
                name: prefillName,
                email: user?.email ?? '',
                contact: user?.phone ?? '',
              },
              theme: { color: '#FF6B33' },
            }) as { razorpay_payment_id: string };

            if (data?.razorpay_payment_id) {
              await onPaymentSuccess();
            }
          }
        } catch {
          usedNativeSDK = false;
        }

        if (!usedNativeSDK) {
          const callbackBase = Linking.createURL('payment/callback');
          const html = `<!DOCTYPE html><html><body style="margin:0;background:#fff;">
<script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
<script>
var rzp = new Razorpay({
  key: "${order.key_id}",
  amount: "${order.amount}",
  currency: "${order.currency ?? 'INR'}",
  order_id: "${order.id}",
  name: "WishMe",
  description: "Subscribe to ${selectedCeleb.name.replace(/"/g, '')}",
  prefill: { name: "${prefillName.replace(/"/g, '')}", email: "${(user?.email ?? '').replace(/"/g, '')}", contact: "${(user?.phone ?? '').replace(/"/g, '')}" },
  theme: { color: "#FF6B33" },
  handler: function(r) {
    window.location.href = "${callbackBase}?payment_id=" + r.razorpay_payment_id + "&status=success";
  },
  modal: { ondismiss: function() { window.location.href = "${callbackBase}?cancelled=1"; } }
});
rzp.open();
<\/script></body></html>`;

          const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
          const result = await WebBrowser.openAuthSessionAsync(dataUri, callbackBase);

          if (result.type === 'success' && result.url) {
            const parsed = Linking.parse(result.url);
            const qp = parsed.queryParams ?? {};
            if (qp['status'] === 'success' && qp['payment_id']) {
              await onPaymentSuccess();
            }
          }
        }
      }
    } catch (err) {
      const errMsg = (err as Record<string, string>)?.description ?? 'Payment failed. Please try again.';
      if (!errMsg.toLowerCase().includes('cancel')) {
        Alert.alert('Payment Error', errMsg);
      }
    } finally {
      setPayingRazorpay(false);
    }
  }, [selectedCeleb, selectedPricing, profileId, accessToken, user, processSubscription]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Favorites</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B33" />
          <Text style={[{ marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>
            Loading celebrities...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Favorites</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            Subscribe for lifetime access
          </Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('browse')}
          style={[styles.tabItem, activeTab === 'browse' && styles.tabItemActive]}
        >
          <View style={styles.tabInner}>
            <Icon name="search" size={15} color={activeTab === 'browse' ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === 'browse' ? colors.primary : colors.mutedForeground },
              activeTab === 'browse' && styles.tabLabelActive]}>
              Browse
            </Text>
          </View>
          {activeTab === 'browse' && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('favorites')}
          style={[styles.tabItem, activeTab === 'favorites' && styles.tabItemActive]}
        >
          <View style={styles.tabInner}>
            <Icon name="heart" size={15} color={activeTab === 'favorites' ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === 'favorites' ? colors.primary : colors.mutedForeground },
              activeTab === 'favorites' && styles.tabLabelActive]}>
              My Favorites ({userFavorites.length})
            </Text>
          </View>
          {activeTab === 'favorites' && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'browse' ? (
        <BrowseTab
          celebrities={celebrities}
          pricingMap={pricingMap}
          subscribedIds={subscribedIds}
          walletBalance={walletBalance}
          colors={colors}
          bottomPad={bottomPad}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onSubscribePress={openPaymentModal}
        />
      ) : (
        <MyFavoritesTab
          favorites={userFavorites}
          colors={colors}
          bottomPad={bottomPad}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onBrowse={() => setActiveTab('browse')}
        />
      )}

      {modalVisible && selectedCeleb && selectedPricing && (
        <PaymentModal
          visible={modalVisible}
          celeb={selectedCeleb}
          pricing={selectedPricing}
          walletBalance={walletBalance}
          onClose={() => setModalVisible(false)}
          onWalletPay={handleWalletPay}
          onRazorpayPay={handleRazorpayPay}
          payingWallet={payingWallet}
          payingRazorpay={payingRazorpay}
          colors={colors}
        />
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  headerSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabItemActive: {},
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
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
  imgContainer: { position: 'relative', width: '100%' },
  browseImage: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center',
  },
  subscribedBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#22C55E', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  subscribedBadgeText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  activeBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#22C55E', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  activeBadgeText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  browseInfo: { padding: 10, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  browseName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  browseCat: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  browseLocation: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  ratingText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  reviewCount: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  badgesRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  featureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
  },
  featureBadgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  priceText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FF6B33' },
  lifetimeLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  subDate: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  subBtn: {
    borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center', marginTop: 6,
  },
  subBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  wishBtn: {
    borderRadius: 8, paddingVertical: 7,
    alignItems: 'center', marginTop: 6,
    backgroundColor: '#FF6B33',
  },
  wishBtnText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  actionRow: { flexDirection: 'row', gap: 4, marginTop: 5 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, borderRadius: 7, paddingVertical: 5, borderWidth: 1,
  },
  actionBtnText: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyFull: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  browseCelebsBtn: {
    marginTop: 8, borderWidth: 1.5, borderRadius: 9999,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  browseCelebsBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#ccc',
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 6 },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 20 },
  amtBox: { alignItems: 'center', marginBottom: 16 },
  amtLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  amtValue: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#FF6B33' },
  lifetimeText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20,
  },
  balanceText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  balanceAmt: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  payRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  payBtn: {
    flex: 1, height: 132, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative',
  },
  payBtnLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  payBtnSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  insufficientBadge: {
    position: 'absolute', bottom: 8,
    backgroundColor: '#EF4444', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  insufficientText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
