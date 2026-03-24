import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';

function imageUri(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : B2_BASE + url;
}

interface WishOrder {
  id: string;
  user_id: string;
  celebrity_id: string;
  occasion_type: string;
  message: string;
  recipient_name: string | null;
  status: string;
  payment_status: string;
  amount_paid: number | null;
  payment_method: string | null;
  card_generation_type: string | null;
  generated_card_image_url: string | null;
  card_approved: boolean | null;
  completed_at: string | null;
  created_at: string;
  celebrities: {
    id: string;
    name: string;
    image_url: string | null;
  };
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  sent: { bg: '#22C55E20', text: '#22C55E', label: 'Sent' },
  completed: { bg: '#FF6B3320', text: '#FF6B33', label: 'Completed' },
  processing: { bg: '#6B728020', text: '#6B7280', label: 'Processing' },
  pending: { bg: 'transparent', text: '#F59E0B', label: 'Pending' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status.toLowerCase()] ?? { bg: '#6B728020', text: '#6B7280', label: status };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

async function downloadCardToDevice(cardUrl: string, orderId: string): Promise<void> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = cardUrl;
    a.download = `wish_card_${orderId}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('permission_denied');
  }
  const tempPath = (FileSystem.cacheDirectory ?? '') + `wish_card_${orderId}.jpg`;
  await FileSystem.downloadAsync(cardUrl, tempPath);
  await MediaLibrary.saveToLibraryAsync(tempPath);
}

interface OrderCardProps {
  order: WishOrder;
  isPending: boolean;
  colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];
}

function OrderCard({ order, isPending, colors }: OrderCardProps) {
  const [downloading, setDownloading] = useState(false);

  const celeb = order.celebrities;
  const avatarUri = imageUri(celeb.image_url);
  const cardUrl = order.generated_card_image_url;
  const status = getStatusConfig(order.status);

  const handleViewCard = async () => {
    if (!cardUrl) return;
    try {
      await WebBrowser.openBrowserAsync(cardUrl);
    } catch {
      Alert.alert('Error', 'Could not open the card. Please try again.');
    }
  };

  const handleDownload = async () => {
    if (!cardUrl) return;
    setDownloading(true);
    try {
      await downloadCardToDevice(cardUrl, order.id);
      Alert.alert('Saved!', 'Greeting card saved to your gallery.');
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'permission_denied'
          ? 'Please allow media library access to save the card to your device.'
          : 'Could not download the card. Please try again.';
      Alert.alert('Download Failed', msg);
    } finally {
      setDownloading(false);
    }
  };

  const handleContinueWish = () => {
    router.push({
      pathname: '/wish-confirmation/[id]',
      params: { id: order.id },
    } as never);
  };

  const handleViewConversation = () => {
    router.push('/messages');
  };

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: isPending ? '#FF6B33' : '#22C55E',
          borderLeftWidth: 4,
        },
      ]}
    >
      <View style={s.topRow}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={s.avatar} resizeMode="cover" />
        ) : (
          <View style={[s.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="heart" size={24} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.celebName, { color: colors.foreground }]} numberOfLines={1}>
            {celeb.name}
          </Text>
          <Text style={[s.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {order.occasion_type}
            {order.recipient_name ? ` · For ${order.recipient_name}` : ''}
          </Text>
          {order.amount_paid != null && (
            <Text style={[s.amount, { color: colors.primary }]}>
              ₹{order.amount_paid.toLocaleString('en-IN')}
            </Text>
          )}
          <Text style={[s.date, { color: colors.mutedForeground }]}>
            {formatDate(order.created_at)}
          </Text>
        </View>
        <View
          style={[
            s.statusBadge,
            {
              backgroundColor: status.bg,
              borderWidth: order.status.toLowerCase() === 'pending' ? 1 : 0,
              borderColor: status.text,
            },
          ]}
        >
          <Text style={[s.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      {order.message.length > 0 && (
        <Text style={[s.message, { color: colors.mutedForeground }]} numberOfLines={2}>
          {order.message}
        </Text>
      )}

      <View style={s.actions}>
        {isPending ? (
          <>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340', flex: 1 }]}
              onPress={handleContinueWish}
              activeOpacity={0.8}
            >
              <Icon name="arrow-right" size={14} color="#FF6B33" />
              <Text style={[s.actionText, { color: '#FF6B33' }]}>Continue Wish</Text>
            </TouchableOpacity>
            {cardUrl ? (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={handleViewCard}
                activeOpacity={0.8}
              >
                <Icon name="eye" size={14} color={colors.foreground} />
                <Text style={[s.actionText, { color: colors.foreground }]}>View Card</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#3B82F615', borderColor: '#3B82F640', flex: 1 }]}
              onPress={handleViewConversation}
              activeOpacity={0.8}
            >
              <Icon name="message-circle" size={14} color="#3B82F6" />
              <Text style={[s.actionText, { color: '#3B82F6' }]}>View Conversation</Text>
            </TouchableOpacity>
            {cardUrl ? (
              <>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={handleViewCard}
                  activeOpacity={0.8}
                >
                  <Icon name="eye" size={14} color={colors.foreground} />
                  <Text style={[s.actionText, { color: colors.foreground }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: '#22C55E15', borderColor: '#22C55E40' }]}
                  onPress={handleDownload}
                  disabled={downloading}
                  activeOpacity={0.8}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#22C55E" />
                  ) : (
                    <Icon name="download" size={14} color="#22C55E" />
                  )}
                  <Text style={[s.actionText, { color: '#22C55E' }]}>
                    {downloading ? 'Saving...' : 'Download'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

export default function WishOrdersScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;

  const [orders, setOrders] = useState<WishOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!profileId || !accessToken) {
      setOrders([]);
      return;
    }
    try {
      const res = await supabaseFetch(
        `/rest/v1/wish_celebrity_orders?select=*,celebrities(id,name,image_url)&user_id=eq.${profileId}&order=created_at.desc`,
        {},
        accessToken,
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        Alert.alert('Error', `Failed to load wish orders (${res.status}). ${errText || 'Please try again.'}`);
        return;
      }
      const rows = await res.json() as WishOrder[];
      setOrders(rows ?? []);
    } catch (err) {
      Alert.alert('Error', 'Could not load wish orders. Please check your connection.');
      console.error('fetchOrders error:', err);
    }
  }, [profileId, accessToken]);

  useEffect(() => {
    setLoading(true);
    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  const pendingOrders = orders.filter(
    (o) => o.payment_status === 'completed' && o.status !== 'sent',
  );
  const completedOrders = orders.filter((o) => o.status === 'sent');

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          s.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>My Wish Orders</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]}>
            Track your celebrity wishes
          </Text>
        </View>
        <TouchableOpacity
          style={[s.newWishBtn, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340' }]}
          onPress={() => router.push('/wish-celebrity')}
          activeOpacity={0.8}
        >
          <Icon name="plus" size={14} color="#FF6B33" />
          <Text style={[s.newWishText, { color: '#FF6B33' }]}>New Wish</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#FF6B33" />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading orders...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF6B33" />
          }
        >
          {orders.length === 0 ? (
            <View style={s.emptyWrap}>
              <Icon name="gift" size={56} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No wish orders yet</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Send a celebrity greeting card to someone special
              </Text>
              <TouchableOpacity
                style={[s.emptyBtn, { backgroundColor: '#FF6B33', borderColor: '#FF6B33' }]}
                onPress={() => router.push('/wish-celebrity')}
                activeOpacity={0.85}
              >
                <Icon name="gift" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Create Your First Wish</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {pendingOrders.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <View style={[s.sectionDot, { backgroundColor: '#FF6B33' }]} />
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                      Active / Pending Orders
                    </Text>
                    <View style={[s.sectionCount, { backgroundColor: '#FF6B3320' }]}>
                      <Text style={[s.sectionCountText, { color: '#FF6B33' }]}>
                        {pendingOrders.length}
                      </Text>
                    </View>
                  </View>
                  {pendingOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isPending={true}
                      colors={colors}
                    />
                  ))}
                </View>
              )}

              {completedOrders.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <View style={[s.sectionDot, { backgroundColor: '#22C55E' }]} />
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                      Completed Wishes
                    </Text>
                    <View style={[s.sectionCount, { backgroundColor: '#22C55E20' }]}>
                      <Text style={[s.sectionCountText, { color: '#22C55E' }]}>
                        {completedOrders.length}
                      </Text>
                    </View>
                  </View>
                  {completedOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isPending={false}
                      colors={colors}
                    />
                  ))}
                </View>
              )}

              {pendingOrders.length === 0 && completedOrders.length === 0 && orders.length > 0 && (
                <View style={s.emptyWrap}>
                  <Icon name="clock" size={40} color={colors.mutedForeground} />
                  <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                    All orders are being processed
                  </Text>
                  <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                    Pull down to refresh
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  newWishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  newWishText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  scrollContent: { padding: 16, gap: 0 },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  sectionCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  sectionCountText: { fontSize: 12, fontFamily: 'Inter_700Bold' },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  amount: { fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  date: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  message: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },

  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  actionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
