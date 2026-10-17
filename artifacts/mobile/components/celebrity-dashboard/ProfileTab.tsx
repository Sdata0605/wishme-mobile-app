import React, { useEffect, useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card, SectionTitle, PrimaryBtn, styles } from './shared';
import type { TabPropsWithRefresh } from './shared';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

const SERVICE_PRICE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'general_wish', label: 'General Wish' },
  { key: 'text_message', label: 'Text Message' },
  { key: 'image_promotion', label: 'Image Promotion' },
  { key: 'video_promotion', label: 'Video Promotion' },
  { key: 'ugc_ad', label: 'UGC Ad' },
  { key: 'voice_call', label: 'Voice Call' },
];

interface ProfileInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export function ProfileTab({ celebrity, colors, session, onRefresh }: TabPropsWithRefresh) {
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const sp = celebrity.service_prices ?? {};
    const result: Record<string, string> = {};
    SERVICE_PRICE_FIELDS.forEach(f => { result[f.key] = String(sp[f.key] ?? ''); });
    return result;
  });
  const [saving, setSaving] = useState(false);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    if (!celebrity.profile_id || !session?.access_token) return;
    supabaseFetch(
      `/rest/v1/profiles?id=eq.${celebrity.profile_id}&select=first_name,last_name,email,phone&limit=1`,
      {},
      session.access_token,
    ).then(async res => {
      if (res.ok) {
        const rows = await res.json() as ProfileInfo[];
        if (rows?.[0]) setProfileInfo(rows[0]);
      }
    }).catch(() => {});
  }, [celebrity.profile_id, session?.access_token]);

  const savePrices = async () => {
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setSaving(true);
    try {
      const service_prices: Record<string, number> = {};
      SERVICE_PRICE_FIELDS.forEach(f => { service_prices[f.key] = parseFloat(prices[f.key] || '0') || 0; });
      const res = await supabaseFetch(
        `/rest/v1/celebrities?id=eq.${celebrity.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ service_prices }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to save prices (${res.status})`);
      } else {
        Alert.alert('Prices updated!');
        onRefresh();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save prices');
    }
    setSaving(false);
  };

  const social = celebrity.social_media ?? {};

  const profileFields: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'Name', value: celebrity.name },
    { label: 'Category', value: celebrity.category },
    { label: 'Bio', value: celebrity.bio },
    { label: 'Date of Birth', value: celebrity.date_of_birth },
    { label: 'Anniversary', value: celebrity.anniversary },
    { label: 'Status', value: celebrity.status },
    { label: 'Commission', value: celebrity.commission_percentage != null ? `${celebrity.commission_percentage}%` : null },
    { label: 'Delivery Time', value: celebrity.delivery_time != null ? `${celebrity.delivery_time} days` : null },
    { label: 'Rating', value: celebrity.rating != null ? `${(celebrity.rating).toFixed(1)} ★` : null },
    { label: 'Reviews', value: celebrity.review_count != null ? String(celebrity.review_count) : null },
    { label: 'Consent Status', value: celebrity.consent_status },
    { label: 'Instagram', value: social['instagram'] },
    { label: 'YouTube', value: social['youtube'] },
    { label: 'Twitter', value: social['twitter'] },
    { label: 'TikTok', value: social['tiktok'] },
    { label: 'Facebook', value: social['facebook'] },
    { label: 'LinkedIn', value: social['linkedin'] },
    { label: 'Website', value: social['website'] },
    { label: 'Other', value: social['other'] },
  ];

  return (
    <View style={styles.tabPad}>
      {profileInfo && (
        <>
          <SectionTitle text="Personal Info" colors={colors} />
          <Card colors={colors}>
            {[
              { label: 'First Name', value: profileInfo.first_name },
              { label: 'Last Name', value: profileInfo.last_name },
              { label: 'Email', value: profileInfo.email },
              { label: 'Phone', value: profileInfo.phone },
            ].map(f => f.value ? (
              <View key={f.label} style={[styles.profileRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                <Text style={[styles.profileValue, { color: colors.foreground }]} numberOfLines={1}>{f.value}</Text>
              </View>
            ) : null)}
          </Card>
        </>
      )}

      <SectionTitle text="Profile Details" colors={colors} />
      <Card colors={colors}>
        {profileFields.map(f => f.value ? (
          <View key={f.label} style={[styles.profileRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
            <Text style={[styles.profileValue, { color: colors.foreground }]} numberOfLines={3}>{f.value}</Text>
          </View>
        ) : null)}
      </Card>

      <SectionTitle text="Service Pricing" colors={colors} />
      <Card colors={colors}>
        {SERVICE_PRICE_FIELDS.map(f => (
          <View key={f.key} style={{ marginBottom: 12 }}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
            <View style={[styles.priceInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.rupeePrefix, { color: colors.foreground }]}>₹</Text>
              <TextInput
                value={prices[f.key]}
                onChangeText={v => setPrices(p => ({ ...p, [f.key]: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 15, paddingVertical: 10 }}
              />
            </View>
          </View>
        ))}
        <PrimaryBtn label="Save Pricing" onPress={savePrices} loading={saving} colors={colors} />
      </Card>
    </View>
  );
}
