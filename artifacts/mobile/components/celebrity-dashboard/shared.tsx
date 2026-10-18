/**
 * Everything the celebrity dashboard tabs have in common: the row types, the small building blocks (cards,
 * buttons, inputs, badges), the storage upload, and the stylesheet. Each tab lives in its own file beside this one.
 */
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { SUPABASE_URL } from '@/constants/supabase';
import type { Session, User } from '@/context/AuthContext';

export type ColorsType = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function fmtRupee(n: number): string {
  return '₹' + (n ?? 0).toLocaleString('en-IN');
}

export const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  accepted: '#22C55E',
  completed: '#22C55E',
  rejected: '#EF4444',
  declined: '#EF4444',
  in_progress: '#1F7BFF',
  approved: '#22C55E',
  submitted: '#1F7BFF',
  active: '#22C55E',
  paid: '#22C55E',
  failed: '#EF4444',
  confirmed: '#1F7BFF',
  processing: '#1F7BFF',
  pending_approval: '#F59E0B',
  video_sent: '#22C55E',
  delivered: '#22C55E',
  processed: '#22C55E',
  reversed: '#EF4444',
};

/** What a status means to a celebrity, in plain words (the raw values are internal). */
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_approval: 'Pending',
  confirmed: 'Being made',
  processing: 'Being made',
  in_progress: 'Being made',
  accepted: 'Being made',
  video_sent: 'Delivered',
  delivered: 'Delivered',
  completed: 'Completed',
  processed: 'Paid',
  reversed: 'Returned',
  rejected: 'Rejected',
  declined: 'Declined',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** A row of choice chips: the filter above a list, or a two-way switch. The chosen chip is filled with the brand colour. */
export function FilterChips({ options, value, onChange, colors }: {
  options: Array<{ key: string; label: string; count?: number }>;
  value: string;
  onChange: (key: string) => void;
  colors: ColorsType;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              minHeight: 38, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1.5, justifyContent: 'center',
              backgroundColor: on ? '#7B5CFA' : 'transparent', borderColor: on ? '#7B5CFA' : colors.border,
            }}
          >
            <Text style={{ color: on ? '#fff' : colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
              {o.label}{o.count != null ? ` · ${o.count}` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const color = STATUS_COLORS[status] ?? '#6B7280';
  return (
    <View style={[sBadge.wrap, { backgroundColor: color + '22' }]}>
      <Text style={[sBadge.text, { color }]}>{label ?? STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}</Text>
    </View>
  );
}
export const sBadge = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  text: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
});

export interface Celebrity {
  id: string;
  profile_id: string;
  name: string;
  category: string;
  bio: string;
  image_url: string;
  available_balance: number;
  total_earnings?: number;
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

export interface Booking {
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

export interface ImagePromotion {
  id: string;
  concept: string;
  price_paid: number;
  status: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string };
}

/** A Wish a Friend / UGC video / UGC ad order made with this celebrity (the admin team fulfils these). */
export interface CelebrityOrder {
  id: string;
  kind: 'wish_friend' | 'ugc_ad';
  /** What to call it on screen, e.g. "Video wish" or "UGC ad". */
  label: string;
  title: string;
  price_paid: number;
  status: string;
  created_at: string;
  customer: string;
  video_url?: string | null;
  /** What the celebrity was paid for this order, once it is completed. */
  earned?: number;
}

export const TABS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'orders', label: 'Orders', icon: 'credit-card' },
  { key: 'wallet', label: 'Wallet', icon: 'credit-card' },
  { key: 'messages', label: 'Messages', icon: 'message-circle' },
  { key: 'reviews', label: 'Reviews', icon: 'star' },
  { key: 'followers', label: 'Followers', icon: 'heart' },
  { key: 'content', label: 'Content', icon: 'image' },
  { key: 'tds', label: 'TDS', icon: 'trending-up' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

export function SectionEmpty({ icon, text, colors }: { icon: IconName; text: string; colors: ColorsType }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60, paddingBottom: 40 }}>
      <Icon name={icon} size={40} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 12 }}>{text}</Text>
    </View>
  );
}

export function LoadingBox() {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <ActivityIndicator color="#7B5CFA" />
    </View>
  );
}

export function Card({ children, colors }: { children: React.ReactNode; colors: ColorsType }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

export function SectionTitle({ text, colors }: { text: string; colors: ColorsType }) {
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{text}</Text>;
}

export function PrimaryBtn({ label, onPress, loading: ld, colors }: { label: string; onPress: () => void; loading?: boolean; colors: ColorsType }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={ld}
      activeOpacity={0.85}
      style={[styles.primaryBtn, { backgroundColor: '#7B5CFA' }]}
    >
      {ld ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export interface InputRowProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address';
  colors: ColorsType;
  multiline?: boolean;
}

export function InputRow({ label, value, onChangeText, placeholder, keyboardType, colors, multiline }: InputRowProps) {
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

export interface UploadPayload {
  uri: string;
  name: string;
  type: string;
}

export async function uploadToStorage(
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

export interface TabProps {
  celebrity: Celebrity;
  colors: ColorsType;
  session: Session | null;
}

export interface TabPropsWithUser extends TabProps {
  user: User | null;
}

export interface TabPropsWithRefresh extends TabProps {
  onRefresh: () => void;
}

export interface TabPropsWithUserAndRefresh extends TabProps {
  user: User | null;
  onRefreshCeleb: () => void;
}

export interface WalletTx {
  id: string;
  transaction_type: string;
  amount: number;
  gross_amount?: number;
  tds_amount?: number;
  tds_percentage?: number;
  status: string;
  description: string;
  created_at: string;
}

export const styles = StyleSheet.create({
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
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7B5CFA', alignItems: 'center', justifyContent: 'center' },
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
  aiBadge: { backgroundColor: '#7B5CFA22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2, alignSelf: 'flex-end' },
  aiBtnSmall: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#7B5CFA', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  aiBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E18', borderRadius: 8, padding: 8, marginTop: 10 },
  toggleBtn: { borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  ratingBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  ratingBarFill: { height: 8, backgroundColor: '#F59E0B', borderRadius: 4 },
  headerDashBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#7B5CFA', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  headerDashBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
