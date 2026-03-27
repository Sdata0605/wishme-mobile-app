import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Session, User } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

type ColorsType = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function fmtRupee(n: number): string {
  return '₹' + (n ?? 0).toLocaleString('en-IN');
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#22C55E',
  completed: '#22C55E',
  rejected: '#EF4444',
  declined: '#EF4444',
  in_progress: '#3B82F6',
  approved: '#22C55E',
  submitted: '#3B82F6',
  active: '#22C55E',
  paid: '#22C55E',
  failed: '#EF4444',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#6B7280';
  return (
    <View style={[sBadge.wrap, { backgroundColor: color + '22' }]}>
      <Text style={[sBadge.text, { color }]}>{status}</Text>
    </View>
  );
}
const sBadge = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  text: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
});

interface Celebrity {
  id: string;
  profile_id: string;
  name: string;
  category: string;
  bio: string;
  image_url: string;
  available_balance: number;
  rating: number;
  review_count: number;
  consent_status: string;
  consent_photo_url: string;
  consent_video_url: string;
  date_of_birth: string;
  anniversary: string;
  social_media: Record<string, string>;
  service_prices: Record<string, number>;
  status: string;
  commission_percentage?: number;
  delivery_time?: number;
}

interface Booking {
  id: string;
  celebrity_id: string;
  profile_id: string;
  service_type: string;
  final_price: number;
  celebrity_commission: number;
  status: string;
  created_at: string;
  message?: string;
  fan_name?: string;
  profiles?: { first_name: string; last_name: string };
}

interface ImagePromotion {
  id: string;
  concept: string;
  price_paid: number;
  status: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string };
}

