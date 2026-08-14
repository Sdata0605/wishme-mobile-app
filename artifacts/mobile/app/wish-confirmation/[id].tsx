import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';

interface WishOrder {
  id: string;
  occasion_type: string;
  recipient_name: string;
  message: string;
  card_prompt: string;
  amount_paid: number;
  payment_status: string;
  status: string;
  generated_card_image_url?: string;
  greeting_text?: string;
  generation_attempts?: number;
  card_approved?: boolean;
  celebrities: {
    id: string;
    name: string;
    category: string;
    image_url: string;
  };
}

export default function WishConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [order, setOrder] = useState<WishOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [genError, setGenError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [regenerationCount, setRegenerationCount] = useState(0);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setOrderLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/wish_celebrity_orders?id=eq.${id}&select=id,occasion_type,recipient_name,message,card_prompt,amount_paid,payment_status,status,generated_card_image_url,greeting_text,generation_attempts,card_approved,celebrities(id,name,category,image_url)&limit=1`,
        {},
        session?.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as WishOrder[];
        if (rows?.length) {
          const o = rows[0];
          setOrder(o);
          if (o.generated_card_image_url) setCardImageUrl(o.generated_card_image_url);
          if (o.greeting_text) setGreetingText(o.greeting_text);
          setRegenerationCount(o.generation_attempts ?? 0);
        }
      }
    } catch {}
    setOrderLoading(false);
  }, [id, session]);

  const generateCard = useCallback(async () => {
    if (!id || !order) return;
    if (regenerationCount >= 3) return;
    setGenerating(true);
    setGenError('');
    try {
      const res = await supabaseFetch('/functions/v1/generate-wish-celebrity-card', {
        method: 'POST',
        body: JSON.stringify({ orderId: id }),
      }, session?.access_token);

      if (!res.ok) throw new Error('Card generation failed');
      const data = await res.json() as {
        card_url?: string;
        cardUrl?: string;
        card_image_url?: string;
        image_url?: string;
        greeting_text?: string;
        greetingText?: string;
      };
      const imgUrl = data.card_url ?? data.cardUrl ?? data.card_image_url ?? data.image_url ?? null;
      const gText = data.greeting_text ?? data.greetingText ?? null;
      if (imgUrl) setCardImageUrl(imgUrl);
      if (gText) setGreetingText(gText);
      setRegenerationCount(prev => prev + 1);
      await loadOrder();
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate card');
    }
    setGenerating(false);
  }, [id, order, session, regenerationCount, loadOrder]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (order && order.payment_status === 'completed' && !order.generated_card_image_url) {
      generateCard();
    }
  }, [order, generateCard]);

  const handleApproveAndSend = async () => {
    if (!id) return;
    setSending(true);
    setSendError('');
    try {
      const res = await supabaseFetch('/functions/v1/send-wish-to-celebrity', {
        method: 'POST',
        body: JSON.stringify({ orderId: id }),
      }, session?.access_token);
      if (!res.ok) throw new Error('Failed to send wish');
      router.replace({ pathname: '/wish-congratulations', params: { orderId: id } } as never);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Failed to send wish');
    }
    setSending(false);
  };

  const celebImageUri = order?.celebrities?.image_url
    ? order.celebrities.image_url.startsWith('http')
      ? order.celebrities.image_url
      : `https://f005.backblazeb2.com/file/wishmetoday/${order.celebrities.image_url}`
    : null;

  const maxRegenReached = regenerationCount >= 3;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish Confirmation</Text>
        <View style={{ width: 22 }} />
      </View>

      {orderLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading order...</Text>
        </View>
      ) : !order ? (
        <View style={s.centered}>
          <Icon name="alert-circle" size={40} color={colors.primary} />
          <Text style={[s.errorTitle, { color: colors.foreground }]}>Order not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={[s.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={s.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {order.payment_status === 'completed' && (
            <View style={s.paymentBanner}>
              <Icon name="check-circle" size={18} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={s.paymentBannerTitle}>Payment Successful</Text>
                <Text style={s.paymentBannerSubtitle}>Your order is confirmed and the AI card is being generated</Text>
              </View>
            </View>
          )}

          {order.celebrities && (
            <View style={[s.celebRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {celebImageUri ? (
                <Image source={{ uri: celebImageUri }} style={s.celebAvatar} contentFit="cover" />
              ) : (
                <View style={[s.celebAvatarPlaceholder, { backgroundColor: colors.border }]}>
                  <Icon name="user" size={22} color={colors.mutedForeground} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.celebName, { color: colors.foreground }]}>{order.celebrities.name}</Text>
                <Text style={[s.celebCat, { color: colors.mutedForeground }]}>{order.celebrities.category}</Text>
              </View>
              <View style={s.amountTag}>
                <Text style={s.amountText}>₹{order.amount_paid.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          )}

          <View style={[s.orderInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Occasion</Text>
              <Text style={[s.infoValue, { color: colors.foreground }]}>{order.occasion_type}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Recipient</Text>
              <Text style={[s.infoValue, { color: colors.foreground }]}>{order.recipient_name}</Text>
            </View>
            <View style={order.card_prompt ? s.infoRow : [s.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Message</Text>
              <Text style={[s.infoValue, { color: colors.foreground, flex: 1, textAlign: 'right' }]} numberOfLines={3}>{order.message}</Text>
            </View>
            {order.card_prompt ? (
              <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Card Prompt</Text>
                <Text style={[s.infoValue, { color: colors.foreground, flex: 1, textAlign: 'right' }]} numberOfLines={3}>{order.card_prompt}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[s.sectionTitle, { color: colors.foreground }]}>AI Greeting Card</Text>

          {generating ? (
            <View style={[s.cardPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[s.loadingText, { color: colors.mutedForeground, marginTop: 12 }]}>Generating your card...</Text>
            </View>
          ) : cardImageUrl ? (
            <View style={[s.cardContainer, { borderColor: colors.border }]}>
              <Image source={{ uri: cardImageUrl }} style={s.cardImage} contentFit="cover" />
              {greetingText && (
                <View style={[s.greetingBox, { backgroundColor: colors.card }]}>
                  <Text style={[s.greetingText, { color: colors.foreground }]}>{greetingText}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[s.cardPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="image" size={40} color={colors.mutedForeground} />
              {genError ? (
                <Text style={s.genErrorText}>{genError}</Text>
              ) : (
                <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Card will appear here</Text>
              )}
            </View>
          )}

          {maxRegenReached && !order.card_approved && (
            <View style={[s.maxRegenBanner, { backgroundColor: colors.muted }]}>
              <Icon name="info" size={14} color={colors.mutedForeground} />
              <Text style={[s.maxRegenText, { color: colors.mutedForeground }]}>Maximum regenerations reached (3/3)</Text>
            </View>
          )}

          {order.card_approved ? (
            <View style={s.sentBanner}>
              <Icon name="check-circle" size={18} color="#16A34A" />
              <Text style={s.sentBannerText}>Wish sent to {order.celebrities?.name ?? 'celebrity'}!</Text>
            </View>
          ) : (
            <View style={s.actions}>
              <TouchableOpacity
                style={[s.regenBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: maxRegenReached || generating ? 0.5 : 1 }]}
                onPress={generateCard}
                disabled={generating || sending || maxRegenReached}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon name="refresh-cw" size={16} color={colors.primary} />
                )}
                <Text style={[s.regenText, { color: colors.primary }]}>Regenerate Card</Text>
              </TouchableOpacity>

              <GradientButton
                title="Approve & Send"
                onPress={handleApproveAndSend}
                loading={sending}
                disabled={!cardImageUrl || generating}
                style={{ flex: 1 }}
                icon={<Icon name="send" size={16} color="#fff" />}
              />
            </View>
          )}

          {sendError ? (
            <View style={s.sendErrorRow}>
              <Icon name="alert-circle" size={14} color="#EF4444" />
              <Text style={s.sendErrorText}>{sendError}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  errorTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  paymentBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: '#86EFAC', backgroundColor: '#F0FDF4', padding: 14, marginBottom: 16 },
  paymentBannerTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#16A34A' },
  paymentBannerSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#15803D', marginTop: 2 },
  celebRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  celebAvatar: { width: 48, height: 48, borderRadius: 24 },
  celebAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  celebName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  celebCat: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  amountTag: { backgroundColor: '#22C55E18', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  amountText: { color: '#22C55E', fontSize: 14, fontFamily: 'Inter_700Bold' },
  orderInfo: { borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', gap: 12 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', minWidth: 70 },
  infoValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  cardPlaceholder: { borderRadius: 16, borderWidth: 1, height: 220, alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  cardContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  cardImage: { width: '100%', height: 280 },
  greetingBox: { padding: 16 },
  greetingText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic' },
  genErrorText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 16 },
  maxRegenBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 10, marginBottom: 12 },
  maxRegenText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sentBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: '#86EFAC', backgroundColor: '#F0FDF4', padding: 14, marginBottom: 12 },
  sentBannerText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#16A34A', flex: 1 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' },
  regenBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 9999, paddingVertical: 12, paddingHorizontal: 16 },
  regenText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sendErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  sendErrorText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
});
