import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { UGC_VIDEOS_CONFIG } from '@/components/ugc/configs';
import { UgcHistory } from '@/components/ugc/UgcHistory';
import { UgcOrderShell } from '@/components/ugc/UgcOrderShell';
import { buildDetails, displayValue, type CelebrityLite, type Values } from '@/components/ugc/types';
import { parseApiError, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useCelebrityById } from '@/hooks/useCelebrityById';
import { usePlan } from '@/hooks/usePlan';
import { useWallet } from '@/hooks/useWallet';

const DEFAULT_PRICE = 500;
const CELEBRITY_SELECT = 'id,name,category,image_url,service_prices';

export default function UgcVideosScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const wallet = useWallet();
  const { getDiscountedPrice } = usePlan();
  const token = session?.access_token ?? null;
  const [fallbackPrice, setFallbackPrice] = useState(DEFAULT_PRICE);
  // Opened with a celebrity chosen: start with them selected.
  const { celebrity: celebrityParam } = useLocalSearchParams<{ celebrity?: string }>();
  const preset = useCelebrityById<CelebrityLite>(celebrityParam, CELEBRITY_SELECT);

  useEffect(() => { wallet.refetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return;
    supabaseFetch('/rest/v1/platform_settings?setting_key=eq.ugc_video_price&select=setting_value&limit=1', {}, token)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ setting_value: string }>) => {
        const v = parseInt(rows[0]?.setting_value ?? '', 10);
        if (v > 0) setFallbackPrice(v);
      })
      .catch(() => {});
  }, [token]);

  const baseFor = (c: CelebrityLite) => c.service_prices?.ugc_ad || fallbackPrice;
  const getPrice = (v: Values) => (v.celebrity ? getDiscountedPrice(baseFor(v.celebrity as CelebrityLite)) : null);

  const fieldOf = (sectionKey: string, key: string) =>
    UGC_VIDEOS_CONFIG.sections.find(s => s.key === sectionKey)!.fields.find(f => f.key === key)!;

  const onSubmit = async (v: Values) => {
    if (!token) throw new Error('Please sign in again.');
    const celeb = v.celebrity as CelebrityLite;
    const forMe = v.for_whom === 'me';
    const photos: string[] = v.photos ?? [];

    const res = await supabaseFetch('/rest/v1/rpc/create_wish_friend_order', {
      method: 'POST',
      body: JSON.stringify({
        p_order_type: 'ugc_video',
        p_celebrity_id: celeb.id,
        p_recipient_name: forMe ? (user?.firstName || 'Me') : (v.name ?? ''),
        p_occasion: displayValue(fieldOf('who', 'occasion'), v.occasion),
        p_relationship: !forMe && v.relationship ? displayValue(fieldOf('who', 'relationship'), v.relationship) : '',
        p_tone: Array.isArray(v.tone) ? displayValue(fieldOf('style', 'tone'), v.tone) : '',
        p_prompt: v.message ?? '',
        p_aspect_ratio: v.aspect_ratio ?? '9:16',
        p_hook_style: '',
        p_call_to_action: '',
        p_reference_image_url: photos[0] ?? '',
        p_details: buildDetails(UGC_VIDEOS_CONFIG, v),
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
        config={UGC_VIDEOS_CONFIG}
        initialValues={preset.celebrity ? { celebrity: preset.celebrity } : undefined}
        title="UGC Videos"
        subtitle="A personal, creator-style video with a celebrity, made for someone you care about."
        headerIcon="video"
        pills={['Made by our team', 'Paid from wallet', 'Delivered to My orders']}
        getPrice={getPrice}
        walletBalance={wallet.balance}
        onSubmit={onSubmit}
        onPaid={() => wallet.refetch()}
        celebrityPrice={c => getDiscountedPrice(baseFor(c))}
        token={token}
        authUid={user?.id ?? ''}
        successTitle="Video order placed"
        itemLabel={v => `a UGC video${v.for_whom === 'me' ? '' : v.name ? ` for ${v.name}` : ''}`}
        historySlot={(refreshKey, goToNew) => (
          <UgcHistory
            kind="video"
            gradient={UGC_VIDEOS_CONFIG.gradient}
            accent={UGC_VIDEOS_CONFIG.accent}
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