const TABS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'bookings', label: 'Bookings', icon: 'credit-card' },
  { key: 'wallet', label: 'Wallet', icon: 'credit-card' },
  { key: 'messages', label: 'Messages', icon: 'message-circle' },
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'consent', label: 'Consent', icon: 'shield' },
  { key: 'reviews', label: 'Reviews', icon: 'star' },
  { key: 'followers', label: 'Followers', icon: 'heart' },
  { key: 'content', label: 'Content', icon: 'image' },
  { key: 'tds', label: 'TDS', icon: 'trending-up' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

export default function CelebrityDashboardScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;

  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [notCeleb, setNotCeleb] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('bookings');
  const [stats, setStats] = useState({ totalEarnings: 0, pendingEarnings: 0, totalBookings: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCelebrity = useCallback(async () => {
    if (!user?.profileId || !session?.access_token) { setLoading(false); return; }
    setFetchError(null);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrities?profile_id=eq.${user.profileId}&select=*&limit=1`,
        {},
        session.access_token,
      );
      if (!res.ok) {
        setFetchError(`Failed to load celebrity data (${res.status}). Please pull to refresh.`);
        setLoading(false);
        return;
      }
      const rows = await res.json() as Celebrity[];
      if (!rows || rows.length === 0) {
        setNotCeleb(true);
        setLoading(false);
        return;
      }
      const celeb = rows[0];
      setCelebrity(celeb);

      const bkRes = await supabaseFetch(
        `/rest/v1/bookings?celebrity_id=eq.${celeb.id}&select=status,celebrity_commission`,
        {},
        session.access_token,
      );
      if (bkRes.ok) {
        const bks = await bkRes.json() as Array<{ status: string; celebrity_commission: number }>;
        const totalEarnings = bks.filter(b => b.status === 'completed').reduce((s, b) => s + (b.celebrity_commission ?? 0), 0);
        const pendingEarnings = bks.filter(b => ['pending', 'in_progress', 'accepted'].includes(b.status)).reduce((s, b) => s + (b.celebrity_commission ?? 0), 0);
        setStats({ totalEarnings, pendingEarnings, totalBookings: bks.length });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setFetchError(`${msg}. Please pull to refresh.`);
    } finally {
      setLoading(false);
    }
  }, [user?.profileId, session?.access_token]);

  useEffect(() => { fetchCelebrity(); }, [fetchCelebrity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCelebrity();
    setRefreshing(false);
  }, [fetchCelebrity]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#FF6B33" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Dashboard</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <Icon name="alert-circle" size={48} color="#EF4444" />
          <Text style={[styles.accessTitle, { color: colors.foreground }]}>Something went wrong</Text>
          <Text style={[styles.accessSub, { color: colors.mutedForeground }]}>{fetchError}</Text>
          <TouchableOpacity style={[styles.backBtn, { borderColor: colors.primary }]} onPress={() => { setFetchError(null); setLoading(true); fetchCelebrity(); }}>
            <Text style={[styles.backBtnText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (notCeleb) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Dashboard</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.center}>
          <Icon name="shield" size={48} color={colors.mutedForeground} />
          <Text style={[styles.accessTitle, { color: colors.foreground }]}>Access Restricted</Text>
          <Text style={[styles.accessSub, { color: colors.mutedForeground }]}>This dashboard is only available to approved celebrities.</Text>
          <TouchableOpacity style={[styles.backBtn, { borderColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={[styles.backBtnText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!celebrity) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Celebrity Dashboard</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
          style={styles.headerDashBtn}
        >
          <Icon name="home" size={14} color="#fff" />
          <Text style={styles.headerDashBtnText}>User Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B33" />}
      >
        {celebrity.consent_status !== 'submitted' && celebrity.consent_status !== 'approved' && (
          <View style={styles.consentBanner}>
            <Icon name="alert-circle" size={16} color="#fff" />
            <Text style={styles.consentBannerText}>
              Your consent is pending. Please submit your consent documents to activate your profile.
            </Text>
          </View>
        )}
        <LinearGradient colors={['#FF6B33', '#E8527A', '#B44CFF']} style={styles.heroBg}>
          <Text style={styles.heroName}>{celebrity.name}</Text>
          <Text style={styles.heroCategory}>{celebrity.category}</Text>
        </LinearGradient>
        <View style={[styles.statsGrid, { backgroundColor: colors.background }]}>
          {[
            { label: 'Total Earnings', value: fmtRupee(stats.totalEarnings), icon: 'trending-up' as IconName, color: '#22C55E' },
            { label: 'Pending', value: fmtRupee(stats.pendingEarnings), icon: 'clock' as IconName, color: '#F59E0B' },
            { label: 'Bookings', value: String(stats.totalBookings), icon: 'credit-card' as IconName, color: '#3B82F6' },
            { label: 'Rating', value: (celebrity.rating ?? 0).toFixed(1), icon: 'star' as IconName, color: '#EAB308' },
            { label: 'Reviews', value: String(celebrity.review_count ?? 0), icon: 'message-circle' as IconName, color: '#A855F7' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statCardIcon, { backgroundColor: s.color + '22' }]}>
                <Icon name={s.icon} size={18} color={s.color} />
              </View>
              <Text style={[styles.statCardVal, { color: colors.foreground }]} numberOfLines={1}>{s.value}</Text>
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.tabBarWrapper, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, activeTab === tab.key && { borderBottomColor: '#FF6B33', borderBottomWidth: 2 }]}
              >
                <Icon name={tab.icon} size={15} color={activeTab === tab.key ? '#FF6B33' : colors.mutedForeground} />
                <Text style={[styles.tabLabel, { color: activeTab === tab.key ? '#FF6B33' : colors.mutedForeground }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ paddingBottom: bottomPad + 80 }}>
          {activeTab === 'bookings' && <BookingsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'wallet' && <WalletTab celebrity={celebrity} colors={colors} session={session} user={user} onRefreshCeleb={fetchCelebrity} />}
          {activeTab === 'messages' && <MessagesTab celebrity={celebrity} colors={colors} session={session} user={user} />}
          {activeTab === 'events' && <EventsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'consent' && <ConsentTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
          {activeTab === 'reviews' && <ReviewsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'followers' && <FollowersTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'content' && <ContentTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
          {activeTab === 'tds' && <TdsTab celebrity={celebrity} colors={colors} session={session} />}
          {activeTab === 'profile' && <ProfileTab celebrity={celebrity} colors={colors} session={session} onRefresh={fetchCelebrity} />}
        </View>
      </ScrollView>

    </View>
  );
}

function SectionEmpty({ icon, text, colors }: { icon: IconName; text: string; colors: ColorsType }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60, paddingBottom: 40 }}>
      <Icon name={icon} size={40} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 12 }}>{text}</Text>
    </View>
  );
}

function LoadingBox() {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <ActivityIndicator color="#FF6B33" />
    </View>
  );
}

function Card({ children, colors }: { children: React.ReactNode; colors: ColorsType }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function SectionTitle({ text, colors }: { text: string; colors: ColorsType }) {
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{text}</Text>;
}

function PrimaryBtn({ label, onPress, loading: ld, colors }: { label: string; onPress: () => void; loading?: boolean; colors: ColorsType }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={ld}
      activeOpacity={0.85}
      style={[styles.primaryBtn, { backgroundColor: '#FF6B33' }]}
    >
      {ld ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

interface InputRowProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address';
  colors: ColorsType;
  multiline?: boolean;
}

function InputRow({ label, value, onChangeText, placeholder, keyboardType, colors, multiline }: InputRowProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, height: multiline ? 80 : undefined }]}
      />
    </View>
  );
}

interface UploadPayload {
  uri: string;
  name: string;
  type: string;
}

async function uploadToStorage(
  bucket: string,
  path: string,
  uri: string,
  mimeType: string,
  token: string,
): Promise<string | null> {
  try {
    const formData = new FormData();
    const filename = path.split('/').pop() ?? 'upload';
    if (Platform.OS === 'web') {
      const r = await fetch(uri);
      const blob = await r.blob();
      formData.append('file', blob, filename);
    } else {
      const payload: UploadPayload = { uri, name: filename, type: mimeType };
      formData.append('file', payload as unknown as Blob);
    }

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  } catch {
    return null;
  }
}

interface TabProps {
  celebrity: Celebrity;
  colors: ColorsType;
  session: Session | null;
}

interface TabPropsWithUser extends TabProps {
  user: User | null;
}

interface TabPropsWithRefresh extends TabProps {
  onRefresh: () => void;
}

interface TabPropsWithUserAndRefresh extends TabProps {
  user: User | null;
  onRefreshCeleb: () => void;
}

function BookingsTab({ celebrity, colors, session }: TabProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [imagePromos, setImagePromos] = useState<ImagePromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, ipRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/bookings?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=50`,
          {},
          session?.access_token,
        ),
        supabaseFetch(
          `/rest/v1/image_promotions?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=30`,
          {},
          session?.access_token,
        ),
      ]);
      if (bRes.ok) { const rows = await bRes.json() as Booking[]; setBookings(rows ?? []); }
      if (ipRes.ok) { const rows = await ipRes.json() as ImagePromotion[]; setImagePromos(rows ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  const toggleExpand = (id: string) => {
    setExpandedBookings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const updateStatus = async (id: string, status: string) => {
    setActing(id);
    try {
      const res = await supabaseFetch(
        `/rest/v1/bookings?id=eq.${id}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ status }) },
        session?.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to update booking (${res.status})`);
      } else {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update booking');
    }
    setActing(null);
  };

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <SectionTitle text={`All Bookings (${bookings.length})`} colors={colors} />
      {bookings.length === 0 && <SectionEmpty icon="credit-card" text="No bookings yet" colors={colors} />}
      {bookings.map(b => {
        const fanName = b.profiles ? `${b.profiles.first_name ?? ''} ${b.profiles.last_name ?? ''}`.trim() : 'Fan';
        let requestDetails: { recipientName?: string; occasion?: string; message?: string } | null = null;
        try { if (b.message) { const parsed = JSON.parse(b.message); requestDetails = parsed?.requestDetails ?? parsed ?? null; } } catch {}
        const isExpanded = expandedBookings.has(b.id);
        return (
          <Card key={b.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fanName}</Text>
                <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{b.service_type?.replace(/_/g, ' ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.priceText, { color: '#FF6B33' }]}>{fmtRupee(b.final_price)}</Text>
                <StatusBadge status={b.status} />
              </View>
            </View>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(b.created_at)}</Text>
            {requestDetails && (
              <TouchableOpacity onPress={() => toggleExpand(b.id)} style={{ marginTop: 8 }}>
                <View style={[styles.rowBetween, { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={{ color: '#FF6B33', fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Request Details</Text>
                  <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#FF6B33" />
                </View>
                {isExpanded && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {requestDetails.recipientName ? <Text style={[styles.cardSub, { color: colors.foreground }]}>To: {requestDetails.recipientName}</Text> : null}
                    {requestDetails.occasion ? <Text style={[styles.cardSub, { color: colors.foreground }]}>Occasion: {requestDetails.occasion}</Text> : null}
                    {requestDetails.message ? <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{requestDetails.message}</Text> : null}
                  </View>
                )}
              </TouchableOpacity>
            )}
            {b.status === 'pending' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => updateStatus(b.id, 'accepted')}
                  disabled={acting === b.id}
                  style={[styles.smallBtn, { backgroundColor: '#22C55E20', borderColor: '#22C55E' }]}
                >
                  {acting === b.id ? <ActivityIndicator size="small" color="#22C55E" /> : <Text style={{ color: '#22C55E', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Accept</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateStatus(b.id, 'rejected')}
                  disabled={acting === b.id}
                  style={[styles.smallBtn, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}
                >
                  <Text style={{ color: '#EF4444', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        );
      })}

      <SectionTitle text="Image Promotions" colors={colors} />
      {imagePromos.length === 0 ? (
        <SectionEmpty icon="image" text="No image promotions yet" colors={colors} />
      ) : (
        imagePromos.map(ip => {
          const customer = ip.profiles ? `${ip.profiles.first_name ?? ''} ${ip.profiles.last_name ?? ''}`.trim() : 'Customer';
          return (
            <Card key={ip.id} colors={colors}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>{ip.concept || 'Image Promotion'}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{customer}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text style={[styles.priceText, { color: '#FF6B33' }]}>{fmtRupee(ip.price_paid)}</Text>
                  <StatusBadge status={ip.status} />
                </View>
              </View>
              <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(ip.created_at)}</Text>
            </Card>
          );
        })
      )}
    </View>
  );
}

interface BankDetail {
  id: string;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name: string;
}

interface PayoutRequest {
  id: string;
  requested_amount: number;
  status: string;
  bank_name: string;
  requested_at: string;
}

interface WalletTx {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
}

function WalletTab({ celebrity, colors, session, user, onRefreshCeleb }: TabPropsWithUserAndRefresh) {
  const [banks, setBanks] = useState<BankDetail[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState<BankDetail | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', bank_account_number: '', ifsc_code: '', account_holder_name: '' });
  const [addingBank, setAddingBank] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!session?.access_token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [bkRes, prRes, txRes] = await Promise.all([
        supabaseFetch(`/rest/v1/bank_details?user_id=eq.${user?.profileId}&order=created_at.desc`, {}, session.access_token),
        supabaseFetch(`/rest/v1/payout_requests?celebrity_id=eq.${celebrity.id}&order=requested_at.desc&limit=20`, {}, session.access_token),
        supabaseFetch(`/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${celebrity.id}&order=created_at.desc&limit=30`, {}, session.access_token),
      ]);
      if (bkRes.ok) { const r = await bkRes.json() as BankDetail[]; setBanks(r ?? []); if (r?.length > 0) setSelectedBank(r[0]); }
      if (prRes.ok) { const r = await prRes.json() as PayoutRequest[]; setPayouts(r ?? []); }
      if (txRes.ok) { const r = await txRes.json() as WalletTx[]; setTxns(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token, user?.profileId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const submitPayout = async () => {
    if (!selectedBank) { Alert.alert('Select a bank account first'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    if (amt > (celebrity.available_balance ?? 0)) { Alert.alert('Insufficient balance'); return; }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setSubmitting(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/payout_requests',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({
            celebrity_id: celebrity.id,
            profile_id: user?.profileId,
            requested_amount: amt,
            bank_name: selectedBank.bank_name,
            bank_account_number: selectedBank.bank_account_number,
            ifsc_code: selectedBank.ifsc_code,
            account_holder_name: selectedBank.account_holder_name,
          }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to submit payout (${res.status})`);
      } else {
        Alert.alert('Success', 'Payout request submitted!');
        setAmount('');
        fetchAll();
        onRefreshCeleb();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit payout request');
    }
    setSubmitting(false);
  };

  const addBank = async () => {
    if (!bankForm.bank_name || !bankForm.bank_account_number || !bankForm.ifsc_code || !bankForm.account_holder_name) {
      Alert.alert('Fill all bank details'); return;
    }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setAddingBank(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/bank_details',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ ...bankForm, user_id: user?.profileId }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to add bank (${res.status})`);
      } else {
        Alert.alert('Bank account added!');
        setShowAddBank(false);
        setBankForm({ bank_name: '', bank_account_number: '', ifsc_code: '', account_holder_name: '' });
        fetchAll();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add bank');
    }
    setAddingBank(false);
  };

  if (loading) return <LoadingBox />;

  const pendingClearance = txns.filter(tx => tx.status === 'pending').reduce((s, tx) => s + (tx.amount ?? 0), 0);

  return (
    <View style={styles.tabPad}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmt}>{fmtRupee(celebrity.available_balance ?? 0)}</Text>
        {pendingClearance > 0 && (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular' }}>Pending Clearance</Text>
            <Text style={{ color: '#FCD34D', fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 2 }}>{fmtRupee(pendingClearance)}</Text>
          </View>
        )}
      </LinearGradient>

      <SectionTitle text="Request Payout" colors={colors} />
      <Card colors={colors}>
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Select Bank Account</Text>
        {banks.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 8 }}>No bank accounts added</Text>
        ) : (
          banks.map(bk => (
            <TouchableOpacity
              key={bk.id}
              onPress={() => setSelectedBank(bk)}
              style={[styles.bankOption, { borderColor: selectedBank?.id === bk.id ? '#FF6B33' : colors.border, backgroundColor: selectedBank?.id === bk.id ? '#FF6B3310' : 'transparent' }]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{bk.bank_name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>****{bk.bank_account_number.slice(-4)} · {bk.account_holder_name}</Text>
            </TouchableOpacity>
          ))
        )}
        <InputRow label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" colors={colors} />
        <PrimaryBtn label="Submit Payout Request" onPress={submitPayout} loading={submitting} colors={colors} />

        <TouchableOpacity onPress={() => setShowAddBank(v => !v)} style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ color: '#FF6B33', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            {showAddBank ? 'Cancel' : '+ Add Bank Account'}
          </Text>
        </TouchableOpacity>

        {showAddBank && (
          <View style={{ marginTop: 12 }}>
            <InputRow label="Bank Name" value={bankForm.bank_name} onChangeText={(v) => setBankForm(p => ({ ...p, bank_name: v }))} colors={colors} />
            <InputRow label="Account Number" value={bankForm.bank_account_number} onChangeText={(v) => setBankForm(p => ({ ...p, bank_account_number: v }))} keyboardType="number-pad" colors={colors} />
            <InputRow label="IFSC Code" value={bankForm.ifsc_code} onChangeText={(v) => setBankForm(p => ({ ...p, ifsc_code: v.toUpperCase() }))} colors={colors} />
            <InputRow label="Account Holder Name" value={bankForm.account_holder_name} onChangeText={(v) => setBankForm(p => ({ ...p, account_holder_name: v }))} colors={colors} />
            <PrimaryBtn label="Save Bank Account" onPress={addBank} loading={addingBank} colors={colors} />
          </View>
        )}
      </Card>

      <SectionTitle text="Payout History" colors={colors} />
      {payouts.length === 0 ? (
        <SectionEmpty icon="credit-card" text="No payout requests yet" colors={colors} />
      ) : (
        payouts.map(p => (
          <Card key={p.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{p.bank_name}</Text>
                <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(p.requested_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.priceText, { color: '#FF6B33' }]}>{fmtRupee(p.requested_amount)}</Text>
                <StatusBadge status={p.status} />
              </View>
            </View>
          </Card>
        ))
      )}

      <SectionTitle text="Transaction History" colors={colors} />
      {txns.length === 0 ? (
        <SectionEmpty icon="trending-up" text="No transactions yet" colors={colors} />
      ) : (
        txns.map(tx => {
          const isCredit = ['credit', 'booking_payment', 'bonus'].includes(tx.transaction_type);
          return (
            <Card key={tx.id} colors={colors}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {tx.description || tx.transaction_type?.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(tx.created_at)}</Text>
                </View>
                <Text style={[styles.priceText, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
                  {isCredit ? '+' : '-'}{fmtRupee(tx.amount)}
                </Text>
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}

interface Conversation {
  id: string;
  user_id: string;
  last_message_at: string;
  last_message_text: string;
  unread_count_celebrity?: number;
  profiles?: { first_name: string; last_name: string };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  is_ai_generated?: boolean;
}

interface CelebSettings {
  id?: string;
  celebrity_id: string;
  ai_auto_reply_enabled: boolean;
}

function MessagesTab({ celebrity, colors, session, user }: TabPropsWithUser) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [aiSettings, setAiSettings] = useState<CelebSettings | null>(null);
  const [togglingAI, setTogglingAI] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const fetchConvos = useCallback(async () => {
    setLoading(true);
    try {
      const [convoRes, settingsRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/conversations?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name)&order=last_message_at.desc&limit=30`,
          {},
          session?.access_token,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_settings?celebrity_id=eq.${celebrity.id}&limit=1`,
          {},
          session?.access_token,
        ),
      ]);
      if (convoRes.ok) { const r = await convoRes.json() as Conversation[]; setConvos(r ?? []); }
      if (settingsRes.ok) {
        const r = await settingsRes.json() as CelebSettings[];
        setAiSettings(r?.[0] ?? { celebrity_id: celebrity.id, ai_auto_reply_enabled: false });
      }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  const toggleAIAutoReply = async () => {
    if (!session?.access_token) return;
    setTogglingAI(true);
    try {
      const newVal = !(aiSettings?.ai_auto_reply_enabled ?? false);
      const res = await supabaseFetch(
        '/rest/v1/celebrity_settings',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } as Record<string, string>,
          body: JSON.stringify({ celebrity_id: celebrity.id, ai_auto_reply_enabled: newVal }),
        },
        session.access_token,
      );
      if (res.ok) {
        setAiSettings(prev => prev ? { ...prev, ai_auto_reply_enabled: newVal } : { celebrity_id: celebrity.id, ai_auto_reply_enabled: newVal });
      }
    } catch {}
    setTogglingAI(false);
  };

  useEffect(() => { fetchConvos(); }, [fetchConvos]);

  const openConvo = async (c: Conversation) => {
    setActiveConvo(c);
    setMsgLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/messages?conversation_id=eq.${c.id}&order=created_at.asc&limit=100`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as Message[]; setMessages(r ?? []); }
      await supabaseFetch(
        `/rest/v1/messages?conversation_id=eq.${c.id}&sender_id=neq.${user?.profileId}&is_read=eq.false`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ is_read: true }) },
        session?.access_token,
      );
    } catch {}
    setMsgLoading(false);
  };

  const generateAIReply = async () => {
    if (!activeConvo || !session?.access_token) return;
    const fanMessages = messages.filter(m => m.sender_id !== user?.profileId);
    const lastFanMessage = fanMessages[fanMessages.length - 1]?.message_text ?? '';
    setGeneratingAI(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/celebrity-ai-message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ conversationId: activeConvo.id, userMessage: lastFanMessage }),
      });
      if (res.ok) {
        await openConvo(activeConvo);
      } else {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('AI Error', err.message ?? 'Failed to generate reply');
      }
    } catch (err) {
      Alert.alert('AI Error', err instanceof Error ? err.message : 'Failed to generate reply');
    }
    setGeneratingAI(false);
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeConvo || !session?.access_token) return;
    setSending(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/messages',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ conversation_id: activeConvo.id, sender_id: user?.profileId, message_text: reply.trim() }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to send message (${res.status})`);
      } else {
        setReply('');
        await openConvo(activeConvo);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
    }
    setSending(false);
  };

  if (activeConvo) {
    const fanName = activeConvo.profiles ? `${activeConvo.profiles.first_name ?? ''} ${activeConvo.profiles.last_name ?? ''}`.trim() : 'Fan';
    const fanMessages = messages.filter(m => m.sender_id !== user?.profileId);
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.msgHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setActiveConvo(null)}>
            <Icon name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1, marginLeft: 12 }]}>{fanName}</Text>
          <TouchableOpacity
            onPress={generateAIReply}
            disabled={generatingAI || fanMessages.length === 0}
            style={[styles.aiBtnSmall, { opacity: fanMessages.length === 0 ? 0.4 : 1 }]}
          >
            {generatingAI ? <ActivityIndicator size="small" color="#A855F7" /> : (
              <>
                <Text style={{ color: '#A855F7', fontFamily: 'Inter_700Bold', fontSize: 11 }}>AI</Text>
                <Text style={{ color: '#A855F7', fontFamily: 'Inter_500Medium', fontSize: 11, marginLeft: 3 }}>Reply</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {msgLoading ? (
          <LoadingBox />
        ) : (
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {messages.map(m => {
              const isMine = m.sender_id === user?.profileId;
              return (
                <View key={m.id} style={{ alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  {m.is_ai_generated && isMine && (
                    <View style={styles.aiBadge}>
                      <Text style={{ color: '#A855F7', fontFamily: 'Inter_700Bold', fontSize: 10 }}>AI</Text>
                    </View>
                  )}
                  <View style={[styles.bubble, { backgroundColor: isMine ? '#FF6B33' : colors.card, borderColor: m.is_ai_generated ? '#A855F7' : colors.border }]}>
                    <Text style={{ color: isMine ? '#fff' : colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{m.message_text}</Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>{fmtDate(m.created_at)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
        <View style={[styles.replyRow, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Type a reply..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.replyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            multiline
          />
          <TouchableOpacity onPress={sendReply} disabled={sending} style={styles.sendBtn}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <Card colors={colors}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>AI Auto-Reply</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Automatically reply to fan messages with AI</Text>
          </View>
          <TouchableOpacity
            onPress={toggleAIAutoReply}
            disabled={togglingAI}
            style={[styles.toggleBtn, { backgroundColor: aiSettings?.ai_auto_reply_enabled ? '#A855F7' : colors.border }]}
          >
            {togglingAI ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 }}>
                {aiSettings?.ai_auto_reply_enabled ? 'ON' : 'OFF'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {aiSettings?.ai_auto_reply_enabled && (
          <View style={[styles.aiBanner]}>
            <Icon name="check-circle" size={14} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontFamily: 'Inter_600SemiBold', fontSize: 13, marginLeft: 6 }}>AI Auto-Reply is ON</Text>
          </View>
        )}
      </Card>

      <SectionTitle text="Conversations" colors={colors} />
      {!convos.length && <SectionEmpty icon="message-circle" text="No conversations yet" colors={colors} />}
      {convos.map(c => {
        const fanName = c.profiles ? `${c.profiles.first_name ?? ''} ${c.profiles.last_name ?? ''}`.trim() : 'Fan';
        const unread = c.unread_count_celebrity ?? 0;
        return (
          <TouchableOpacity key={c.id} onPress={() => openConvo(c)}>
            <Card colors={colors}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fanName}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{c.last_message_text}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{fmtDate(c.last_message_at)}</Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }}>{unread}</Text>
                    </View>
                  ) : (
                    <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
                  )}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface CelebEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  description: string;
  status: string;
}

const EVENT_TYPES = ['concert', 'meetup', 'birthday', 'anniversary', 'launch', 'charity', 'other'] as const;

function EventsTab({ celebrity, colors, session }: TabProps) {
  const [events, setEvents] = useState<CelebEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', event_type: '', event_date: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_events?celebrity_id=eq.${celebrity.id}&order=event_date.asc&limit=30`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as CelebEvent[]; setEvents(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const createEvent = async () => {
    if (!form.title || !form.event_type || !form.event_date) { Alert.alert('Fill title, type, and date'); return; }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setSaving(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/celebrity_events',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ ...form, celebrity_id: celebrity.id }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to create event (${res.status})`);
      } else {
        setShowForm(false);
        setForm({ title: '', event_type: '', event_date: '', description: '' });
        fetchEvents();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create event');
    }
    setSaving(false);
  };

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <View style={styles.rowBetween}>
        <SectionTitle text={`Events (${events.length})`} colors={colors} />
        <TouchableOpacity onPress={() => setShowForm(v => !v)} style={{ padding: 4 }}>
          <Icon name={showForm ? 'x' : 'plus'} size={22} color="#FF6B33" />
        </TouchableOpacity>
      </View>

      {showForm && (
        <Card colors={colors}>
          <InputRow label="Title" value={form.title} onChangeText={(v) => setForm(p => ({ ...p, title: v }))} colors={colors} />
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Event Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {EVENT_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setForm(p => ({ ...p, event_type: t }))}
                style={[styles.chipBtn, { borderColor: form.event_type === t ? '#FF6B33' : colors.border, backgroundColor: form.event_type === t ? '#FF6B3318' : 'transparent' }]}
              >
                <Text style={{ color: form.event_type === t ? '#FF6B33' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <InputRow label="Event Date (YYYY-MM-DD)" value={form.event_date} onChangeText={(v) => setForm(p => ({ ...p, event_date: v }))} colors={colors} />
          <InputRow label="Description" value={form.description} onChangeText={(v) => setForm(p => ({ ...p, description: v }))} colors={colors} multiline />
          <PrimaryBtn label="Create Event" onPress={createEvent} loading={saving} colors={colors} />
        </Card>
      )}

      {events.length === 0 && !showForm ? (
        <SectionEmpty icon="calendar" text="No events yet" colors={colors} />
      ) : (
        events.map(ev => (
          <Card key={ev.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{ev.title}</Text>
                {ev.description ? <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{ev.description}</Text> : null}
              </View>
              <StatusBadge status={ev.event_type} />
            </View>
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(ev.event_date)}</Text>
          </Card>
        ))
      )}
    </View>
  );
}

function ConsentTab({ celebrity, colors, session, onRefresh }: TabPropsWithRefresh) {
  const [uploading, setUploading] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos });
    if (!result.canceled && result.assets[0]) setVideoUri(result.assets[0].uri);
  };

  const submitConsent = async () => {
    if (!photoUri || !videoUri) { Alert.alert('Please pick both a consent photo and video'); return; }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setUploading(true);
    try {
      const ts = Date.now();
      const safeName = celebrity.name.replace(/\s+/g, '_').toLowerCase();
      const photoPath = `${safeName}/avatar/${ts}-consent.jpg`;
      const videoPath = `${safeName}/promotional/video/${ts}-consent.mp4`;

      const [photoUrl, videoUrl] = await Promise.all([
        uploadToStorage('celebrity-avatars', photoPath, photoUri, 'image/jpeg', session.access_token),
        uploadToStorage('promotional-content', videoPath, videoUri, 'video/mp4', session.access_token),
      ]);

      if (!photoUrl || !videoUrl) { Alert.alert('Upload failed. Please try again.'); setUploading(false); return; }

      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ consent_photo_url: photoUrl, consent_video_url: videoUrl, consent_status: 'submitted' }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to submit consent (${res.status})`);
      } else {
        Alert.alert('Success', 'Consent submitted for review!');
        onRefresh();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit consent');
    }
    setUploading(false);
  };

  const status = celebrity.consent_status;

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="Consent & Verification" colors={colors} />

      <Card colors={colors}>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Consent Status</Text>
          <StatusBadge status={status || 'not_submitted'} />
        </View>
        {celebrity.consent_photo_url ? (
          <Image source={{ uri: celebrity.consent_photo_url }} style={styles.consentThumb} resizeMode="cover" />
        ) : null}
      </Card>

      {status !== 'submitted' && status !== 'approved' && (
        <Card colors={colors}>
          <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Submit Consent</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
            By submitting this consent, I confirm that I am the person named in my celebrity profile, I agree to the WishMe terms of service, and I authorise WishMe to display my profile and facilitate bookings on my behalf.
          </Text>

          <TouchableOpacity onPress={pickPhoto} style={[styles.mediaPickBtn, { borderColor: photoUri ? '#22C55E' : colors.border }]}>
            <Icon name="camera" size={18} color={photoUri ? '#22C55E' : colors.mutedForeground} />
            <Text style={{ color: photoUri ? '#22C55E' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13, marginLeft: 8 }}>
              {photoUri ? 'Consent photo selected' : 'Pick Consent Photo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={pickVideo} style={[styles.mediaPickBtn, { borderColor: videoUri ? '#22C55E' : colors.border, marginTop: 8 }]}>
            <Icon name="video" size={18} color={videoUri ? '#22C55E' : colors.mutedForeground} />
            <Text style={{ color: videoUri ? '#22C55E' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13, marginLeft: 8 }}>
              {videoUri ? 'Consent video selected' : 'Pick Consent Video'}
            </Text>
          </TouchableOpacity>

          <View style={{ marginTop: 16 }}>
            <PrimaryBtn label="Submit Consent" onPress={submitConsent} loading={uploading} colors={colors} />
          </View>
        </Card>
      )}
    </View>
  );
}

interface Review {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
  booking_id?: string;
  profiles?: { first_name: string; last_name: string };
  bookings?: { service_type: string };
}

function ReviewsTab({ celebrity, colors, session }: TabProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseFetch(
      `/rest/v1/celebrity_reviews?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name),bookings(service_type)&order=created_at.desc&limit=30`,
      {},
      session?.access_token,
    ).then(async res => {
      if (res.ok) { const r = await res.json() as Review[]; setReviews(r ?? []); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [celebrity.id, session?.access_token]);

  if (loading) return <LoadingBox />;
  if (!reviews.length) return <SectionEmpty icon="star" text="No reviews yet" colors={colors} />;

  const avgRating = reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length;
  const starCounts = [5, 4, 3, 2, 1].map(s => ({ star: s, count: reviews.filter(r => Math.round(r.rating) === s).length }));

  return (
    <View style={styles.tabPad}>
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 48, fontFamily: 'Inter_700Bold', lineHeight: 56 }}>{avgRating.toFixed(1)}</Text>
          <View style={[styles.starsRow, { marginBottom: 12 }]}>
            {[1, 2, 3, 4, 5].map(s => (
              <Icon key={s} name="star" size={18} color={s <= Math.round(avgRating) ? '#F59E0B' : colors.border} />
            ))}
          </View>
          <View style={{ width: '100%', gap: 4 }}>
            {starCounts.map(({ star, count }) => (
              <View key={star} style={[styles.rowBetween, { gap: 8 }]}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, width: 20, textAlign: 'right' }}>{star}★</Text>
                <View style={[styles.ratingBar, { backgroundColor: colors.border, flex: 1 }]}>
                  <View style={[styles.ratingBarFill, { width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }]} />
                </View>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, width: 24 }}>{count}</Text>
              </View>
            ))}
          </View>
        </View>
      </Card>
      <SectionTitle text={`Reviews (${reviews.length})`} colors={colors} />
      {reviews.map(r => {
        const fan = r.profiles ? `${r.profiles.first_name ?? ''} ${r.profiles.last_name ?? ''}`.trim() : 'Fan';
        const serviceType = r.bookings?.service_type;
        return (
          <Card key={r.id} colors={colors}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fan}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {serviceType && <StatusBadge status={serviceType.replace(/_/g, ' ')} />}
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Icon key={s} name="star" size={13} color={s <= (r.rating ?? 0) ? '#F59E0B' : colors.border} />
                  ))}
                </View>
              </View>
            </View>
            {r.review_text ? <Text style={[styles.cardSub, { color: colors.foreground, marginTop: 4 }]}>{r.review_text}</Text> : null}
            <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(r.created_at)}</Text>
          </Card>
        );
      })}
    </View>
  );
}

interface Follower {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  subscription_expires_at?: string | null;
  profiles?: { first_name: string; last_name: string };
}

function FollowersTab({ celebrity, colors, session }: TabProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseFetch(
      `/rest/v1/celebrity_favorites?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name)&order=created_at.desc&limit=50`,
      {},
      session?.access_token,
    ).then(async res => {
      if (res.ok) { const r = await res.json() as Follower[]; setFollowers(r ?? []); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [celebrity.id, session?.access_token]);

  if (loading) return <LoadingBox />;
  if (!followers.length) return <SectionEmpty icon="heart" text="No followers yet" colors={colors} />;

  return (
    <View style={styles.tabPad}>
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <View style={[styles.statCardIcon, { backgroundColor: '#EC489922' }]}>
            <Icon name="heart" size={22} color="#EC4899" />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 36, fontFamily: 'Inter_700Bold', marginTop: 8 }}>{followers.length}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Total Followers</Text>
        </View>
      </Card>
      <SectionTitle text={`Followers (${followers.length})`} colors={colors} />
      {followers.map(f => {
        const fan = f.profiles ? `${f.profiles.first_name ?? ''} ${f.profiles.last_name ?? ''}`.trim() : 'Fan';
        const expiresAt = f.subscription_expires_at ? fmtDate(f.subscription_expires_at) : 'Lifetime';
        return (
          <Card key={f.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fan}</Text>
                <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>Since {fmtDate(f.created_at)}</Text>
                <Text style={[styles.cardDate, { color: f.subscription_expires_at ? colors.mutedForeground : '#22C55E' }]}>
                  Expires: {expiresAt}
                </Text>
              </View>
              <StatusBadge status={f.status || 'active'} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

interface MediaItem {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

function ContentTab({ celebrity, colors, session, onRefresh }: TabPropsWithRefresh) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchMedia = useCallback(async () => {
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_media?celebrity_id=eq.${celebrity.id}&order=created_at.desc&limit=20`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as MediaItem[]; setMedia(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const changeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setUploading(true);
    try {
      const safeName = celebrity.name.replace(/\s+/g, '_').toLowerCase();
      const path = `${safeName}/avatar/${Date.now()}-avatar.jpg`;
      const url = await uploadToStorage('celebrity-avatars', path, result.assets[0].uri, 'image/jpeg', session.access_token);
      if (!url) { Alert.alert('Upload failed'); setUploading(false); return; }
      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity.id}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ image_url: url }) },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to update photo (${res.status})`);
      } else {
        Alert.alert('Profile photo updated!');
        onRefresh();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update photo');
    }
    setUploading(false);
  };

  const uploadPromo = async (mediaType: 'Images' | 'Videos') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'Images' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setUploading(true);
    try {
      const safeName = celebrity.name.replace(/\s+/g, '_').toLowerCase();
      const isVideo = mediaType === 'Videos';
      const path = `${safeName}/promotional/${isVideo ? 'video' : 'photo'}/${Date.now()}-promo.${isVideo ? 'mp4' : 'jpg'}`;
      const mime = isVideo ? 'video/mp4' : 'image/jpeg';
      const url = await uploadToStorage('promotional-content', path, result.assets[0].uri, mime, session.access_token);
      if (!url) { Alert.alert('Upload failed'); setUploading(false); return; }
      const res = await supabaseFetch(
        '/rest/v1/celebrity_media',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ celebrity_id: celebrity.id, media_url: url, media_type: isVideo ? 'video' : 'photo' }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to save media (${res.status})`);
      } else {
        Alert.alert('Promo media uploaded!');
        fetchMedia();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload media');
    }
    setUploading(false);
  };

  const avatarUri = celebrity.image_url
    ? celebrity.image_url.startsWith('http')
      ? celebrity.image_url
      : `https://f005.backblazeb2.com/file/wishmetoday/${celebrity.image_url}`
    : null;

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="Profile Photo" colors={colors} />
      <Card colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarLg} />
          ) : (
            <View style={[styles.avatarLg, { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
              <Icon name="user" size={40} color={colors.mutedForeground} />
            </View>
          )}
          <TouchableOpacity onPress={changeAvatar} disabled={uploading} style={[styles.changePhotoBtn, { borderColor: '#FF6B33' }]}>
            {uploading ? <ActivityIndicator size="small" color="#FF6B33" /> : <Text style={{ color: '#FF6B33', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Change Photo</Text>}
          </TouchableOpacity>
        </View>
      </Card>

      <SectionTitle text="Promo Media" colors={colors} />
      <View style={styles.rowBetween}>
        <TouchableOpacity onPress={() => uploadPromo('Images')} disabled={uploading} style={[styles.uploadBtn, { borderColor: colors.border, flex: 1, marginRight: 8 }]}>
          <Icon name="image" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12, marginLeft: 6 }}>Upload Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => uploadPromo('Videos')} disabled={uploading} style={[styles.uploadBtn, { borderColor: colors.border, flex: 1 }]}>
          <Icon name="video" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12, marginLeft: 6 }}>Upload Video</Text>
        </TouchableOpacity>
      </View>

      {loading ? <LoadingBox /> : media.length === 0 ? (
        <SectionEmpty icon="image" text="No promo media yet" colors={colors} />
      ) : (
        <View style={styles.mediaGrid}>
          {media.map(m => (
            <View key={m.id} style={[styles.mediaThumb, { backgroundColor: colors.card }]}>
              {m.media_type === 'video' ? (
                <View style={[{ flex: 1, backgroundColor: '#00000040', alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="play-circle" size={28} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: m.media_url }} style={styles.mediaThumb} resizeMode="cover" />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const FY_OPTIONS = ['FY 2022-23', 'FY 2023-24', 'FY 2024-25', 'FY 2025-26'] as const;

function fyDateRange(fy: string): { start: string; end: string } {
  const m = fy.match(/FY (\d{4})-(\d{2})/);
  if (!m) return { start: '', end: '' };
  const startYear = parseInt(m[1], 10);
  const endYear = startYear + 1;
  return { start: `${startYear}-04-01`, end: `${endYear}-03-31` };
}

function TdsTab({ celebrity, colors, session }: TabProps) {
  const [selectedFY, setSelectedFY] = useState<string>('FY 2024-25');
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    const { start, end } = fyDateRange(selectedFY);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${celebrity.id}&created_at=gte.${start}&created_at=lte.${end}T23:59:59&order=created_at.desc`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as WalletTx[]; setTxns(r ?? []); }
    } catch {}
    setLoading(false);
  }, [celebrity.id, selectedFY, session?.access_token]);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const totalCredited = txns.filter(t => ['credit', 'booking_payment'].includes(t.transaction_type)).reduce((s, t) => s + (t.amount ?? 0), 0);
  const tds = Math.round(totalCredited * 0.1);
  const net = totalCredited - tds;

  return (
    <View style={styles.tabPad}>
      <SectionTitle text="TDS Summary" colors={colors} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {FY_OPTIONS.map(fy => (
          <TouchableOpacity
            key={fy}
            onPress={() => setSelectedFY(fy)}
            style={[styles.chipBtn, { borderColor: selectedFY === fy ? '#FF6B33' : colors.border, backgroundColor: selectedFY === fy ? '#FF6B3318' : 'transparent' }]}
          >
            <Text style={{ color: selectedFY === fy ? '#FF6B33' : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{fy}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <LoadingBox /> : (
        <>
          <Card colors={colors}>
            {[
              { label: 'Total Credited', value: fmtRupee(totalCredited), color: '#22C55E' },
              { label: 'Estimated TDS (10%)', value: fmtRupee(tds), color: '#EF4444' },
              { label: 'Net Payout', value: fmtRupee(net), color: '#3B82F6' },
            ].map(row => (
              <View key={row.label} style={[styles.rowBetween, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.cardSub, { color: colors.foreground }]}>{row.label}</Text>
                <Text style={{ color: row.color, fontFamily: 'Inter_700Bold', fontSize: 16 }}>{row.value}</Text>
              </View>
            ))}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 12 }}>
              Note: TDS is estimated at 10% on gross payments received during {selectedFY} as per Indian Income Tax Act. Consult a CA for exact filing.
            </Text>
            <TouchableOpacity
              onPress={() => {
                const summary = `WishMe TDS Summary — ${selectedFY}\nTotal Credited: ${fmtRupee(totalCredited)}\nEstimated TDS (10%): ${fmtRupee(tds)}\nNet Payout: ${fmtRupee(net)}\n\nNote: TDS estimated at 10%. Consult a CA for exact filing.`;
                Clipboard.setStringAsync(summary).then(() => Alert.alert('Copied', 'TDS summary copied to clipboard!'));
              }}
              style={[styles.copyBtn, { borderColor: colors.border }]}
            >
              <Icon name="copy" size={14} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13, marginLeft: 6 }}>Copy Summary</Text>
            </TouchableOpacity>
          </Card>

          <SectionTitle text={`Transactions (${txns.length})`} colors={colors} />
          {txns.length === 0 ? (
            <SectionEmpty icon="trending-up" text={`No transactions in ${selectedFY}`} colors={colors} />
          ) : (
            txns.map(t => (
              <Card key={t.id} colors={colors}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardSub, { color: colors.foreground }]} numberOfLines={1}>{t.description || t.transaction_type?.replace(/_/g, ' ')}</Text>
                    <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(t.created_at)}</Text>
                  </View>
                  <Text style={[styles.priceText, { color: '#22C55E' }]}>{fmtRupee(t.amount)}</Text>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </View>
  );
}

const SERVICE_PRICE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'general_wish', label: 'General Wish' },
  { key: 'text_message', label: 'Text Message' },
  { key: 'image_promotion', label: 'Image Promotion' },
  { key: 'video_promotion', label: 'Video Promotion' },
  { key: 'ugc_ad', label: 'UGC Ad' },
  { key: 'voice_call', label: 'Voice Call' },
];

interface ProfileInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

function ProfileTab({ celebrity, colors, session, onRefresh }: TabPropsWithRefresh) {
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const sp = celebrity.service_prices ?? {};
    const result: Record<string, string> = {};
    SERVICE_PRICE_FIELDS.forEach(f => { result[f.key] = String(sp[f.key] ?? ''); });
    return result;
  });
  const [saving, setSaving] = useState(false);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    if (!celebrity.profile_id || !session?.access_token) return;
    supabaseFetch(
      `/rest/v1/profiles?id=eq.${celebrity.profile_id}&select=first_name,last_name,email,phone&limit=1`,
      {},
      session.access_token,
    ).then(async res => {
      if (res.ok) {
        const rows = await res.json() as ProfileInfo[];
        if (rows?.[0]) setProfileInfo(rows[0]);
      }
    }).catch(() => {});
  }, [celebrity.profile_id, session?.access_token]);

  const savePrices = async () => {
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setSaving(true);
    try {
      const service_prices: Record<string, number> = {};
      SERVICE_PRICE_FIELDS.forEach(f => { service_prices[f.key] = parseFloat(prices[f.key] || '0') || 0; });
      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ service_prices }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to save prices (${res.status})`);
      } else {
        Alert.alert('Prices updated!');
        onRefresh();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save prices');
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Passwords do not match'); return; }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setChangingPwd(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to change password (${res.status})`);
      } else {
        Alert.alert('Success', 'Password changed successfully!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to change password');
    }
    setChangingPwd(false);
  };

  const social = celebrity.social_media ?? {};

  const profileFields: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'Name', value: celebrity.name },
    { label: 'Category', value: celebrity.category },
    { label: 'Bio', value: celebrity.bio },
    { label: 'Date of Birth', value: celebrity.date_of_birth },
    { label: 'Anniversary', value: celebrity.anniversary },
    { label: 'Status', value: celebrity.status },
    { label: 'Commission', value: celebrity.commission_percentage != null ? `${celebrity.commission_percentage}%` : null },
    { label: 'Delivery Time', value: celebrity.delivery_time != null ? `${celebrity.delivery_time} days` : null },
    { label: 'Rating', value: celebrity.rating != null ? `${(celebrity.rating).toFixed(1)} ★` : null },
    { label: 'Reviews', value: celebrity.review_count != null ? String(celebrity.review_count) : null },
    { label: 'Consent Status', value: celebrity.consent_status },
    { label: 'Instagram', value: social['instagram'] },
    { label: 'YouTube', value: social['youtube'] },
    { label: 'Twitter', value: social['twitter'] },
    { label: 'TikTok', value: social['tiktok'] },
    { label: 'Facebook', value: social['facebook'] },
    { label: 'LinkedIn', value: social['linkedin'] },
    { label: 'Website', value: social['website'] },
    { label: 'Other', value: social['other'] },
  ];

  return (
    <View style={styles.tabPad}>
      {profileInfo && (
        <>
          <SectionTitle text="Personal Info" colors={colors} />
          <Card colors={colors}>
            {[
              { label: 'First Name', value: profileInfo.first_name },
              { label: 'Last Name', value: profileInfo.last_name },
              { label: 'Email', value: profileInfo.email },
              { label: 'Phone', value: profileInfo.phone },
            ].map(f => f.value ? (
              <View key={f.label} style={[styles.profileRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                <Text style={[styles.profileValue, { color: colors.foreground }]} numberOfLines={1}>{f.value}</Text>
              </View>
            ) : null)}
          </Card>
        </>
      )}

      <SectionTitle text="Profile Details" colors={colors} />
      <Card colors={colors}>
        {profileFields.map(f => f.value ? (
          <View key={f.label} style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
            <Text style={[styles.profileValue, { color: colors.foreground }]} numberOfLines={3}>{f.value}</Text>
          </View>
        ) : null)}
      </Card>

      <SectionTitle text="Service Pricing" colors={colors} />
      <Card colors={colors}>
        {SERVICE_PRICE_FIELDS.map(f => (
          <View key={f.key} style={{ marginBottom: 12 }}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
            <View style={[styles.priceInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.rupeePrefix, { color: colors.foreground }]}>₹</Text>
              <TextInput
                value={prices[f.key]}
                onChangeText={v => setPrices(p => ({ ...p, [f.key]: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 15, paddingVertical: 10 }}
              />
            </View>
          </View>
        ))}
        <PrimaryBtn label="Save Pricing" onPress={savePrices} loading={saving} colors={colors} />
      </Card>

      <SectionTitle text="Change Password" colors={colors} />
      <Card colors={colors}>
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>New Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Min 6 characters"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Confirm Password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>
        <PrimaryBtn label="Change Password" onPress={changePassword} loading={changingPwd} colors={colors} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  accessTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 16, marginBottom: 8 },
  accessSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 99, borderWidth: 1.5 },
  backBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  consentBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F97316', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  consentBannerText: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  heroBg: { padding: 24, paddingBottom: 20 },
  heroName: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 4 },
  heroCategory: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  statCard: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'flex-start', gap: 6 },
  statCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statCardVal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statCardLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  tabBarWrapper: { borderBottomWidth: 1 },
  tabBar: { paddingHorizontal: 12 },
  tabItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 12 },
  tabLabel: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  tabPad: { padding: 16 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  cardDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  priceText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  smallBtn: { flex: 1, padding: 9, borderRadius: 99, borderWidth: 1.5, alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 12, marginTop: 8 },
  primaryBtn: { borderRadius: 99, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },
  inputLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 14 },
  balanceCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  balanceAmt: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold', marginTop: 6 },
  bankOption: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  chipBtn: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  mediaPickBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, padding: 12, borderStyle: 'dashed' },
  consentThumb: { width: '100%', height: 120, borderRadius: 10, marginTop: 12 },
  starsRow: { flexDirection: 'row', gap: 2 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10, borderWidth: 1 },
  replyRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, gap: 10 },
  replyInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontFamily: 'Inter_400Regular', fontSize: 14, maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6B33', alignItems: 'center', justifyContent: 'center' },
  avatarLg: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  changePhotoBtn: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 20, paddingVertical: 8 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 10, padding: 10, borderStyle: 'dashed' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  mediaThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden' },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  profileLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', flex: 0.4 },
  profileValue: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 0.6, textAlign: 'right' },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  rupeePrefix: { fontFamily: 'Inter_600SemiBold', fontSize: 15, marginRight: 4 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 12 },
  unreadBadge: { backgroundColor: '#EF4444', borderRadius: 99, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  aiBadge: { backgroundColor: '#A855F722', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2, alignSelf: 'flex-end' },
  aiBtnSmall: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#A855F7', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  aiBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E18', borderRadius: 8, padding: 8, marginTop: 10 },
  toggleBtn: { borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  ratingBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  ratingBarFill: { height: 8, backgroundColor: '#F59E0B', borderRadius: 4 },
  headerDashBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF6B33', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  headerDashBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
