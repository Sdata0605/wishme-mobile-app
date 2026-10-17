import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
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
import { Icon } from '@/components/Icon';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch, SUPABASE_URL } from '@/constants/supabase';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const OCCASIONS = [
  'Birthday', 'Anniversary', 'Wedding', 'Congratulations',
  'Get Well Soon', 'Thank You', 'Good Luck', 'Graduation',
];

type UploadMode = 'ai' | 'upload-card' | 'upload-video';

interface CelebrityDetail {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  is_verified: boolean;
  rating: number;
  service_prices?: { general_wish?: number };
}

interface ProfileRow {
  id: string;
  wallet_balance: number;
}

interface WishOrder {
  id: string;
  occasion_type: string;
  recipient_name: string;
  message: string;
  card_prompt: string | null;
  card_generation_type: UploadMode;
  amount_paid: number;
  payment_status: string;
  status: string;
  generated_card_image_url: string | null;
  greeting_text: string | null;
  reference_image_url: string | null;
  user_uploaded_card_url: string | null;
  user_uploaded_video_url: string | null;
  generation_attempts: number;
}

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';
function imgUrl(url: string | null): string {
  if (!url) return '';
  return url.startsWith('http') ? url : B2_BASE + url;
}

export default function WishCelebrityOccasionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, user, getValidSession } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [celeb, setCeleb] = useState<CelebrityDetail | null>(null);
  const [celebLoading, setCelebLoading] = useState(true);
  const [basePrice, setBasePrice] = useState(0);
  const [planDiscountPct, setPlanDiscountPct] = useState(0);
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);
  const [profileId, setProfileId] = useState(user?.profileId ?? '');

  const [occasionType, setOccasionType] = useState('');
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [msgChips, setMsgChips] = useState<string[]>([]);
  const [suggestingMsg, setSuggestingMsg] = useState(false);

  const [uploadMode, setUploadMode] = useState<UploadMode>('ai');
  const [cardPrompt, setCardPrompt] = useState('');
  const [promptChips, setPromptChips] = useState<string[]>([]);
  const [suggestingPrompt, setSuggestingPrompt] = useState(false);
  const [refImageUri, setRefImageUri] = useState<string | null>(null);
  const [refImageMime, setRefImageMime] = useState<string>('image/jpeg');
  const [uploadedCardUri, setUploadedCardUri] = useState<string | null>(null);
  const [uploadedCardMime, setUploadedCardMime] = useState<string>('image/jpeg');
  const [uploadedVideoUri, setUploadedVideoUri] = useState<string | null>(null);
  const [uploadedVideoMime, setUploadedVideoMime] = useState<string>('video/mp4');
  const [contentPolicyChecked, setContentPolicyChecked] = useState(false);

  const [payModalVisible, setPayModalVisible] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [toast, setToast] = useState('');

  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [generationAttempts, setGenerationAttempts] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [orderPaid, setOrderPaid] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

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
          const sp = c.service_prices as { general_wish?: number } | undefined;
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

  const restoreOrder = useCallback(async () => {
    if (!session?.access_token || !user?.profileId || !id) return;
    try {
      const storedId = await AsyncStorage.getItem(`wishOrderId:${id}`);
      let orderId = storedId;

      if (!orderId) {
        const res = await supabaseFetch(
          `/rest/v1/wish_celebrity_orders?user_id=eq.${user.profileId}&celebrity_id=eq.${id}&order=created_at.desc&limit=1`,
          {},
          session.access_token,
        );
        if (res.ok) {
          const rows = await res.json() as WishOrder[];
          if (rows?.length) orderId = rows[0].id;
        }
      }

      if (orderId) {
        const res = await supabaseFetch(
          `/rest/v1/wish_celebrity_orders?id=eq.${orderId}&select=*&limit=1`,
          {},
          session.access_token,
        );
        if (res.ok) {
          const rows = await res.json() as WishOrder[];
          if (rows?.length) {
            const o = rows[0];
            setExistingOrderId(o.id);
            setOccasionType(o.occasion_type ?? '');
            setRecipientName(o.recipient_name ?? '');
            setMessage(o.message ?? '');
            setCardPrompt(o.card_prompt ?? '');
            const mode = (o.card_generation_type as UploadMode) ?? 'ai';
            setUploadMode(mode);
            if (o.generated_card_image_url) setCardImageUrl(o.generated_card_image_url);
            if (o.greeting_text) setGreetingText(o.greeting_text);
            setGenerationAttempts(o.generation_attempts ?? 0);
            if (o.payment_status === 'completed') setOrderPaid(true);
            if (mode === 'upload-card' && o.user_uploaded_card_url) {
              setUploadedCardUri(o.user_uploaded_card_url);
            }
            if (mode === 'upload-video' && o.user_uploaded_video_url) {
              setUploadedVideoUri(o.user_uploaded_video_url);
            }
            if (mode === 'ai' && o.reference_image_url) {
              setRefImageUri(o.reference_image_url);
            }
          }
        }
      }
    } catch {}
  }, [session, user, id]);

  useEffect(() => {
    loadCeleb();
    loadWallet();
  }, [loadCeleb, loadWallet]);

  useEffect(() => {
    restoreOrder();
  }, [restoreOrder]);

  const discountAmt = planDiscountPct > 0 ? Math.round((basePrice * planDiscountPct) / 100) : 0;
  const finalPrice = basePrice - discountAmt;

  const getAISuggestions = async () => {
    if (!occasionType || !recipientName) {
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
          occasionType,
          occasion: occasionType,
          recipientName,
          recipient_name: recipientName,
        }),
      }, session?.access_token);
      if (res.ok) {
        const data = await res.json() as { suggestions?: string[] };
        if (data.suggestions?.length) setMsgChips(data.suggestions.slice(0, 4));
      }
    } catch {}
    setSuggestingMsg(false);
  };

  const getSuggestPrompts = async () => {
    if (!occasionType) { showToast('Please select an occasion first'); return; }
    setSuggestingPrompt(true);
    try {
      const res = await supabaseFetch('/functions/v1/suggest-greeting-card-prompts', {
        method: 'POST',
        body: JSON.stringify({
          celebrityName: celeb?.name,
          celebrity_name: celeb?.name,
          occasionType,
          occasion: occasionType,
          recipientName,
          recipient_name: recipientName,
          message,
        }),
      }, session?.access_token);
      if (res.ok) {
        const data = await res.json() as { prompts?: string[] };
        if (data.prompts?.length) setPromptChips(data.prompts.slice(0, 4));
      }
    } catch {}
    setSuggestingPrompt(false);
  };

  const uploadFileToStorage = async (uri: string, path: string, mimeType: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const token = session?.access_token;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/greeting-card-uploads/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: blob,
      });
      if (!uploadRes.ok) return null;
      return `${SUPABASE_URL}/storage/v1/object/public/greeting-card-uploads/${path}`;
    } catch { return null; }
  };

  const pickRefImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setRefImageUri(asset.uri);
      setRefImageMime(asset.mimeType ?? 'image/jpeg');
    }
  };

  const pickUploadCard = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setUploadedCardUri(asset.uri);
      setUploadedCardMime(asset.mimeType ?? 'image/jpeg');
    }
  };

  const pickUploadVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setUploadedVideoUri(asset.uri);
      setUploadedVideoMime(asset.mimeType ?? 'video/mp4');
    }
  };

  const handleProceed = () => {
    if (!occasionType) { showToast('Please select an occasion'); return; }
    if (!recipientName.trim()) { showToast('Please enter recipient name'); return; }
    if (!message.trim()) { showToast('Please enter a message'); return; }
    if (uploadMode === 'ai' && !cardPrompt.trim()) { showToast('Please enter a card prompt'); return; }
    if (uploadMode === 'upload-card' && !uploadedCardUri) { showToast('Please upload a greeting card image'); return; }
    if (uploadMode === 'upload-video' && !uploadedVideoUri) { showToast('Please upload a video'); return; }
    if (!contentPolicyChecked) { showToast('Please accept the content policy'); return; }
    setPayError('');
    setPayModalVisible(true);
  };

  const createOrGetOrder = async (paymentMethod: string, paymentStatus: string): Promise<string> => {
    if (existingOrderId) {
      await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${existingOrderId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ payment_method: paymentMethod, payment_status: paymentStatus }),
      }, session?.access_token);
      return existingOrderId;
    }

    let refImageStoredUrl: string | null = null;
    let uploadedCardStoredUrl: string | null = null;
    let uploadedVideoStoredUrl: string | null = null;

    setUploadingFile(true);

    if (uploadMode === 'ai' && refImageUri) {
      const ts = Date.now();
      const ext = refImageMime.split('/')[1] ?? 'jpg';
      const path = `ref-images/${profileId}-${ts}.${ext}`;
      refImageStoredUrl = await uploadFileToStorage(refImageUri, path, refImageMime);
    } else if (uploadMode === 'upload-card' && uploadedCardUri) {
      const ts = Date.now();
      const ext = uploadedCardMime.split('/')[1] ?? 'jpg';
      const path = `user-cards/${profileId}-${ts}.${ext}`;
      uploadedCardStoredUrl = await uploadFileToStorage(uploadedCardUri, path, uploadedCardMime);
      if (!uploadedCardStoredUrl) {
        setUploadingFile(false);
        throw new Error('Failed to upload card image. Please try again.');
      }
    } else if (uploadMode === 'upload-video' && uploadedVideoUri) {
      const ts = Date.now();
      const ext = uploadedVideoMime.split('/')[1] ?? 'mp4';
      const path = `user-videos/${profileId}-${ts}.${ext}`;
      uploadedVideoStoredUrl = await uploadFileToStorage(uploadedVideoUri, path, uploadedVideoMime);
      if (!uploadedVideoStoredUrl) {
        setUploadingFile(false);
        throw new Error('Failed to upload video. Please try again.');
      }
    }

    setUploadingFile(false);

    const res = await supabaseFetch('/rest/v1/wish_celebrity_orders', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: profileId,
        celebrity_id: id,
        occasion_type: occasionType,
        recipient_name: recipientName,
        message,
        card_prompt: cardPrompt || null,
        reference_image_url: refImageStoredUrl,
        user_uploaded_card_url: uploadedCardStoredUrl,
        user_uploaded_video_url: uploadedVideoStoredUrl,
        card_generation_type: uploadMode,
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
    const oid = rows[0]?.id;
    if (oid) {
      setExistingOrderId(oid);
      await AsyncStorage.setItem(`wishOrderId:${id}`, oid);
    }
    return oid;
  };

  const handleWalletPay = async () => {
    if (walletBalance < finalPrice) { setPayError('Insufficient wallet balance'); return; }
    setPaying(true);
    setPayError('');
    let orderId: string | undefined;
    try {
      orderId = await createOrGetOrder('wallet', 'pending');
      // Created unpaid; it becomes 'completed' only after the wallet has been charged, and that change is what pays the celebrity.

      const txRes = await supabaseFetch('/rest/v1/wallet_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: profileId,
          amount: finalPrice,
          // The wallet table has no 'type' or 'reference_id' column (sending them made every wallet payment here fail).
          transaction_type: 'booking',
          payment_method: 'wallet',
          status: 'completed',
          description: `Wish order #${orderId} for ${celeb?.name} - ${occasionType}`,
          transaction_details: {
            base_price: basePrice,
            discount_percentage: planDiscountPct,
            discount_amount: discountAmt,
            plan: planDiscountPct > 0 ? 'subscriber' : 'standard',
          },
        }),
      }, session?.access_token);

      if (!txRes.ok) {
        await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${orderId}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        }, session?.access_token).catch(() => {});
        if (orderId) await AsyncStorage.removeItem(`wishOrderId:${id}`);
        throw new Error('Wallet transaction failed');
      }

      await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${orderId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'paid', payment_status: 'completed', payment_method: 'wallet' }),
      }, session?.access_token);

      setExistingOrderId(orderId);
      setOrderPaid(true);
      setPayModalVisible(false);

      if (uploadMode === 'ai') {
        await generateCard(orderId);
      } else {
        showToast('Payment successful! Your order is placed.');
      }
    } catch (e: unknown) {
      setPayError(e instanceof Error ? e.message : 'Payment failed');
    }
    setPaying(false);
  };

  const handleRazorpayPay = async () => {
    setPaying(true);
    setPayError('');
    let orderId: string | undefined;
    try {
      orderId = await createOrGetOrder('razorpay', 'pending');

      const rzpRes = await supabaseFetch('/functions/v1/create-razorpay-order', {
        method: 'POST',
        body: JSON.stringify({
          amount: finalPrice * 100,
          currency: 'INR',
          receipt: `WISH-${orderId}`.slice(0, 40),
          notes: { orderId },
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
            orderId,
            orderType: 'wish',
          }),
        }, session?.access_token);
        if (!verifyRes.ok) throw new Error('Payment verification failed');

        await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${orderId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'paid', payment_status: 'completed', payment_method: 'razorpay' }),
        }, session?.access_token);

        setExistingOrderId(orderId!);
        setOrderPaid(true);
        setPayModalVisible(false);

        if (uploadMode === 'ai') {
          await generateCard(orderId!);
        } else {
          showToast('Payment successful! Your order is placed.');
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
          description: `Wish for ${celeb?.name}`,
          prefill: { name: prefillName, email: user?.email ?? '', contact: user?.phone ?? '' },
          theme: { color: '#FF6B33' },
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
          if (candidate && typeof candidate.open === 'function') razorpayModule = candidate;
        } catch {}

        if (!razorpayModule) {
          if (orderId) {
            await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${orderId}`, {
              method: 'DELETE',
              headers: { Prefer: 'return=minimal' },
            }, session?.access_token).catch(() => {});
            await AsyncStorage.removeItem(`wishOrderId:${id}`);
          }
          setPaying(false);
          Alert.alert('Native Checkout Not Available', 'Razorpay native checkout requires a custom development build. Please use Wallet payment, or try from the web app.', [{ text: 'OK' }]);
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
          theme: { color: '#FF6B33' },
        });

        if (data?.razorpay_payment_id) {
          await onPaymentSuccess(data.razorpay_payment_id, data.razorpay_order_id, data.razorpay_signature);
        }
      }
    } catch (err: unknown) {
      const errMsg = (err as Record<string, string>)?.description ?? (err instanceof Error ? err.message : 'Payment failed');
      if (!errMsg.toLowerCase().includes('cancel')) {
        setPayError(errMsg);
      } else if (orderId) {
        await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${orderId}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        }, session?.access_token).catch(() => {});
        await AsyncStorage.removeItem(`wishOrderId:${id}`);
      }
    }
    setPaying(false);
  };

  const generateCard = async (oid: string) => {
    if (generationAttempts >= 3) { showToast('Maximum regenerations reached'); return; }
    setGenerating(true);
    setGenError('');
    try {
      const res = await supabaseFetch('/functions/v1/generate-wish-celebrity-card', {
        method: 'POST',
        body: JSON.stringify({ orderId: oid }),
      }, session?.access_token);

      if (!res.ok) throw new Error('Card generation failed');
      const data = await res.json() as {
        success?: boolean;
        card_url?: string;
        cardUrl?: string;
        card_image_url?: string;
        image_url?: string;
        greeting_text?: string;
        greetingText?: string;
        generation_attempts?: number;
      };
      const imgU = data.card_url ?? data.cardUrl ?? data.card_image_url ?? data.image_url ?? null;
      const gText = data.greeting_text ?? data.greetingText ?? null;
      if (imgU) setCardImageUrl(imgU);
      if (gText) setGreetingText(gText);
      setGenerationAttempts((prev) =>
        typeof data.generation_attempts === "number" ? data.generation_attempts : prev + 1
      );
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate card');
    }
    setGenerating(false);
  };

  const handleRegenerate = () => {
    if (!existingOrderId) return;
    if (generationAttempts >= 3) { showToast('Maximum regenerations reached (3)'); return; }
    generateCard(existingOrderId);
  };

  const handleApproveAndSend = async () => {
    if (!existingOrderId) return;
    setSending(true);
    setSendError('');
    try {
      const res = await supabaseFetch('/functions/v1/send-wish-to-celebrity', {
        method: 'POST',
        body: JSON.stringify({ orderId: existingOrderId }),
      }, session?.access_token);
      if (!res.ok) throw new Error('Failed to send wish');
      await AsyncStorage.removeItem(`wishOrderId:${id}`);
      router.replace({ pathname: '/wish-congratulations', params: { orderId: existingOrderId } } as never);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Failed to send wish');
    }
    setSending(false);
  };

  const handleSendUpload = async () => {
    if (!existingOrderId) return;
    setSending(true);
    setSendError('');
    try {
      const res = await supabaseFetch('/functions/v1/send-wish-thankyou-dm', {
        method: 'POST',
        body: JSON.stringify({ orderId: existingOrderId }),
      }, session?.access_token);
      if (!res.ok) throw new Error('Failed to send wish');

      await supabaseFetch(`/rest/v1/wish_celebrity_orders?id=eq.${existingOrderId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'sent' }),
      }, session?.access_token);

      await AsyncStorage.removeItem(`wishOrderId:${id}`);
      router.replace({ pathname: '/wish-congratulations', params: { orderId: existingOrderId } } as never);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Failed to send wish');
    }
    setSending(false);
  };

  const imageUri = celeb?.image_url ? imgUrl(celeb.image_url) : null;
  const maxRegen = generationAttempts >= 3;

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Send a Wish</Text>
        <View style={{ width: 22 }} />
      </View>

      {celebLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
              {basePrice > 0 && (
                <View style={s.priceTag}>
                  <Text style={s.priceTagText}>₹{basePrice.toLocaleString('en-IN')}</Text>
                </View>
              )}
            </View>
          )}

          {!orderPaid && (
            <>
              <Text style={[s.sectionLabel, { color: colors.foreground }]}>Occasion</Text>
              <TouchableOpacity
                style={[s.dropdown, { backgroundColor: colors.input, borderColor: colors.border }]}
                onPress={() => setOccasionOpen(true)}
              >
                <Text style={[s.dropdownText, { color: occasionType ? colors.foreground : colors.mutedForeground }]}>
                  {occasionType || 'Select occasion...'}
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
                <TouchableOpacity style={[s.suggestBtn, { borderColor: colors.primary }]} onPress={getAISuggestions} disabled={suggestingMsg}>
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
                    <TouchableOpacity key={i} style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setMessage(chip)}>
                      <Text style={[s.chipText, { color: colors.foreground }]} numberOfLines={2}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TextInput
                style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Write your heartfelt message..."
                placeholderTextColor={colors.mutedForeground}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={[s.sectionLabel, { color: colors.foreground }]}>Card Type</Text>
              <View style={s.uploadModeRow}>
                {(['ai', 'upload-card', 'upload-video'] as UploadMode[]).map(mode => {
                  const labels: Record<UploadMode, string> = { ai: 'AI Card', 'upload-card': 'Upload Card', 'upload-video': 'Upload Video' };
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[s.uploadModeBtn, { borderColor: uploadMode === mode ? '#FF6B33' : colors.border, backgroundColor: uploadMode === mode ? '#FF6B3318' : colors.input }]}
                      onPress={() => setUploadMode(mode)}
                    >
                      <Text style={[s.uploadModeBtnText, { color: uploadMode === mode ? '#FF6B33' : colors.mutedForeground }]}>{labels[mode]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {uploadMode === 'ai' && (
                <>
                  <View style={s.labelRow}>
                    <Text style={[s.sectionLabel, { color: colors.foreground }]}>Card Prompt</Text>
                    <TouchableOpacity style={[s.suggestBtn, { borderColor: colors.primary }]} onPress={getSuggestPrompts} disabled={suggestingPrompt}>
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
                        <TouchableOpacity key={i} style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setCardPrompt(chip)}>
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
                  <Text style={[s.sectionLabel, { color: colors.foreground }]}>Reference Image (Optional)</Text>
                  <TouchableOpacity style={[s.uploadBox, { backgroundColor: colors.input, borderColor: colors.border }]} onPress={pickRefImage}>
                    {refImageUri ? (
                      <Image source={{ uri: refImageUri }} style={s.uploadPreview} contentFit="cover" />
                    ) : (
                      <>
                        <Icon name="image" size={24} color={colors.mutedForeground} />
                        <Text style={[s.uploadBoxText, { color: colors.mutedForeground }]}>Tap to upload reference image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {uploadMode === 'upload-card' && (
                <>
                  <Text style={[s.sectionLabel, { color: colors.foreground }]}>Upload Greeting Card</Text>
                  <TouchableOpacity style={[s.uploadBox, { backgroundColor: colors.input, borderColor: colors.border }]} onPress={pickUploadCard}>
                    {uploadedCardUri ? (
                      <Image source={{ uri: uploadedCardUri }} style={s.uploadPreview} contentFit="cover" />
                    ) : (
                      <>
                        <Icon name="upload" size={24} color={colors.mutedForeground} />
                        <Text style={[s.uploadBoxText, { color: colors.mutedForeground }]}>Tap to upload card image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {uploadMode === 'upload-video' && (
                <>
                  <Text style={[s.sectionLabel, { color: colors.foreground }]}>Upload Video</Text>
                  <TouchableOpacity style={[s.uploadBox, { backgroundColor: colors.input, borderColor: colors.border }]} onPress={pickUploadVideo}>
                    {uploadedVideoUri ? (
                      <>
                        <Icon name="video" size={32} color={colors.primary} />
                        <Text style={[s.uploadBoxText, { color: colors.primary }]}>Video selected</Text>
                      </>
                    ) : (
                      <>
                        <Icon name="video" size={24} color={colors.mutedForeground} />
                        <Text style={[s.uploadBoxText, { color: colors.mutedForeground }]}>Tap to upload video</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

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

              <TouchableOpacity
                style={s.policyRow}
                onPress={() => setContentPolicyChecked(p => !p)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, { borderColor: contentPolicyChecked ? '#FF6B33' : colors.border, backgroundColor: contentPolicyChecked ? '#FF6B33' : 'transparent' }]}>
                  {contentPolicyChecked && <Icon name="check" size={12} color="#fff" />}
                </View>
                <Text style={[s.policyText, { color: colors.mutedForeground }]}>
                  I agree to the content policy and confirm this wish follows community guidelines.
                </Text>
              </TouchableOpacity>

              <GradientButton
                title="Proceed to Payment"
                onPress={handleProceed}
                style={{ marginTop: 8 }}
                disabled={!contentPolicyChecked}
              />
            </>
          )}

          {orderPaid && uploadMode === 'ai' && (
            <>
              <Text style={[s.sectionLabel, { color: colors.foreground, fontSize: 16, marginBottom: 12 }]}>AI Greeting Card</Text>

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

              {maxRegen && (
                <View style={[s.maxRegenBanner, { backgroundColor: colors.muted }]}>
                  <Icon name="info" size={14} color={colors.mutedForeground} />
                  <Text style={[s.maxRegenText, { color: colors.mutedForeground }]}>Maximum regenerations reached (3/3)</Text>
                </View>
              )}

              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.regenBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: maxRegen || generating ? 0.5 : 1 }]}
                  onPress={handleRegenerate}
                  disabled={generating || sending || maxRegen}
                >
                  {generating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Icon name="refresh-cw" size={16} color={colors.primary} />
                  )}
                  <Text style={[s.regenText, { color: colors.primary }]}>Regenerate</Text>
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

              {sendError ? (
                <View style={s.sendErrorRow}>
                  <Icon name="alert-circle" size={14} color="#EF4444" />
                  <Text style={s.sendErrorText}>{sendError}</Text>
                </View>
              ) : null}
            </>
          )}

          {orderPaid && uploadMode !== 'ai' && (
            <>
              <Text style={[s.sectionLabel, { color: colors.foreground, fontSize: 16, marginBottom: 12 }]}>
                {uploadMode === 'upload-card' ? 'Your Greeting Card' : 'Your Video'}
              </Text>
              {uploadedCardUri && (
                <View style={[s.cardContainer, { borderColor: colors.border }]}>
                  <Image source={{ uri: uploadedCardUri }} style={s.cardImage} contentFit="cover" />
                </View>
              )}
              {uploadedVideoUri && (
                <View style={[s.uploadBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="video" size={36} color={colors.primary} />
                  <Text style={[s.uploadBoxText, { color: colors.primary }]}>Video ready to send</Text>
                </View>
              )}

              <GradientButton
                title="Send Wish"
                onPress={handleSendUpload}
                loading={sending}
                style={{ marginTop: 16 }}
                icon={<Icon name="send" size={16} color="#fff" />}
              />

              {sendError ? (
                <View style={s.sendErrorRow}>
                  <Icon name="alert-circle" size={14} color="#EF4444" />
                  <Text style={s.sendErrorText}>{sendError}</Text>
                </View>
              ) : null}
            </>
          )}
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
                onPress={() => { setOccasionType(o); setOccasionOpen(false); }}
              >
                <Text style={[s.occasionText, { color: occasionType === o ? colors.primary : colors.foreground }]}>{o}</Text>
                {occasionType === o && <Icon name="check" size={16} color={colors.primary} />}
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

            {uploadingFile && (
              <View style={s.uploadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[s.uploadingText, { color: colors.mutedForeground }]}>Uploading file...</Text>
              </View>
            )}

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

              <TouchableOpacity style={[s.payBtn, { borderColor: '#FF6B33' }]} onPress={handleRazorpayPay} disabled={paying}>
                {paying ? <ActivityIndicator size="small" color="#FF6B33" /> : <Icon name="credit-card" size={20} color="#FF6B33" />}
                <Text style={[s.payBtnLabel, { color: '#FF6B33' }]}>Pay via Razorpay</Text>
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
  priceTag: { backgroundColor: '#FF6B3318', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  priceTagText: { color: '#FF6B33', fontSize: 14, fontFamily: 'Inter_700Bold' },
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
  uploadModeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  uploadModeBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  uploadModeBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  uploadBox: { borderWidth: 1.5, borderRadius: 14, borderStyle: 'dashed', height: 140, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, overflow: 'hidden' },
  uploadPreview: { width: '100%', height: '100%' },
  uploadBoxText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pricingCard: { borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  pricingLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  pricingValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pricingTotal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  discountBadge: { backgroundColor: '#22C55E18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#22C55E' },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  policyText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  cardPlaceholder: { borderRadius: 16, borderWidth: 1, height: 220, alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  cardContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  cardImage: { width: '100%', height: 280 },
  greetingBox: { padding: 16 },
  greetingText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic' },
  genErrorText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  maxRegenBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 10, marginBottom: 12 },
  maxRegenText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' },
  regenBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 9999, paddingVertical: 12, paddingHorizontal: 16 },
  regenText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sendErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  sendErrorText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
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
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  uploadingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
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
