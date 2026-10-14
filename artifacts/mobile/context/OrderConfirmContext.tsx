import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

export interface OrderConfirmation {
  /** What was ordered, e.g. "UGC video for Ananya". Shown as: We got your order of <item>. */
  item: string;
  /** The order reference. Omit it when the order has no id yet. */
  orderId?: string;
  /** Where "View my orders" goes. Defaults to My Bookings. */
  viewRoute?: { pathname: string; params?: Record<string, string> };
  /** Optional extra line, e.g. the scheduled time. */
  note?: string;
  /** Replaces the default navigation of "View my orders". */
  onView?: () => void;
  /** Runs when the dialog is dismissed with "Done" (or tapping outside). */
  onDone?: () => void;
}

interface Ctx {
  confirmOrder: (order: OrderConfirmation) => void;
}

const OrderConfirmContext = createContext<Ctx>({ confirmOrder: () => {} });

export function useOrderConfirm(): Ctx {
  return useContext(OrderConfirmContext);
}

function shortId(id: string): string {
  return id.includes('-') ? id.slice(0, 8).toUpperCase() : id;
}

export function OrderConfirmProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [copied, setCopied] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  const confirmOrder = useCallback((o: OrderConfirmation) => {
    setCopied(false);
    setOrder(o);
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 9, useNativeDriver: true }).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [pop]);

  const close = () => {
    const done = order?.onDone;
    setOrder(null);
    done?.();
  };

  const copy = async () => {
    if (!order?.orderId) return;
    await Clipboard.setStringAsync(order.orderId);
    setCopied(true);
  };

  const viewOrders = () => {
    const current = order;
    setOrder(null);
    if (current?.onView) { current.onView(); return; }
    const route = current?.viewRoute ?? { pathname: '/bookings' };
    setTimeout(() => router.push(route as never), 60);
  };

  return (
    <OrderConfirmContext.Provider value={{ confirmOrder }}>
      {children}
      <Modal visible={!!order} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={s.backdrop} onPress={close}>
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            <Animated.View
              style={[
                s.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
              ]}
            >
              <LinearGradient colors={['#22C55E', '#16A34A']} style={s.badge}>
                <Icon name="check" size={38} color="#fff" />
              </LinearGradient>

              <Text style={[s.title, { color: colors.foreground }]}>Order received</Text>
              <Text style={[s.body, { color: colors.mutedForeground }]}>
                We got your order of{' '}
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>{order?.item}</Text>.
              </Text>

              {order?.orderId ? (
                <TouchableOpacity onPress={copy} activeOpacity={0.8} style={[s.idBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.idLabel, { color: colors.mutedForeground }]}>Order ID</Text>
                    <Text style={[s.idValue, { color: colors.foreground }]} selectable>#{shortId(order.orderId)}</Text>
                  </View>
                  <View style={s.copyRow}>
                    <Icon name={copied ? 'check' : 'copy'} size={14} color={copied ? '#22C55E' : colors.primary} />
                    <Text style={{ color: copied ? '#22C55E' : colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {order?.note ? <Text style={[s.note, { color: colors.foreground }]}>{order.note}</Text> : null}

              <Text style={[s.body, { color: colors.mutedForeground, marginTop: 4 }]}>
                We will get back to you as soon as possible.
              </Text>

              <View style={s.buttons}>
                <TouchableOpacity onPress={viewOrders} activeOpacity={0.9} style={{ flex: 1 }}>
                  <LinearGradient colors={['#A855F7', '#E0479E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primary}>
                    <Text style={s.primaryText}>View my orders</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={close} activeOpacity={0.8} style={[s.ghost, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </OrderConfirmContext.Provider>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { borderRadius: 26, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8 },
  badge: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21, textAlign: 'center' },
  idBox: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 6 },
  idLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  idValue: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  note: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 14 },
  primary: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  ghost: { height: 48, borderRadius: 24, borderWidth: 1, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
});
