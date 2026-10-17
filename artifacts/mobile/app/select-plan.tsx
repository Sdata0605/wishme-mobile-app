import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { AmbientBackground } from '@/components/neon/AmbientBackground';

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

interface Plan {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  service_discount_percentage: number;
  referral_commission_l1: number | null;
  referral_commission_l2: number | null;
  is_active: boolean;
  features: string[] | Record<string, unknown>;
  is_popular?: boolean;
}

const PLAN_ORDER = ['basic', 'premium', 'elite'];
const PLAN_ICONS: Record<string, string> = {
  basic: 'star',
  premium: 'zap',
  elite: 'award',
};
const PLAN_COLORS: Record<string, string> = {
  basic: '#22C55E',
  premium: '#FF6B33',
  elite: '#B44CFF',
};

function getPlanTierIndex(planName: string): number {
  const lower = planName.toLowerCase();
  const idx = PLAN_ORDER.indexOf(lower);
  return idx === -1 ? 0 : idx;
}

function parseFeatures(features: string[] | Record<string, unknown> | null | undefined): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features as string[];
  if (typeof features === 'object') {
    const vals = Object.values(features);
    return vals.filter((v) => typeof v === 'string') as string[];
  }
  return [];
}

export default function SelectPlanScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;
  const params = useLocalSearchParams<{ source?: string }>();
  const isPostSignup = params.source === 'signup';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<string>('');
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, profileRes] = await Promise.all([
        supabaseFetch(
          '/rest/v1/plans?is_active=eq.true&order=price.asc',
          {},
          accessToken,
        ),
        profileId
          ? supabaseFetch(
              `/rest/v1/profiles?select=plan&id=eq.${profileId}&limit=1`,
              {},
              accessToken,
            )
          : Promise.resolve(null),
      ]);

      if (plansRes.ok) {
        const rows = await plansRes.json() as Plan[];
        setPlans(rows ?? []);
      }

      if (profileRes && profileRes.ok) {
        const rows = await profileRes.json() as Array<{ plan: string }>;
        if (rows && rows.length > 0 && rows[0].plan) {
          setCurrentPlan(rows[0].plan);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load plans. Please pull down to refresh.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentTierIndex = getPlanTierIndex(currentPlan);

  const visiblePlans = plans.filter((p) => {
    const planTierIndex = getPlanTierIndex(p.name);
    return planTierIndex >= currentTierIndex;
  });

  const isCurrentPlan = (plan: Plan) =>
    plan.name.toLowerCase() === currentPlan.toLowerCase();

  const isEliteUser = currentPlan.toLowerCase() === 'elite';

  const handlePurchasePlan = useCallback(async (plan: Plan) => {
    if (!profileId || !accessToken) {
      Alert.alert('Error', 'Please log in to purchase a plan.');
      return;
    }
    if (isCurrentPlan(plan)) return;

    setPurchasingPlanId(plan.id);

    try {
      const receipt = `plan_${profileId.slice(0, 8)}_${Date.now()}`.slice(0, 40);

      const orderRes = await supabaseFetch(
        '/functions/v1/create-razorpay-order',
        {
          method: 'POST',
          body: JSON.stringify({
            amount: plan.price,
            currency: 'INR',
            receipt,
            notes: {
              user_id: profileId,
              plan_name: plan.name,
              type: 'plan_purchase',
            },
          }),
        },
        accessToken,
      );

      if (!orderRes.ok) {
        const e = await orderRes.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', e.error ?? 'Failed to create payment order. Please try again.');
        return;
      }

      const order = await orderRes.json() as {
        id: string;
        amount: number;
        currency: string;
        key_id: string;
      };

      const prefillName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

      const onPaymentSuccess = async (
        razorpayPaymentId: string,
        razorpayOrderId: string,
        razorpaySignature: string,
      ) => {
        try {
          const verifyRes = await supabaseFetch(
            '/functions/v1/verify-razorpay-payment',
            {
              method: 'POST',
              body: JSON.stringify({
                razorpay_payment_id: razorpayPaymentId,
                razorpay_order_id: razorpayOrderId,
                razorpay_signature: razorpaySignature,
              }),
            },
            accessToken,
          );

          if (!verifyRes.ok) {
            const e = await verifyRes.json().catch(() => ({})) as Record<string, string>;
            throw new Error(e.error ?? 'Payment verification failed. Please contact support.');
          }

          const patchRes = await supabaseFetch(
            `/rest/v1/profiles?id=eq.${profileId}`,
            {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' } as Record<string, string>,
              body: JSON.stringify({ plan: plan.name.toLowerCase() }),
            },
            accessToken,
          );

          if (!patchRes.ok) {
            throw new Error('Failed to update plan. Please contact support.');
          }

          await supabaseFetch(
            '/rest/v1/wallet_transactions',
            {
              method: 'POST',
              headers: { Prefer: 'return=minimal' } as Record<string, string>,
              body: JSON.stringify({
                user_id: profileId,
                transaction_type: 'plan_purchase',
                amount: plan.price,
                status: 'completed',
                payment_method: 'razorpay',
                transaction_details: {
                  plan_name: plan.name,
                  plan_id: plan.id,
                  razorpay_payment_id: razorpayPaymentId,
                  razorpay_order_id: razorpayOrderId,
                  razorpay_signature: razorpaySignature,
                },
              }),
            },
            accessToken,
          );

          setCurrentPlan(plan.name.toLowerCase());

          Alert.alert(
            'Plan Activated!',
            `Your ${plan.name} plan is now active. Enjoy your new benefits!`,
            [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
          );
        } catch (err) {
          Alert.alert(
            'Activation Failed',
            (err as Error)?.message ?? 'Payment received but plan activation failed. Please contact support.',
          );
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
          description: `${plan.name} Plan`,
          prefill: {
            name: prefillName,
            email: user?.email ?? '',
            contact: user?.phone ?? '',
          },
          theme: { color: '#FF6B33' },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            await onPaymentSuccess(
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature,
            );
          },
        });
        rzp.open();
      } else {
        type RazorpayModule = {
          open: (opts: Record<string, unknown>) => Promise<{
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }>;
        };
        let razorpayModule: RazorpayModule | null = null;
        try {
          const mod = require('react-native-razorpay') as { default?: RazorpayModule } & RazorpayModule;
          const candidate = mod.default ?? mod;
          if (candidate && typeof candidate.open === 'function') {
            razorpayModule = candidate;
          }
        } catch {
        }

        if (!razorpayModule) {
          setPurchasingPlanId(null);
          Alert.alert(
            'Native Checkout Not Available',
            'Razorpay native checkout requires a custom development build (not Expo Go). Please use the production app from the App Store/Play Store.',
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
          description: `${plan.name} Plan`,
          prefill: {
            name: prefillName,
            email: user?.email ?? '',
            contact: user?.phone ?? '',
          },
          theme: { color: '#FF6B33' },
        });

        if (data?.razorpay_payment_id) {
          await onPaymentSuccess(
            data.razorpay_payment_id,
            data.razorpay_order_id,
            data.razorpay_signature,
          );
        }
      }
    } catch (err) {
      const errMsg = (err as Record<string, string>)?.description ?? 'Payment failed. Please try again.';
      if (!errMsg.toLowerCase().includes('cancel')) {
        Alert.alert('Payment Error', errMsg);
      }
    } finally {
      setPurchasingPlanId(null);
    }
  }, [profileId, accessToken, user, isCurrentPlan]);

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          {!isPostSignup && (
            <TouchableOpacity onPress={() => router.back()}>
              <Icon name="arrow-left" size={22} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Choose Your Plan</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B33" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading plans...</Text>
        </View>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        {!isPostSignup ? (
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEliteUser ? 'Your Plan' : 'Choose Your Plan'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + (isPostSignup ? 80 : 20) }]}
        showsVerticalScrollIndicator={false}
      >
        {isPostSignup && !isEliteUser && (
          <View style={styles.welcomeBox}>
            <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
              Welcome to WishMe!
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.mutedForeground }]}>
              Select a plan to unlock discounts, higher commissions, and exclusive features.
            </Text>
          </View>
        )}

        {isEliteUser ? (
          <View style={[styles.eliteBox, { backgroundColor: colors.card, borderColor: '#B44CFF' }]}>
            <Icon name="award" size={48} color="#B44CFF" />
            <Text style={[styles.eliteTitle, { color: colors.foreground }]}>
              You're on the Elite Plan!
            </Text>
            <Text style={[styles.eliteSubtitle, { color: colors.mutedForeground }]}>
              You already have the best plan. Enjoy maximum discounts and the highest referral commissions.
            </Text>
          </View>
        ) : (
          visiblePlans.map((plan) => {
            const planKey = plan.name.toLowerCase();
            const color = PLAN_COLORS[planKey] ?? '#FF6B33';
            const iconName = PLAN_ICONS[planKey] ?? 'star';
            const features = parseFeatures(plan.features);
            const isCurrent = isCurrentPlan(plan);
            const isPurchasing = purchasingPlanId === plan.id;
            const isPopular = planKey === 'premium';

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isCurrent ? color : colors.border,
                    borderWidth: isCurrent ? 2 : 1,
                  },
                ]}
              >
                {isPopular && !isCurrent && (
                  <View style={[styles.popularBadge, { backgroundColor: color }]}>
                    <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                  </View>
                )}
                {isCurrent && (
                  <View style={[styles.currentBadge, { backgroundColor: color }]}>
                    <Text style={styles.currentBadgeText}>CURRENT PLAN</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <View style={[styles.planIconWrap, { backgroundColor: `${color}18` }]}>
                    <Icon name={iconName as 'star'} size={24} color={color} />
                  </View>
                  <View style={styles.planTitleWrap}>
                    <Text style={[styles.planName, { color: colors.foreground }]}>
                      {plan.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.planPrice, { color }]}>
                        ₹{plan.price.toLocaleString('en-IN')}
                      </Text>
                      {plan.original_price && plan.original_price > plan.price && (
                        <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>
                          ₹{plan.original_price.toLocaleString('en-IN')}
                        </Text>
                      )}
                      <Text style={[styles.perYear, { color: colors.mutedForeground }]}>/year</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={[styles.statChip, { backgroundColor: `${color}12` }]}>
                    <Icon name="star" size={12} color={color} />
                    <Text style={[styles.statText, { color }]}>
                      {plan.service_discount_percentage}% Service Discount
                    </Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: `${color}12` }]}>
                    <Icon name="share-2" size={12} color={color} />
                    <Text style={[styles.statText, { color }]}>
                      {plan.referral_commission_l1 ?? 0}% Referral Commission{(plan.referral_commission_l2 ?? 0) > 0 ? ` · ${plan.referral_commission_l2}% level 2` : ''}
                    </Text>
                  </View>
                </View>

                {features.length > 0 && (
                  <View style={styles.featuresWrap}>
                    {features.map((feature, idx) => (
                      <View key={idx} style={styles.featureRow}>
                        <Icon name="check" size={14} color={color} />
                        <Text style={[styles.featureText, { color: colors.foreground }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.selectBtn,
                    isCurrent
                      ? { backgroundColor: `${color}20`, borderColor: color }
                      : { backgroundColor: color },
                  ]}
                  onPress={() => handlePurchasePlan(plan)}
                  disabled={isCurrent || isPurchasing || purchasingPlanId !== null}
                  activeOpacity={0.85}
                >
                  {isPurchasing ? (
                    <ActivityIndicator size="small" color={isCurrent ? color : '#fff'} />
                  ) : (
                    <Text style={[styles.selectBtnText, { color: isCurrent ? color : '#fff' }]}>
                      {isCurrent ? 'Current Plan' : `Select ${plan.name}`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {isPostSignup && !isEliteUser && (
        <View style={[styles.skipFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPad }]}>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={[styles.skipBtnText, { color: colors.mutedForeground }]}>
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View></AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  welcomeBox: {
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  eliteBox: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 32,
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  eliteTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  eliteSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  planCard: {
    borderRadius: 16,
    padding: 20,
    gap: 14,
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  popularBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  currentBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  currentBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  planIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleWrap: {
    flex: 1,
    gap: 2,
  },
  planName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textTransform: 'capitalize',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  planPrice: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  originalPrice: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'line-through',
  },
  perYear: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  statsRow: {
    flexDirection: 'column',
    gap: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  featuresWrap: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
    lineHeight: 18,
  },
  selectBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  skipFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
