import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { parseApiError, supabaseFetch } from '@/constants/supabase';
import { useTheme } from '@/context/ThemeContext';
import { SERVICES, SERVICE_KEYS, type ServiceKey } from './services';

export type { ServiceKey };

interface Props {
  visible: boolean;
  onClose: () => void;
  celebrity: { id: string; name: string; category: string; imageUrl: string; isVerified: boolean };
  /** One-time price, from the celebrity's subscription pricing. */
  price: number;
  walletBalance: number;
  token: string | null;
  /** The sheet starts here; the profile reopens it on "pay" after the user topped up the wallet. */
  startAt?: 'offer' | 'pay';
  /** Called after a successful payment so the profile can switch to its subscribed state. */
  onSubscribed: () => void;
  /** Take the user to the wallet; the profile reopens the sheet when they come back. */
  onAddMoney: () => void;
  /** After success: continue into a booking. */
  onBook: (service: ServiceKey) => void;
  servicePrices: { wish: number; ad: number; video: number };
}

type Step = 'offer' | 'pay' | 'success';

const BENEFITS: { icon: IconName; title: string; line: string }[] = [
  { icon: 'video', title: 'Personalised video wishes', line: 'A video message for someone you love' },
  { icon: 'zap', title: 'UGC brand promotions', line: 'Creator-style promo videos for your brand' },
  { icon: 'image', title: 'AI image promotions', line: 'Eye-catching promo images in minutes' },
  { icon: 'gift', title: 'Occasion greetings', line: 'Birthdays, anniversaries and festivals' },
];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function SubscribeSheet({
  visible, onClose, celebrity, price, walletBalance, token, startAt = 'offer', onSubscribed, onAddMoney, onBook, servicePrices,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('offer');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(0)).current;

  const short = Math.max(0, price - walletBalance);
  const after = walletBalance - price;
  const first = celebrity.name.split(' ')[0];

  useEffect(() => {
    if (!visible) return;
    setStep(startAt);
    setError('');
    setPaying(false);
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, damping: 18, stiffness: 160, mass: 0.9, useNativeDriver: true }).start();
  }, [visible, startAt, slide]);

  const go = (next: Step) => {
    Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setStep(next);
      setError('');
      Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  };

  const pay = async () => {
    if (paying || !token) return;
    if (short > 0) { onAddMoney(); return; }
    setPaying(true);
    setError('');
    try {
      const res = await supabaseFetch('/rest/v1/rpc/purchase_celebrity_subscription', {
        method: 'POST',
        body: JSON.stringify({ p_celebrity_id: celebrity.id, p_price: price, p_payment_method: 'wallet' }),
      }, token);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json() as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Subscription failed. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSubscribed();
      check.setValue(0);
      go('success');
      Animated.spring(check, { toValue: 1, speed: 12, bounciness: 14, useNativeDriver: true }).start();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = e instanceof Error ? e.message : 'Subscription failed. Please try again.';
      setError(/already subscribed/i.test(msg) ? 'You are already subscribed to this celebrity.' : msg);
    } finally {
      setPaying(false);
    }
  };

  const Button = ({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) => (
    <TouchableOpacity onPress={onPress} disabled={disabled || busy} activeOpacity={0.9} style={{ opacity: disabled ? 0.5 : 1 }} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={['#7B5CFA', '#D23FE0', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.mainBtn}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.mainBtnText}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Pressable onPress={() => {}} style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />

            <View style={s.head}>
              {step === 'pay' ? (
                <TouchableOpacity onPress={() => go('offer')} hitSlop={12} accessibilityLabel="Back">
                  <Icon name="chevron-left" size={24} color={colors.foreground} />
                </TouchableOpacity>
              ) : null}
              <Image source={{ uri: celebrity.imageUrl }} style={s.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <View style={s.nameRow}>
                  <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>{celebrity.name}</Text>
                  {celebrity.isVerified && <Icon name="check-circle" size={16} color="#1F7BFF" />}
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }} numberOfLines={1}>{celebrity.category}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close"><Icon name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
            </View>

            <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
              {step === 'offer' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                  <Text style={[s.title, { color: colors.foreground }]} accessibilityRole="header">Unlock {first}</Text>
                  <View style={{ gap: 12, marginTop: 14 }}>
                    {BENEFITS.map(b => (
                      <View key={b.title} style={s.benefit}>
                        <View style={[s.benefitIcon, { backgroundColor: colors.primary + '1F' }]}><Icon name={b.icon} size={18} color={colors.primary} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{b.title}</Text>
                          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{b.line}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={[s.priceBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.price, { color: colors.foreground }]}>{inr(price)}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>One-time payment · Lifetime access</Text>
                  </View>

                  <View style={{ gap: 6, marginVertical: 14 }}>
                    {['No renewals or auto-debit', 'Paid securely from your WishMe wallet'].map(t => (
                      <View key={t} style={s.trust}>
                        <Icon name="check" size={14} color="#22C55E" />
                        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                  <Button label={`Continue · ${inr(price)}`} onPress={() => go('pay')} />
                </ScrollView>
              )}

              {step === 'pay' && (
                <View>
                  <Text style={[s.title, { color: colors.foreground }]} accessibilityRole="header">Confirm and pay</Text>
                  <View style={[s.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.tr}><Text style={{ color: colors.mutedForeground }}>Subscription</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{inr(price)}</Text></View>
                    <View style={s.tr}><Text style={{ color: colors.mutedForeground }}>Wallet balance</Text><Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{inr(walletBalance)}</Text></View>
                    <View style={[s.tr, s.trTotal, { borderTopColor: colors.border }]}>
                      <Text style={{ color: short > 0 ? '#EF4444' : colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{short > 0 ? 'Short by' : 'Balance after payment'}</Text>
                      <Text style={{ color: short > 0 ? '#EF4444' : colors.foreground, fontFamily: 'Inter_700Bold' }}>{short > 0 ? inr(short) : inr(after)}</Text>
                    </View>
                  </View>
                  {error ? (
                    <View style={s.errorRow}>
                      <Icon name="alert-circle" size={15} color="#EF4444" />
                      <Text style={{ color: '#EF4444', fontSize: 13, flex: 1 }}>{error}</Text>
                    </View>
                  ) : null}
                  <View style={{ marginTop: 14 }}>
                    <Button label={short > 0 ? `Add ${inr(short)} to wallet` : `Pay ${inr(price)} from wallet`} onPress={pay} busy={paying} />
                  </View>
                  {error ? (
                    <TouchableOpacity onPress={pay} style={s.retry}><Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Try again</Text></TouchableOpacity>
                  ) : null}
                </View>
              )}

              {step === 'success' && (
                <View style={{ alignItems: 'center' }}>
                  <Animated.View style={{ transform: [{ scale: check }] }}>
                    <LinearGradient colors={['#22C55E', '#16A34A']} style={s.successIcon}><Icon name="check" size={40} color="#fff" /></LinearGradient>
                  </Animated.View>
                  <Text style={[s.title, { color: colors.foreground, textAlign: 'center', marginTop: 12 }]} accessibilityRole="header">You're subscribed to {celebrity.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4, marginBottom: 16 }}>Lifetime access. Book anytime.</Text>
                  <View style={s.tiles}>
                    {SERVICE_KEYS.map(key => (
                      <TouchableOpacity key={key} onPress={() => onBook(key)} activeOpacity={0.85} style={[s.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[s.benefitIcon, { backgroundColor: colors.primary + '1F' }]}><Icon name={SERVICES[key].icon} size={18} color={colors.primary} /></View>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' }}>{SERVICES[key].short}</Text>
                        {servicePrices[key] > 0 && <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>from {inr(servicePrices[key])}</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={onClose} style={s.retry}><Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>Done</Text></TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 17, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  priceBox: { marginTop: 16, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 2 },
  price: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mainBtn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  mainBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  table: { marginTop: 14, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  tr: { flexDirection: 'row', justifyContent: 'space-between' },
  trTotal: { borderTopWidth: 1, paddingTop: 10 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  retry: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  successIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  tile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, minHeight: 96 },
});
