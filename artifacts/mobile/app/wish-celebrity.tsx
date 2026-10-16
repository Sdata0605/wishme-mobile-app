import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
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
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { supabaseFetch } from '@/constants/supabase';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { SubscribedCelebrityChips } from '@/components/celebrity/SubscribedCelebrityChips';

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';
function imgUrl(url: string | null): string {
  if (!url) return '';
  return url.startsWith('http') ? url : B2_BASE + url;
}

interface Celebrity {
  id: string;
  name: string;
  image_url: string | null;
  category: string;
  rating: number;
  is_verified: boolean;
  service_prices?: { general_wish?: number };
}

export default function WishCelebrityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const agentPrefill = useAgentPrefill();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [allCelebrities, setAllCelebrities] = useState<Celebrity[]>([]);
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  // Auto-fill search from agent prefill
  useEffect(() => {
    if (agentPrefill.search) {
      setSearch(agentPrefill.search);
    }
  }, [agentPrefill.search]);

  const fetchAll = useCallback(async () => {
    if (!session?.access_token || !user?.profileId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const [celebRes, favsRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/celebrities?select=id,name,image_url,category,rating,is_verified,service_prices&is_active=eq.true&order=name.asc`,
          {},
          session.access_token,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_favorites?select=celebrity_id&user_id=eq.${user.profileId}&status=eq.active`,
          {},
          session.access_token,
        ),
      ]);

      if (!celebRes.ok) { setFetchError(true); setLoading(false); return; }

      const celebRows = await celebRes.json() as Celebrity[];
      setAllCelebrities(celebRows);

      if (favsRes.ok) {
        const favRows = await favsRes.json() as Array<{ celebrity_id: string }>;
        setSubscribedIds(new Set(favRows.map(r => r.celebrity_id)));
      }
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [session, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isSubscribed = (celebId: string) => subscribedIds.has(celebId);

  const filtered = allCelebrities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Only celebrities the user has subscribed to can be wished.
  const subscribedList = allCelebrities.filter(c => isSubscribed(c.id));
  const selected = subscribedList.find(c => c.id === selectedId) ?? null;

  // The assistant can name a celebrity ("wish Hari"): pick them if they are one of the user's.
  useEffect(() => {
    if (!search.trim() || selectedId) return;
    const match = subscribedList.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (match.length === 1) setSelectedId(match[0].id);
  }, [search, subscribedList, selectedId]);

  if (!session) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Celebrity</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.centerState}>
          <Icon name="user" size={48} color={colors.mutedForeground} />
          <Text style={[s.stateTitle, { color: colors.foreground }]}>Please sign in</Text>
          <Text style={[s.stateBody, { color: colors.mutedForeground }]}>You need to be logged in to wish celebrities.</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)' as never)}>
            <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Login</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Celebrity</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={[s.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.skeletonAvatar, { backgroundColor: colors.muted }]} />
              <View style={s.skeletonBody}>
                <View style={[s.skeletonLine, { backgroundColor: colors.muted, width: '55%' }]} />
                <View style={[s.skeletonLine, { backgroundColor: colors.muted, width: '35%', height: 10, marginTop: 6 }]} />
              </View>
              <View style={[s.skeletonBtn, { backgroundColor: colors.muted }]} />
            </View>
          ))}
        </ScrollView>
      ) : fetchError ? (
        <View style={s.centerState}>
          <Icon name="alert-circle" size={48} color={colors.mutedForeground} />
          <Text style={[s.stateTitle, { color: colors.foreground }]}>Something went wrong</Text>
          <Text style={[s.stateBody, { color: colors.mutedForeground }]}>Could not load celebrities. Please try again.</Text>
          <TouchableOpacity onPress={fetchAll}>
            <LinearGradient colors={['#7B5CFA', '#1F7BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : allCelebrities.length === 0 ? (
        <View style={s.centerState}>
          <Icon name="star" size={48} color={colors.mutedForeground} />
          <Text style={[s.stateTitle, { color: colors.foreground }]}>No Celebrities Found</Text>
          <Text style={[s.stateBody, { color: colors.mutedForeground }]}>No active celebrities are available right now.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.sectionHeading, { color: colors.foreground }]}>Select Celebrity</Text>
          <View style={{ paddingHorizontal: 16 }}>
            <SubscribedCelebrityChips
              celebrities={subscribedList}
              loading={false}
              hasNone={subscribedList.length === 0}
              selectedId={selectedId}
              onSelect={c => setSelectedId(c?.id ?? '')}
              priceFor={c => c.service_prices?.general_wish ?? null}
              emptyText="Subscribe to a celebrity to send them a wish."
            />
          </View>

          {selected ? (
            <View style={{ marginTop: 16 }}>
              <CelebrityCard
                celeb={selected}
                subscribed
                colors={colors}
                onPress={() => router.push(('/wish-booking/' + selected.id) as never)}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View></AmbientBackground>
  );
}

interface CardColors {
  background: string;
  foreground: string;
  card: string;
  border: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  input: string;
}

function CelebrityCard({
  celeb,
  subscribed,
  colors,
  onPress,
}: {
  celeb: Celebrity;
  subscribed: boolean;
  colors: CardColors;
  onPress: () => void;
}) {
  const price = (celeb.service_prices as { general_wish?: number } | undefined)?.general_wish ?? 0;
  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.cardLeft}>
        {celeb.image_url ? (
          <Image source={{ uri: imgUrl(celeb.image_url) }} style={s.avatar} contentFit="cover" />
        ) : (
          <View style={[s.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="user" size={22} color={colors.mutedForeground} />
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={[s.celebName, { color: colors.foreground }]} numberOfLines={1}>{celeb.name}</Text>
          {celeb.is_verified && <Icon name="check-circle" size={14} color="#3B5BDB" />}
        </View>
        <Text style={[s.celebCat, { color: colors.mutedForeground }]} numberOfLines={1}>{celeb.category}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Icon name="star" size={12} color="#F59E0B" />
          <Text style={[s.rating, { color: colors.mutedForeground }]}>{celeb.rating?.toFixed(1) ?? '—'}</Text>
          {price > 0 && (
            <Text style={[s.price, { color: colors.mutedForeground }]}>· ₹{price.toLocaleString('en-IN')}</Text>
          )}
        </View>
      </View>

      <View style={s.cardRight}>
        {subscribed ? (
          <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            <LinearGradient
              colors={['#7B5CFA', '#1F7BFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.wishNowBtn}
            >
              <Text style={s.wishNowText}>Wish Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onPress}
            style={[s.subscribeBtn, { borderColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[s.subscribeBtnText, { color: colors.primary }]}>Subscribe to Wish</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  stateTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  stateBody: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 9999 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sectionHeading: { fontSize: 15, fontFamily: 'Inter_700Bold', paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 10 },
  cardLeft: {},
  cardBody: { flex: 1, gap: 2 },
  cardRight: { alignItems: 'flex-end' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  celebName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  celebCat: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rating: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  price: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  wishNowBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  wishNowText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  subscribeBtn: { borderWidth: 1.5, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 6 },
  subscribeBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  skeletonAvatar: { width: 52, height: 52, borderRadius: 26 },
  skeletonBody: { flex: 1 },
  skeletonLine: { height: 14, borderRadius: 6 },
  skeletonBtn: { width: 80, height: 32, borderRadius: 9999 },
});
