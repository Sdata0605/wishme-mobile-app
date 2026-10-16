import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Icon } from '@/components/Icon';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { supabaseFetch } from '@/constants/supabase';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Baby Shower',
  'Farewell', 'Get Well Soon', 'Congratulations', 'New Year', 'Other',
];

interface CelebrityDetail {
  id: string;
  name: string;
  category: string;
  image_url: string;
  is_verified: boolean;
  rating: number;
  service_prices?: { general_wish?: number };
}

interface ServicePrice {
  general_wish?: number;
}

interface ProfileRow {
  id: string;
  wallet_balance: number;
}

export default function WishBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, user, getValidSession } = useAuth();
  const agentPrefill = useAgentPrefill();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [celeb, setCeleb] = useState<CelebrityDetail | null>(null);
  const [celebLoading, setCelebLoading] = useState(true);
  const [basePrice, setBasePrice] = useState(0);
  const [planDiscountPct, setPlanDiscountPct] = useState(0);
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);
  const [profileId, setProfileId] = useState(user?.profileId ?? '');

  const [occasion, setOccasion] = useState('');
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [cardPrompt, setCardPrompt] = useState('');

  const [msgChips, setMsgChips] = useState<string[]>([]);
  const [promptChips, setPromptChips] = useState<string[]>([]);
  const [suggestingMsg, setSuggestingMsg] = useState(false);
  const [suggestingPrompt, setSuggestingPrompt] = useState(false);

  const [payModalVisible, setPayModalVisible] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const [toast, setToast] = useState('');

  // Auto-fill form fields from agent prefill
  useEffect(() => {
    if (agentPrefill.occasion) setOccasion(agentPrefill.occasion);
    if (agentPrefill.recipientName) setRecipientName(agentPrefill.recipientName);
    if (agentPrefill.message) setMessage(agentPrefill.message);
  }, [agentPrefill.occasion, agentPrefill.recipientName, agentPrefill.message]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadCeleb = useCallback(async () => {
    if (!id) return;
    setCelebLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${id}&select=id,name,category,image_url,is_verified,rating,service_prices&limit=1`,
        {},
        session?.access_token,
      );
      if (res.ok) {
        const rows = await res.json() as CelebrityDetail[];
        if (rows?.length) {
          const c = rows[0];
          setCeleb(c);
          const sp = c.service_prices as ServicePrice | undefined;
          setBasePrice(sp?.general_wish ?? 0);
        }
      }
    } catch {}
    setCelebLoading(false);
  }, [id, session]);

  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    try {
      const vs = await getValidSession();
      const tok = vs?.access_token ?? session?.access_token;
      if (!tok) { setWalletBalance(user?.walletBalance ?? 0); setProfileId(user?.profileId ?? ''); return; }
      const res = await supabaseFetch(
        `/rest/v1/profiles?select=id,wallet_balance&user_id=eq.${user.id}&limit=1`,
        {},
        tok,
      );
      if (res.ok) {
        const rows = await res.json() as ProfileRow[];
        if (rows?.length) {
          setWalletBalance(rows[0].wallet_balance ?? user?.walletBalance ?? 0);
          setProfileId(rows[0].id ?? user?.profileId ?? '');
        }
      } else {
        setWalletBalance(user?.walletBalance ?? 0);
        setProfileId(user?.profileId ?? '');
      }
    } catch {
      setWalletBalance(user?.walletBalance ?? 0);
      setProfileId(user?.profileId ?? '');
    }
  }, [session, user, getValidSession]);

  useEffect(() => {
    loadCeleb();
    loadWallet();
  }, [loadCeleb, loadWallet]);

  const getAISuggestions = async () => {
    if (!occasion || !recipientName) {
      showToast('Please select an occasion and enter recipient name first');
      return;
    }
    setSuggestingMsg(true);
    try {
      const res = await supabaseFetch('/functions/v1/generate-message-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          celebrityName: celeb?.name,
          celebrity_name: celeb?.name,
          occasionType: occasion,
          occasion,
          recipientName,
          recipient_name: recipientName,
        }),
      }, session?.access_token);
      if (res.ok) {
        const data = await res.json() as { suggestions?: string[] };
        if (data.suggestions?.length) {
          setMsgChips(data.suggestions.slice(0, 4));
        }
      }
    } catch {}
    setSuggestingMsg(false);
  };

  const getSuggestPrompts = async () => {
    if (!occasion) {
      showToast('Please select an occasion first');
      return;
    }
    setSuggestingPrompt(true);
    try {
      const res = await supabaseFetch('/functions/v1/suggest-greeting-card-prompts', {
        method: 'POST',
        body: JSON.stringify({
          celebrityName: celeb?.name,
          celebrity_name: celeb?.name,
          occasionType: occasion,
          occasion,
          recipientName,
          recipient_name: recipientName,
        }),
      }, session?.access_token);
      if (res.ok) {
        const data = await res.json() as { prompts?: string[] };
        if (data.prompts?.length) {
          setPromptChips(data.prompts.slice(0, 4));
        } else {
          showToast('No card prompt suggestions returned. Try again.');
        }
      } else {
        showToast('Could not generate card prompt suggestions.');
      }
    } catch {}
    setSuggestingPrompt(false);
  };

  const handleProceed = () => {
    if (!occasion) { showToast('Please select an occasion'); return; }
    if (!recipientName.trim()) { showToast('Please enter recipient name'); return; }
    if (!message.trim()) { showToast('Please enter a message'); return; }
    if (!cardPrompt.trim()) { showToast('Please enter a card prompt'); return; }
    setPayError('');
    setPayModalVisible(true);
  };

  const discountAmt = planDiscountPct > 0 ? Math.round((basePrice * planDiscountPct) / 100) : 0;
  const finalPrice = basePrice - discountAmt;

  const createWishOrder = async (paymentMethod: string, paymentStatus: string) => {
    const res = await supabaseFetch('/rest/v1/wish_celebrity_orders', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: profileId,
        celebrity_id: id,
        occasion_type: occasion,
        recipient_name: recipientName,
        message,
        card_prompt: cardPrompt,
        card_generation_type: 'ai',
        amount_paid: finalPrice,
        discount_percentage: planDiscountPct,
        discount_amount: discountAmt,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        status: 'pending',
      }),
    }, session?.access_token);
    if (!res.ok) throw new Error('Failed to create order');
    const rows = await res.json() as Array<{ id: string }>;
    return rows[0]?.id;
  };

  const handleWalletPay = async () => {
    if (walletBalance < finalPrice) {
      setPayError('Insufficient wallet balance');
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      const orderId = await createWishOrder('wallet', 'pending');
      // Created unpaid; it becomes 'completed' only after the wallet has been charged, and that change is what pays the celebrity.
      const txRes = await supabaseFetch('/rest/v1/wallet_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: profileId,
          amount: finalPrice,
          transaction_type: 'booking',
          status: 'completed',
          description: `Wish order #${orderId} for ${celeb?.name} - ${occasion}`,
          payment_method: 'wallet',
        }),
      }, session?.access_token);

      if (!txRes.ok) {
        await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${orderId}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        }, session?.access_token).catch((err: unknown) => {
          console.error('Failed to delete orphaned wish order:', orderId, err);
        });
        throw new Error('Wallet transaction failed');
      }

      await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${orderId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'paid', payment_method: 'wallet', payment_status: 'completed' }),
      }, session?.access_token);

      setPayModalVisible(false);
      router.replace({ pathname: '/wish-confirmation/[id]', params: { id: orderId } } as never);
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : 'Payment failed');
    }
    setPaying(false);
  };

  const handleRazorpayPay = async () => {
    setPaying(true);
    setPayError('');
    let wishOrderId: string | undefined;
    try {
      wishOrderId = await createWishOrder('razorpay', 'pending');

      const rzpRes = await supabaseFetch('/functions/v1/create-razorpay-order', {
        method: 'POST',
        body: JSON.stringify({
          amount: finalPrice * 100,
          currency: 'INR',
          receipt: `WISH-${wishOrderId}`.slice(0, 40),
          notes: { orderId: wishOrderId },
        }),
      }, session?.access_token);

      if (!rzpRes.ok) throw new Error('Could not create Razorpay order');
      const order = await rzpRes.json() as { id: string; amount: number; currency: string; key_id: string };
      const prefillName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

      const onPaymentSuccess = async (paymentId: string, rzpOrderId: string, signature: string) => {
        const verifyRes = await supabaseFetch('/functions/v1/verify-razorpay-payment', {
          method: 'POST',
          body: JSON.stringify({
            razorpay_payment_id: paymentId,
            razorpay_order_id: rzpOrderId,
            razorpay_signature: signature,
            orderId: wishOrderId,
            orderType: 'wish',
          }),
        }, session?.access_token);
        if (!verifyRes.ok) throw new Error('Payment verification failed');

        await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${wishOrderId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'paid', payment_method: 'razorpay', payment_status: 'completed' }),
        }, session?.access_token);

        setPayModalVisible(false);
        router.replace({ pathname: '/wish-confirmation/[id]', params: { id: wishOrderId } } as never);
      };

      if (Platform.OS === 'web') {
        await loadRazorpayScript();
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency ?? 'INR',
          order_id: order.id,
          name: 'WishMe',
          description: `Wish for ${celeb?.name}`,
          prefill: { name: prefillName, email: user?.email ?? '', contact: user?.phone ?? '' },
          theme: { color: '#7B5CFA' },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              await onPaymentSuccess(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
            } catch {
              Alert.alert('Verification Failed', 'Payment received but verification failed. Contact support.');
            }
          },
        });
        rzp.open();
      } else {
        type RazorpayModule = { open: (opts: Record<string, unknown>) => Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }> };
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
          if (wishOrderId) {
            await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${wishOrderId}`, {
              method: 'DELETE',
              headers: { Prefer: 'return=minimal' },
            }, session?.access_token).catch(() => {});
          }
          setPaying(false);
          Alert.alert(
            'Native Checkout Not Available',
            'Razorpay native checkout requires a custom development build. Please use Wallet payment, or try from the web app.',
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
          description: `Wish for ${celeb?.name}`,
          prefill: { name: prefillName, email: user?.email ?? '', contact: user?.phone ?? '' },
          theme: { color: '#7B5CFA' },
        });

        if (data?.razorpay_payment_id) {
          await onPaymentSuccess(data.razorpay_payment_id, data.razorpay_order_id, data.razorpay_signature);
        }
      }
    } catch (err: unknown) {
      const errMsg = (err as Record<string, string>)?.description ?? (err instanceof Error ? err.message : 'Payment failed');
      if (!errMsg.toLowerCase().includes('cancel')) {
        setPayError(errMsg);
      } else if (wishOrderId) {
        await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${wishOrderId}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        }, session?.access_token).catch(() => {});
      }
    }
    setPaying(false);
  };

  const imageUri = celeb?.image_url
    ? celeb.image_url.startsWith('http')
      ? celeb.image_url
      : `https://f005.backblazeb2.com/file/wishmetoday/${celeb.image_url}`
    : null;

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Book a Wish</Text>
        <View style={{ width: 22 }} />
      </View>

      {celebLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {celeb && (
            <View style={[s.celebRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={s.celebAvatar} contentFit="cover" />
              ) : (
                <View style={[s.celebAvatarPlaceholder, { backgroundColor: colors.border }]}>
                  <Icon name="user" size={24} color={colors.mutedForeground} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.celebName, { color: colors.foreground }]}>{celeb.name}</Text>
                  {celeb.is_verified && <Icon name="check-circle" size={14} color="#3B5BDB" />}
                </View>
                <Text style={[s.celebCat, { color: colors.mutedForeground }]}>{celeb.category}</Text>
              </View>
              <View style={s.priceTag}>
                <Text style={s.priceTagText}>₹{basePrice.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          )}

          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Occasion</Text>
          <TouchableOpacity
            style={[s.dropdown, { backgroundColor: colors.input, borderColor: colors.border }]}
            onPress={() => setOccasionOpen(true)}
          >
            <Text style={[s.dropdownText, { color: occasion ? colors.foreground : colors.mutedForeground }]}>
              {occasion || 'Select occasion...'}
            </Text>
            <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Recipient Name</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Enter recipient's name"
            placeholderTextColor={colors.mutedForeground}
            value={recipientName}
            onChangeText={setRecipientName}
          />

          <View style={s.labelRow}>
            <Text style={[s.sectionLabel, { color: colors.foreground }]}>Message</Text>
            <TouchableOpacity
              style={[s.suggestBtn, { borderColor: colors.primary }]}
              onPress={getAISuggestions}
              disabled={suggestingMsg}
            >
              {suggestingMsg ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[s.suggestBtnText, { color: colors.primary }]}>Get AI Suggestions</Text>
              )}
            </TouchableOpacity>
          </View>
          {msgChips.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll}>
              {msgChips.map((chip, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setMessage(chip)}
                >
                  <Text style={[s.chipText, { color: colors.foreground }]} numberOfLines={2}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TextInput
            style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Write your heartfelt message to the celebrity..."
            placeholderTextColor={colors.mutedForeground}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={s.labelRow}>
            <Text style={[s.sectionLabel, { color: colors.foreground }]}>Card Prompt</Text>
            <TouchableOpacity
              style={[s.suggestBtn, { borderColor: colors.primary }]}
              onPress={getSuggestPrompts}
              disabled={suggestingPrompt}
            >
              {suggestingPrompt ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[s.suggestBtnText, { color: colors.primary }]}>Suggest Prompts</Text>
              )}
            </TouchableOpacity>
          </View>
          {promptChips.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll}>
              {promptChips.map((chip, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setCardPrompt(chip)}
                >
                  <Text style={[s.chipText, { color: colors.foreground }]} numberOfLines={2}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TextInput
            style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Describe how you'd like the greeting card to look..."
            placeholderTextColor={colors.mutedForeground}
            value={cardPrompt}
            onChangeText={setCardPrompt}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={[s.pricingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.pricingRow}>
              <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Base Price</Text>
              <Text style={[s.pricingValue, { color: colors.foreground }]}>₹{basePrice.toLocaleString('en-IN')}</Text>
            </View>
            {discountAmt > 0 && (
              <View style={s.pricingRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Plan Discount</Text>
                  <View style={s.discountBadge}>
                    <Text style={s.discountBadgeText}>{planDiscountPct}% OFF</Text>
                  </View>
                </View>
                <Text style={[s.pricingValue, { color: '#22C55E' }]}>−₹{discountAmt.toLocaleString('en-IN')}</Text>
              </View>
            )}
            <View style={[s.pricingRow, { borderBottomWidth: 0 }]}>
              <Text style={[s.pricingLabel, { color: colors.mutedForeground }]}>Total</Text>
              <Text style={[s.pricingTotal, { color: colors.primary }]}>₹{finalPrice.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <GradientButton
            title="Proceed to Payment"
            onPress={handleProceed}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      )}

      <Modal visible={occasionOpen} transparent animationType="slide" onRequestClose={() => setOccasionOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => setOccasionOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Select Occasion</Text>
            {OCCASIONS.map(o => (
              <TouchableOpacity
                key={o}
                style={[s.occasionItem, { borderBottomColor: colors.border }]}
                onPress={() => { setOccasion(o); setOccasionOpen(false); }}
              >
                <Text style={[s.occasionText, { color: occasion === o ? colors.primary : colors.foreground }]}>{o}</Text>
                {occasion === o && <Icon name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={payModalVisible} transparent animationType="slide" onRequestClose={() => !paying && setPayModalVisible(false)}>
        <TouchableOpacity activeOpacity={1} style={s.modalOverlay} onPress={() => !paying && setPayModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Choose Payment Method</Text>
            <Text style={[s.modalSub, { color: colors.mutedForeground }]}>Amount: ₹{finalPrice.toLocaleString('en-IN')}</Text>

            <View style={[s.walletBal, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Icon name="credit-card" size={16} color={colors.mutedForeground} />
              <Text style={[s.walletBalText, { color: colors.mutedForeground }]}>Wallet Balance</Text>
              <Text style={[s.walletBalAmt, { color: walletBalance >= finalPrice ? '#22C55E' : '#EF4444' }]}>
                ₹{walletBalance.toLocaleString('en-IN')}
              </Text>
            </View>

            {payError ? (
              <View style={s.errorRow}>
                <Icon name="alert-circle" size={14} color="#EF4444" />
                <Text style={s.errorText}>{payError}</Text>
              </View>
            ) : null}

            <View style={s.payBtns}>
              <TouchableOpacity
                style={[s.payBtn, { borderColor: walletBalance < finalPrice ? '#EF4444' : colors.primary, opacity: walletBalance < finalPrice ? 0.55 : 1 }]}
                onPress={handleWalletPay}
                disabled={paying || walletBalance < finalPrice}
              >
                {paying ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="credit-card" size={20} color={walletBalance < finalPrice ? '#EF4444' : colors.primary} />}
                <Text style={[s.payBtnLabel, { color: walletBalance < finalPrice ? '#EF4444' : colors.primary }]}>
                  {walletBalance < finalPrice ? 'Insufficient' : 'Pay via Wallet'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.payBtn, { borderColor: '#7B5CFA' }]}
                onPress={handleRazorpayPay}
                disabled={paying}
              >
                {paying ? <ActivityIndicator size="small" color="#7B5CFA" /> : <Icon name="credit-card" size={20} color="#7B5CFA" />}
                <Text style={[s.payBtnLabel, { color: '#7B5CFA' }]}>Pay via Razorpay</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => !paying && setPayModalVisible(false)} style={s.cancelBtn}>
              <Text style={[s.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {toast.length > 0 && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View></AmbientBackground>
  );
}

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

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  celebRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20 },
  celebAvatar: { width: 52, height: 52, borderRadius: 26 },
  celebAvatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  celebName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  celebCat: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  priceTag: { backgroundColor: '#7B5CFA18', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  priceTagText: { color: '#7B5CFA', fontSize: 14, fontFamily: 'Inter_700Bold' },
  sectionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 8, marginTop: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  suggestBtn: { borderWidth: 1, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12 },
  suggestBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  chipsScroll: { marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 10, padding: 10, marginRight: 8, maxWidth: 200 },
  chipText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 48, marginBottom: 16 },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  textarea: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 16, minHeight: 100 },
  pricingCard: { borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  pricingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pricingValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pricingTotal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  discountBadge: { backgroundColor: '#22C55E18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#22C55E' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  modalSub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  occasionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  occasionText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  walletBal: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  walletBalText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  walletBalAmt: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  errorText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  payBtns: { gap: 12, marginBottom: 16 },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 16 },
  payBtnLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  toast: { position: 'absolute', bottom: 90, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
