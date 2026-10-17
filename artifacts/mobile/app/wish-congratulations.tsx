import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

interface OrderSummary {
  id: string;
  occasion_type: string;
  recipient_name: string;
  amount_paid: number;
  status: string;
  created_at: string;
  conversation_id: string | null;
  celebrities: {
    name: string;
    category: string;
  };
}

export default function WishCongratulationsScreen() {
  const { orderId, conversationId } = useLocalSearchParams<{ orderId: string; conversationId?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    try {
      const res = await supabaseFetch(
        `/rest/v1/wish_celebrity_orders?id=eq.${orderId}&select=id,occasion_type,recipient_name,amount_paid,status,created_at,conversation_id,celebrities(name,category)&limit=1`,
        {},
        session?.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as OrderSummary[];
        if (rows?.length) setOrder(rows[0]);
      }
    } catch {}
    setLoading(false);
  }, [orderId, session]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.replace('/messages' as never);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso.slice(0, 10); }
  };

  const convId = order?.conversation_id ?? conversationId;

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#B026FF', '#FF5F1F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad + 32 }]}
        >
          <View style={s.successIconWrap}>
            <Icon name="check-circle" size={56} color="#fff" />
          </View>
          <Text style={s.heroTitle}>Wish Sent!</Text>
          <Text style={s.heroSub}>Your heartfelt message has been delivered to the celebrity's inbox.</Text>
        </LinearGradient>

        <View style={s.content}>
          {loading ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : order ? (
            <>
              <View style={[s.celebBanner, { backgroundColor: '#B026FF10', borderColor: '#B026FF30' }]}>
                <Icon name="star" size={18} color="#B026FF" />
                <Text style={[s.celebBannerText, { color: '#B026FF' }]}>
                  Wish delivered to {order.celebrities?.name}
                </Text>
              </View>

              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Order Summary</Text>
              <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Celebrity</Text>
                  <Text style={[s.summaryValue, { color: colors.foreground }]}>{order.celebrities?.name}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Occasion</Text>
                  <Text style={[s.summaryValue, { color: colors.foreground }]}>{order.occasion_type}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Recipient</Text>
                  <Text style={[s.summaryValue, { color: colors.foreground }]}>{order.recipient_name}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Date</Text>
                  <Text style={[s.summaryValue, { color: colors.foreground }]}>{formatDate(order.created_at)}</Text>
                </View>
                <View style={[s.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Amount Paid</Text>
                  <Text style={[s.summaryValue, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
                    ₹{order.amount_paid.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <View style={[s.statusCard, { backgroundColor: '#22C55E12', borderColor: '#22C55E40' }]}>
                <Icon name="check-circle" size={20} color="#22C55E" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.statusTitle, { color: '#22C55E' }]}>Wish Delivered Successfully</Text>
                  <Text style={[s.statusDesc, { color: colors.mutedForeground }]}>
                    The celebrity will receive your wish in their DM inbox.
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={[s.celebBanner, { backgroundColor: '#B026FF10', borderColor: '#B026FF30' }]}>
              <Icon name="star" size={18} color="#B026FF" />
              <Text style={[s.celebBannerText, { color: '#B026FF' }]}>Your wish has been sent!</Text>
            </View>
          )}

          <Text style={[s.countdownText, { color: colors.mutedForeground }]}>
            Redirecting to messages in {countdown}s...
          </Text>

          {convId && (
            <TouchableOpacity
              style={[s.viewConvBtn, { borderColor: '#FF5F1F', backgroundColor: '#FF5F1F18' }]}
              onPress={() => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                router.push(('/chat/' + convId) as never);
              }}
            >
              <Icon name="message-circle" size={16} color="#FF5F1F" />
              <Text style={[s.viewConvText, { color: '#FF5F1F' }]}>View Conversation</Text>
            </TouchableOpacity>
          )}

          <GradientButton
            title="Back to Home"
            onPress={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              router.replace('/(tabs)' as never);
            }}
            style={{ marginTop: 8 }}
            icon={<Icon name="home" size={18} color="#fff" />}
          />

          <TouchableOpacity
            style={[s.wishMoreBtn, { borderColor: colors.border }]}
            onPress={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              router.push('/wish-orders' as never);
            }}
          >
            <Icon name="list" size={16} color={colors.primary} />
            <Text style={[s.wishMoreText, { color: colors.primary }]}>View All My Wishes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center', gap: 12 },
  successIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 28, fontFamily: 'PlayfairDisplay_700Bold', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  content: { padding: 20, gap: 16 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  celebBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  celebBannerText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  summaryCard: { borderRadius: 14, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'right', marginLeft: 8 },
  statusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  statusTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  statusDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  countdownText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  viewConvBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 9999, paddingVertical: 14, marginTop: 4 },
  viewConvText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  wishMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 9999, paddingVertical: 14, marginTop: 4 },
  wishMoreText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
