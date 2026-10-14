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
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

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
              style={[styles.payBtn, { backgroundColor: '#7B5CFA12', borderColor: '#7B5CFA' }]}
              onPress={onRazorpayPay}
              disabled={payingWallet || payingRazorpay}
              activeOpacity={0.8}
            >
              {payingRazorpay ? (
                <ActivityIndicator size="small" color="#7B5CFA" />
              ) : (
                <Icon name="credit-card" size={22} color="#7B5CFA" />
              )}
              <Text style={[styles.payBtnLabel, { color: '#7B5CFA' }]}>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7B5CFA" />}
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
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search.length > 0 ? 'No celebrities found' : 'No celebrities available'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search.length > 0 ? 'Try a different name or category' : 'Check back soon for new celebrities'}
          </Text>
          {search.length > 0 && (
            <TouchableOpacity
              style={[styles.browseCelebsBtn, { borderColor: colors.primary, marginTop: 16 }]}
              onPress={() => setSearch('')}
            >
              <Text style={[styles.browseCelebsBtnText, { color: colors.primary }]}>Clear Search</Text>
            </TouchableOpacity>
          )}
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
                      <Icon name="heart" size={32} color={colors.mutedForeground} />
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

                  {pricing && (
                    <View style={styles.badgesRow}>
                      <View style={[styles.featureBadge, { backgroundColor: '#7B5CFA18' }]}>
                        <Icon name="video" size={9} color="#7B5CFA" />
                        <Text style={[styles.featureBadgeText, { color: '#7B5CFA' }]}>UGC</Text>
                      </View>
                      <View style={[styles.featureBadge, { backgroundColor: '#1F7BFF18' }]}>
                        <Icon name="zap" size={9} color="#1F7BFF" />
                        <Text style={[styles.featureBadgeText, { color: '#1F7BFF' }]}>Wishes</Text>
                      </View>
                      <View style={[styles.featureBadge, { backgroundColor: '#22C55E18' }]}>
                        <Icon name="image" size={9} color="#22C55E" />
                        <Text style={[styles.featureBadgeText, { color: '#22C55E' }]}>Promo</Text>
                      </View>
                    </View>
                  )}

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
                          ? { backgroundColor: '#7B5CFA18', borderColor: '#7B5CFA' }
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
                            ? { color: '#7B5CFA' }
                            : { color: colors.mutedForeground },
                      ]}
                    >
                      {isSub ? 'Subscribed' : pricing ? `₹${pricing.price.toLocaleString('en-IN')} - Subscribe` : 'View Profile'}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7B5CFA" />}
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7B5CFA" />}
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
                    <Icon name="heart" size={32} color={colors.mutedForeground} />
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
                    style={[styles.actionBtn, { backgroundColor: '#7B5CFA14', borderColor: '#7B5CFA40' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/occasions', params: { celebrity: celeb.id } });
                    }}
                  >
                    <Icon name="video" size={12} color="#7B5CFA" />
                    <Text style={[styles.actionBtnText, { color: '#7B5CFA' }]}>UGC</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#3B82F614', borderColor: '#3B82F640' }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/booking/[id]', params: { id: celeb.id, service: 'wish' } });
                    }}
                  >
                    <Icon name="mic" size={12} color="#3B82F6" />
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
    } catch {
      Alert.alert('Error', 'Failed to load celebrities. Pull down to refresh.');
    }
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
      } else {
        Alert.alert('Error', 'Failed to load your favorites. Pull down to refresh.');
      }
    } catch {
      Alert.alert('Error', 'Failed to load your favorites. Please check your connection.');
    }
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

  const callPurchaseRpc = useCallback(async (
    celeb: Celebrity,
    pricing: CelebrityPricing,
    paymentMethod: 'wallet' | 'razorpay',
  ) => {
    if (!profileId || !accessToken) return;

    const rpcRes = await supabaseFetch(
      '/rest/v1/rpc/purchase_celebrity_subscription',
      {
        method: 'POST',
        body: JSON.stringify({
          p_celebrity_id: celeb.id,
          p_price: pricing.price,
          p_payment_method: paymentMethod,
        }),
      },
      accessToken,
    );

    if (!rpcRes.ok) {
      const e = await rpcRes.json().catch(() => ({})) as Record<string, string>;
      throw new Error(e.message ?? e.error ?? 'Subscription failed. Please try again.');
    }

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
      await callPurchaseRpc(selectedCeleb, selectedPricing, 'wallet');

      supabaseFetch(
        `/rest/v1/profiles?select=wallet_balance&id=eq.${profileId}&limit=1`,
        {},
        accessToken,
      ).then(async (r) => {
        if (r.ok) {
          const rows = await r.json() as Array<{ wallet_balance: number }>;
          if (rows?.[0]?.wallet_balance != null) {
            updateUser({ walletBalance: rows[0].wallet_balance });
          }
        }
      }).catch(() => {});

      setModalVisible(false);
      Alert.alert('Subscribed!', `You are now subscribed to ${selectedCeleb.name}!`);
    } catch (err) {
      const errMsg = (err as Error)?.message ?? 'Something went wrong. Please try again.';
      Alert.alert('Payment Failed', errMsg);
    } finally {
      setPayingWallet(false);
    }
  }, [selectedCeleb, selectedPricing, profileId, accessToken, walletBalance, updateUser, callPurchaseRpc]);

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
        try {
          await callPurchaseRpc(selectedCeleb, selectedPricing, 'razorpay');
          setModalVisible(false);
          Alert.alert('Subscribed!', `You are now subscribed to ${selectedCeleb.name}!`);
        } catch (subErr) {
          const errMsg = (subErr as Error)?.message ?? 'Subscription could not be confirmed. Please contact support.';
          Alert.alert('Partial Payment Error', errMsg);
          console.error('callPurchaseRpc failed after Razorpay payment:', subErr);
        }
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
          theme: { color: '#7B5CFA' },
          handler: async () => {
            await onPaymentSuccess();
          },
        });
        rzp.open();
      } else {
        type RazorpayModule = { open: (opts: Record<string, unknown>) => Promise<{ razorpay_payment_id: string }> };
        let razorpayModule: RazorpayModule | null = null;
        try {
          const mod = require('react-native-razorpay') as { default?: RazorpayModule } & RazorpayModule;
          const candidate = mod.default ?? mod;
          if (candidate && typeof candidate.open === 'function') {
            razorpayModule = candidate;
          }
        } catch {
          // native module not linked
        }

        if (!razorpayModule) {
          setPayingRazorpay(false);
          Alert.alert(
            'Native Checkout Not Available',
            'Razorpay native checkout requires a custom development build (not Expo Go). Use wallet payment, or install the production app from the App Store/Play Store.',
            [{ text: 'OK' }],
          );
          return;
        }

        const data = await razorpayModule.open({
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
          theme: { color: '#7B5CFA' },
        });

        if (data?.razorpay_payment_id) {
          await onPaymentSuccess();
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
  }, [selectedCeleb, selectedPricing, profileId, accessToken, user, callPurchaseRpc]);

  if (loading) {
    return (
      <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Favorites</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7B5CFA" />
          <Text style={[{ marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>
            Loading celebrities...
          </Text>
        </View>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
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
    </View></AmbientBackground>
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
  priceText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#7B5CFA' },
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
    backgroundColor: '#7B5CFA',
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
  amtValue: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#7B5CFA' },
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
