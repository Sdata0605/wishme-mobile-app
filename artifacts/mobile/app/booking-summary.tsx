import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

function sbFetch(path: string, token?: string | null): Promise<Response> {
  return fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

interface Booking {
  id: string;
  service_type: string;
  final_price: number;
  status: string;
  created_at: string;
  celebrities: { name: string; image_url?: string; category: string } | null;
}

const SERVICE_LABELS: Record<string, string> = {
  video_wish: 'Video Wish',
  image_promotion: 'UGC Ad',
  video_promotion: 'Video Promotion',
};

export default function BookingSummaryScreen() {
  const { bookingId, paymentId } = useLocalSearchParams<{ bookingId: string; paymentId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 80,
      friction: 6,
      useNativeDriver: true,
    }).start();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    sbFetch(
      `/rest/v1/bookings?id=eq.${bookingId}&select=*,celebrities(name,image_url,category)&limit=1`,
      session?.access_token,
    )
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) setBooking(rows[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId, session?.access_token]);

  const copyPaymentId = () => {
    if (!paymentId) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(paymentId);
      }
    } catch {}
    Alert.alert('Copied', 'Payment ID copied to clipboard');
  };

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={{ width: 22 }} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Booking Confirmed</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient colors={['#22C55E','#16A34A']} style={styles.successGradient}>
            <Icon name="check" size={48} color="#fff" />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Booking Confirmed!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>Your booking request has been submitted successfully.</Text>

          {paymentId && (
            <View style={[styles.paymentIdCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.paymentIdLabel, { color: colors.mutedForeground }]}>WishMe Payment ID</Text>
              <View style={styles.paymentIdRow}>
                <Text style={[styles.paymentIdValue, { color: colors.foreground }]}>{paymentId}</Text>
                <TouchableOpacity onPress={copyPaymentId} style={[styles.copyBtn, { backgroundColor: colors.muted }]}>
                  <Icon name="copy" size={14} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          ) : booking ? (
            <View style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.bookingRow}>
                <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>Celebrity</Text>
                <Text style={[styles.bookingValue, { color: colors.foreground }]}>{booking.celebrities?.name ?? '—'}</Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>Category</Text>
                <Text style={[styles.bookingValue, { color: colors.foreground }]}>{booking.celebrities?.category ?? '—'}</Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>Service</Text>
                <Text style={[styles.bookingValue, { color: colors.foreground }]}>{SERVICE_LABELS[booking.service_type] ?? booking.service_type}</Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>Amount Paid</Text>
                <Text style={[styles.bookingValue, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>₹{(booking.final_price ?? 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={[styles.bookingRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.bookingLabel, { color: colors.mutedForeground }]}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#F59E0B' }]}>Pending Review</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={[styles.infoBox, { backgroundColor: '#3B82F615', borderColor: '#3B82F6' }]}>
            <Icon name="info" size={18} color="#3B82F6" />
            <Text style={[styles.infoText, { color: colors.foreground }]}>
              Your booking is under admin review. You'll be notified once approved and the video is generated. Expected delivery: 7–14 business days.
            </Text>
          </View>

          <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginTop: 20 }]} onPress={() => router.push('/bookings')}>
            <LinearGradient colors={['#FF6B33','#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
              <Icon name="calendar" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>View My Bookings</Text>
            </LinearGradient>
          </Pressable>

          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => router.push('/(tabs)/celebrities')}>
            <Icon name="star" size={18} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Browse More Celebrities</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View></AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 20, paddingTop: 32, alignItems: 'center' },
  successCircle: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', marginBottom: 20 },
  successGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8 },
  successSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  paymentIdCard: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  paymentIdLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 6 },
  paymentIdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentIdValue: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  copyBtn: { padding: 8, borderRadius: 8 },
  bookingCard: { width: '100%', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  bookingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  bookingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  bookingValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  infoBox: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 20 },
  primaryBtn: { width: '100%', height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { width: '100%', height: 50, borderRadius: 26, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
