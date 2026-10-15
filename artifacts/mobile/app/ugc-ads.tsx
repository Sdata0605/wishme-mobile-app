import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { UGC_ADS_CONFIG } from '@/components/ugc/configs';
import { UgcHistory } from '@/components/ugc/UgcHistory';
import { UgcOrderShell } from '@/components/ugc/UgcOrderShell';
import { buildDetails, displayValue, type CelebrityLite, type Values } from '@/components/ugc/types';
import { parseApiError, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrityById } from '@/hooks/useCelebrityById';
import { usePlan } from '@/hooks/usePlan';
import { useWallet } from '@/hooks/useWallet';

const DEFAULT_PRICE = 999;
const CELEBRITY_SELECT = 'id,name,category,image_url,service_prices';

export default function UgcAdsScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const wallet = useWallet();
  const { getDiscountedPrice } = usePlan();
  const token = session?.access_token ?? null;
  const [basePrice, setBasePrice] = useState(DEFAULT_PRICE);
  // Opened from a celebrity's profile: start with them as the presenter.
  const { celebrity: celebrityParam } = useLocalSearchParams<{ celebrity?: string }>();
  const preset = useCelebrityById<CelebrityLite>(celebrityParam, CELEBRITY_SELECT);

  useEffect(() => { wallet.refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return;
    supabaseFetch('/rest/v1/platform_settings?setting_key=eq.ugc_ads_price&select=setting_value&limit=1', {}, token)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ setting_value: string }>) => {
        const v = parseInt(rows[0]?.setting_value ?? '', 10);
        if (v > 0) setBasePrice(v);
      })
      .catch(() => {});
  }, [token]);

  const baseFor = (c: CelebrityLite | null | undefined) => c?.service_prices?.ugc_ad || basePrice;

  const getPrice = (v: Values) => getDiscountedPrice(baseFor(v.presenter === 'celebrity' ? v.celebrity : null));

  const onSubmit = async (v: Values) => {
    if (!token) throw new Error('Please sign in again.');
    const images: string[] = v.images ?? [];
    const ctaField = UGC_ADS_CONFIG.sections[1].fields.find(f => f.key === 'cta')!;
    const cta = v.cta === 'custom' ? (v.cta_custom ?? '') : v.cta ? displayValue(ctaField, v.cta) : '';
    const celeb: CelebrityLite | null = v.presenter === 'celebrity' ? v.celebrity ?? null : null;

    const res = await supabaseFetch('/rest/v1/rpc/create_ugc_ad_order', {
      method: 'POST',
      body: JSON.stringify({
        p_celebrity_id: celeb?.id ?? null,
        p_product_name: v.product_name ?? '',
        p_product_description: v.product_description ?? '',
        p_product_image_url: images[0] ?? '',
        p_prompt: v.brief ?? '',
        p_hook_style: v.hook_style && v.hook_style !== 'auto' ? v.hook_style : '',
        p_call_to_action: cta,
        p_aspect_ratio: v.aspect_ratio ?? '9:16',
        p_details: buildDetails(UGC_ADS_CONFIG, v),
      }),
    }, token);
    if (!res.ok) throw new Error(await parseApiError(res));
    const order = await res.json() as { id: string };
    return { id: order.id };
  };

  if (preset.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <UgcOrderShell
        config={UGC_ADS_CONFIG}
        initialValues={preset.celebrity ? { presenter: 'celebrity', celebrity: preset.celebrity } : undefined}
        title="UGC Ads"
        subtitle="Order a creator-style promo video for your product or brand."
        headerIcon="zap"
        pills={['Made by our team', 'Paid from wallet', 'Delivered to My orders']}
        getPrice={getPrice}
        walletBalance={wallet.balance}
        onSubmit={onSubmit}
        onPaid={() => wallet.refetch()}
        celebrityPrice={c => getDiscountedPrice(baseFor(c))}
        token={token}
        authUid={user?.id ?? ''}
        successTitle="Ad order placed"
        itemLabel={v => `a UGC ad for ${v.product_name ?? 'your product'}`}
        historySlot={(refreshKey, goToNew) => (
          <UgcHistory
            kind="ad"
            gradient={UGC_ADS_CONFIG.gradient}
            accent={UGC_ADS_CONFIG.accent}
            token={token}
            authUid={user?.id ?? ''}
            profileId={user?.profileId ?? ''}
            refreshKey={refreshKey}
            onCreate={goToNew}
          />
        )}
      />
    </View>
  );
}
