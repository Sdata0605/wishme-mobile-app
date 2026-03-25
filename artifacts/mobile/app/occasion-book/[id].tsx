import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabaseFetch, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';

function imgUri(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return B2_BASE + url;
}

function daysUntil(date: string): number {
  const target = new Date(date + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
}

const GRADIENT_PAIRS: [string, string][] = [
  ['#FF6B33', '#E8527A'],
  ['#E8527A', '#B44CFF'],
  ['#B44CFF', '#7B2FFF'],
  ['#4B83FF', '#7B2FFF'],
  ['#FF6B33', '#B44CFF'],
  ['#7B2FFF', '#4B83FF'],
];

function gradientForName(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length];
}

interface Occasion {
  id: string;
  name: string;
  description: string;
  date: string;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
}

interface Celebrity {
  id: string;
  name: string;
  image_url: string | null;
  category: string;
  service_prices: Record<string, number> | null;
}

type BookingType = 'video' | 'greeting_card';

export default function OccasionBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [loading, setLoading] = useState(true);

  const [bookingType, setBookingType] = useState<BookingType>('video');
  const [selectedCeleb, setSelectedCeleb] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [occasionRes, favRes] = await Promise.all([
        supabaseFetch(`/rest/v1/occasions?id=eq.${id}&limit=1`, {}, session?.access_token ?? null),
        session?.access_token && user?.profileId
          ? supabaseFetch(
              `/rest/v1/celebrity_favorites?user_id=eq.${user.profileId}&status=eq.active&select=celebrity_id`,
              {},
              session.access_token,
            )
          : Promise.resolve(null),
      ]);

      if (occasionRes.ok) {
        const rows = await occasionRes.json() as Occasion[];
        if (rows?.length) setOccasion(rows[0]);
      }

      if (favRes && favRes.ok) {
        const favRows = await favRes.json() as { celebrity_id: string }[];
        const ids = (favRows ?? []).map(r => r.celebrity_id).filter(Boolean);
        if (ids.length > 0) {
          const celebRes = await supabaseFetch(
            `/rest/v1/celebrities?is_active=eq.true&is_verified=eq.true&id=in.(${ids.join(',')})&select=id,name,image_url,category,service_prices`,
            {},
            session?.access_token ?? null,
          );
          if (celebRes.ok) {
            const celebRows = await celebRes.json() as Celebrity[];
            setCelebrities(celebRows ?? []);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, session?.access_token, user?.profileId]);

  useEffect(() => {
    if (user && session) loadData();
    else setLoading(false);
  }, [user, session, loadData]);

  const handleSubmit = async () => {
    if (!selectedCeleb || !recipientName.trim() || !message.trim()) return;
    if (!user || !session) return;

    setSubmitting(true);
    try {
      const body = {
        user_id: user.profileId,
        occasion_id: id,
        celebrity_id: selectedCeleb,
        booking_type: bookingType,
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        message: message.trim(),
        price: 0,
        status: 'pending',
      };

      const res = await supabaseFetch(
        '/rest/v1/occasion_bookings',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(body),
        },
        session.access_token,
      );

      if (!res.ok) {
        const errText = await res.text();
        showToast('Booking failed. Please try again.');
        console.warn('Booking error:', errText);
        return;
      }

      const rows = await res.json() as { id: string }[];
      const bookingId = rows?.[0]?.id;

      if (bookingId) {
        const edgeFn = bookingType === 'video'
          ? 'generate-occasion-video'
          : 'generate-greeting-card';
        const edgeBody = {
          bookingId,
          occasionName: occasion?.name ?? '',
          recipientName: recipientName.trim(),
          message: message.trim(),
          celebrityId: selectedCeleb,
        };
        fetch(`${SUPABASE_URL}/functions/v1/${edgeFn}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(edgeBody),
        }).catch(() => {});
      }

      const typeLabel = bookingType === 'video' ? 'video' : 'greeting card';
      showToast(`Booking created! Your ${typeLabel} is being generated.`);
      setTimeout(() => router.back(), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!selectedCeleb && !!recipientName.trim() && !!message.trim() && !submitting;

  if (!user || !session) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Book Occasion</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateContainer}>
          <Icon name="lock" size={52} color={colors.mutedForeground} />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>Sign in to book</Text>
          <Text style={[s.gateSubtitle, { color: colors.mutedForeground }]}>You need to be signed in to create an occasion booking.</Text>
          <TouchableOpacity
            style={[s.gateBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)' as never)}
          >
            <Text style={s.gateBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Book Occasion</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (celebrities.length === 0) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Book Occasion</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateContainer}>
          <Icon name="lock" size={52} color={colors.mutedForeground} />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>No Celebrity Subscriptions</Text>
          <Text style={[s.gateSubtitle, { color: colors.mutedForeground }]}>You need to follow at least one celebrity to make a booking.</Text>
          <TouchableOpacity
            style={[s.gateBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/favorites' as never)}
          >
            <Text style={s.gateBtnText}>Browse &amp; Subscribe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const occUri = imgUri(occasion?.image_url ?? null);
  const occGrad = gradientForName(occasion?.name ?? 'Occasion');
  const celebPairs: (Celebrity | null)[][] = [];
  for (let i = 0; i < celebrities.length; i += 2) {
    celebPairs.push([celebrities[i] ?? null, celebrities[i + 1] ?? null]);
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Book Occasion</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Occasion Header */}
        <View style={s.occHeader}>
          {occUri ? (
            <Image source={{ uri: occUri }} style={s.occBanner} contentFit="cover" />
          ) : (
            <LinearGradient colors={occGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.occBanner} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={s.occOverlay}
          >
            <Text style={s.occName}>{occasion?.name ?? ''}</Text>
          </LinearGradient>
        </View>
        <View style={[s.occMeta, { borderBottomColor: colors.border }]}>
          <Text style={[s.occMetaName, { color: colors.foreground }]}>{occasion?.name}</Text>
          <Text style={[s.occMetaDesc, { color: colors.mutedForeground }]}>{occasion?.description}</Text>
          {occasion?.date && (
            <View style={s.dateRow}>
              <Icon name="calendar" size={13} color={colors.mutedForeground} />
              <Text style={[s.dateText, { color: colors.mutedForeground }]}>{fmtDate(occasion.date)}</Text>
              <Text style={[s.dateText, { color: colors.primary }]}>  · {daysUntil(occasion.date)} days away</Text>
            </View>
          )}
        </View>

        {/* Booking Type */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Booking Type</Text>
          <View style={s.typeRow}>
            <TouchableOpacity
              style={[
                s.typeCard,
                { backgroundColor: colors.card, borderColor: bookingType === 'video' ? colors.primary : colors.border },
                bookingType === 'video' && { backgroundColor: colors.primary + '15' },
              ]}
              onPress={() => setBookingType('video')}
              activeOpacity={0.8}
            >
              <Icon name="video" size={24} color={bookingType === 'video' ? colors.primary : colors.mutedForeground} />
              <Text style={[s.typeLabel, { color: bookingType === 'video' ? colors.primary : colors.foreground }]}>AI Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.typeCard,
                { backgroundColor: colors.card, borderColor: bookingType === 'greeting_card' ? colors.primary : colors.border },
                bookingType === 'greeting_card' && { backgroundColor: colors.primary + '15' },
              ]}
              onPress={() => setBookingType('greeting_card')}
              activeOpacity={0.8}
            >
              <Icon name="image" size={24} color={bookingType === 'greeting_card' ? colors.primary : colors.mutedForeground} />
              <Text style={[s.typeLabel, { color: bookingType === 'greeting_card' ? colors.primary : colors.foreground }]}>Greeting Card</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Celebrity Selection */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Select Celebrity</Text>
          <View style={s.celebGrid}>
            {celebPairs.map((pair, ri) => (
              <View key={ri} style={s.celebRow}>
                {pair.map((celeb, ci) => {
                  if (!celeb) return <View key={ci} style={{ flex: 1 }} />;
                  const uri = imgUri(celeb.image_url);
                  const isSelected = selectedCeleb === celeb.id;
                  return (
                    <TouchableOpacity
                      key={celeb.id}
                      style={[
                        s.celebCard,
                        { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border },
                        isSelected && { borderWidth: 2 },
                      ]}
                      onPress={() => setSelectedCeleb(celeb.id)}
                      activeOpacity={0.8}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={s.celebAvatar} contentFit="cover" />
                      ) : (
                        <LinearGradient
                          colors={gradientForName(celeb.name)}
                          style={s.celebAvatar}
                        >
                          <Text style={s.celebInitial}>{celeb.name.charAt(0).toUpperCase()}</Text>
                        </LinearGradient>
                      )}
                      <Text style={[s.celebName, { color: colors.foreground }]} numberOfLines={1}>{celeb.name}</Text>
                      <Text style={[s.celebCategory, { color: colors.mutedForeground }]} numberOfLines={1}>{celeb.category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Recipient Details */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Recipient Details</Text>
          <View style={s.formGroup}>
            <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Recipient Name *</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Enter recipient's name"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
            />
          </View>
          <View style={s.formGroup}>
            <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Recipient Email</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              placeholder="Enter recipient's email (optional)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>
          <View style={s.formGroup}>
            <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Recipient Phone</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="Enter recipient's phone (optional)"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>
          <View style={s.formGroup}>
            <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Message *</Text>
            <TextInput
              style={[s.input, s.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={message}
              onChangeText={setMessage}
              placeholder="Write a personalized message for the occasion..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Submit */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canSubmit ? ['#FF6B33', '#B44CFF'] : ['#aaa', '#888']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.submitBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitText}>Create Booking</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!!toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  gateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  gateTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  gateSubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  gateBtn: { borderRadius: 9999, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  gateBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  occHeader: { height: 200, position: 'relative' },
  occBanner: { width: '100%', height: 200 },
  occOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  occName: { color: '#fff', fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold' },
  occMeta: { padding: 16, gap: 6, borderBottomWidth: 1, paddingBottom: 20 },
  occMetaName: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  occMetaDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  dateText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  section: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  celebGrid: { gap: 10 },
  celebRow: { flexDirection: 'row', gap: 10 },
  celebCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  celebAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  celebInitial: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
  celebName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  celebCategory: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  formGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  textArea: { minHeight: 100, paddingTop: 12 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
