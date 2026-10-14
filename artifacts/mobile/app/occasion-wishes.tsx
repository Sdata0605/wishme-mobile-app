import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

const B2_PREFIX = 'https://f005.backblazeb2.com/file/wishmetoday/';

interface Celebrity {
  id: string;
  name: string;
  image_url: string | null;
  category: string;
}

interface CelebOccasion {
  id: string;
  celebrity_id: string;
  occasion_name: string;
  occasion_type: 'birthday' | 'anniversary' | 'other';
  occasion_date: string;
  is_public: boolean;
  auto_reply_enabled: boolean;
  celebrities: Celebrity;
}

interface Wish {
  id: string;
  user_id: string;
  celebrity_id: string;
  occasion_id: string;
  message: string;
  reply_message: string | null;
  reply_sent_at: string | null;
  created_at: string;
  celebrity_occasions: CelebOccasion & { celebrities: Celebrity };
}

function formatOccasionDate(date: string): string {
  try {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return date;
  }
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilBadge(days: number): { label: string; color: string } {
  if (days <= 0) return { label: 'Today!', color: '#EF4444' };
  if (days <= 7) return { label: `${days}d away`, color: '#EF4444' };
  if (days <= 30) return { label: `${days}d away`, color: '#F97316' };
  return { label: `${days}d away`, color: '#6B7280' };
}

function occasionIcon(type: string): IconName {
  if (type === 'birthday') return 'gift';
  if (type === 'anniversary') return 'heart';
  return 'star';
}

function imageUri(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${B2_PREFIX}${url}`;
}

function formatReplyDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

type ColorsType = ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'];

interface WishCardProps {
  wish: Wish;
  colors: ColorsType;
}

function WishCard({ wish, colors }: WishCardProps) {
  const [expanded, setExpanded] = useState(false);
  const occ = wish.celebrity_occasions;
  const celeb = occ?.celebrities;
  const uri = celeb ? imageUri(celeb.image_url) : null;
  const hasReply = !!wish.reply_message;

  return (
    <View style={[s.wishCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.wishCardTop}>
        {uri ? (
          <Image source={{ uri }} style={s.wishAvatar} />
        ) : (
          <View style={[s.wishAvatarPlaceholder, { backgroundColor: colors.border }]}>
            <Icon name="user" size={18} color={colors.mutedForeground} />
          </View>
        )}
        <View style={s.wishCardMeta}>
          <Text style={[s.wishCelebName, { color: colors.foreground }]} numberOfLines={1}>
            {celeb?.name ?? 'Celebrity'}
          </Text>
          <View style={s.wishOccRow}>
            <Icon
              name={occasionIcon(occ?.occasion_type ?? 'other')}
              size={12}
              color={colors.mutedForeground}
            />
            <Text style={[s.wishOccName, { color: colors.mutedForeground }]} numberOfLines={1}>
              {' '}{occ?.occasion_name ?? ''}
            </Text>
          </View>
        </View>
        <View
          style={[
            s.statusBadge,
            { backgroundColor: hasReply ? '#22C55E18' : `${colors.mutedForeground}18` },
          ]}
        >
          <Text style={[s.statusBadgeText, { color: hasReply ? '#22C55E' : colors.mutedForeground }]}>
            {hasReply ? 'Replied' : 'Sent'}
          </Text>
        </View>
      </View>

      <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8}>
        <Text
          style={[s.wishMsg, { color: colors.foreground }]}
          numberOfLines={expanded ? undefined : 3}
        >
          {wish.message}
        </Text>
        {!expanded && wish.message.length > 120 && (
          <Text style={[s.expandHint, { color: colors.primary }]}>Show more</Text>
        )}
      </TouchableOpacity>

      {hasReply && (
        <View style={s.replyBlock}>
          <View style={s.replyHeader}>
            <Text style={s.replyHeaderIcon}>✨</Text>
            <Text style={[s.replyHeaderName, { color: '#1F7BFF' }]}>
              {celeb?.name ?? 'Celebrity'}
            </Text>
            {wish.reply_sent_at && (
              <Text style={s.replyHeaderDate}>
                {' '}· {formatReplyDate(wish.reply_sent_at)}
              </Text>
            )}
          </View>
          <Text style={s.replyText}>{wish.reply_message}</Text>
        </View>
      )}
    </View>
  );
}

export default function OccasionWishesScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 24;

  const [activeTab, setActiveTab] = useState<'send' | 'wishes'>('send');

  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [occasions, setOccasions] = useState<CelebOccasion[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);

  const [selectedCelebId, setSelectedCelebId] = useState<string | null>(null);
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const fetchData = useCallback(async () => {
    if (!profileId || !accessToken) return;

    try {
      const favRes = await supabaseFetch(
        `/rest/v1/celebrity_favorites?select=celebrity_id&user_id=eq.${profileId}&status=eq.active`,
        {},
        accessToken,
      );

      if (!favRes.ok) return;
      const favRows = (await favRes.json()) as { celebrity_id: string }[];
      const celebIds = favRows.map((r) => r.celebrity_id);

      if (celebIds.length === 0) {
        setCelebrities([]);
        setOccasions([]);
        return;
      }

      const idList = celebIds.join(',');
      const today = new Date().toISOString().slice(0, 10);

      const [celebRes, occasionsRes, wishesRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/celebrities?select=id,name,image_url,category&id=in.(${idList})&is_active=eq.true`,
          {},
          accessToken,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_occasions?select=*,celebrities:celebrity_id(id,name,image_url,category)&celebrity_id=in.(${idList})&is_public=eq.true&occasion_date=gte.${today}&order=occasion_date.asc`,
          {},
          accessToken,
        ),
        supabaseFetch(
          `/rest/v1/occasion_wishes?select=*,celebrity_occasions!inner(*,celebrities:celebrity_id(id,name,image_url,category))&user_id=eq.${profileId}&order=created_at.desc&limit=20`,
          {},
          accessToken,
        ),
      ]);

      if (celebRes.ok) {
        const rows = (await celebRes.json()) as Celebrity[];
        setCelebrities(rows ?? []);
      }
      if (occasionsRes.ok) {
        const rows = (await occasionsRes.json()) as CelebOccasion[];
        setOccasions(rows ?? []);
      }
      if (wishesRes.ok) {
        const rows = (await wishesRes.json()) as Wish[];
        setWishes(rows ?? []);
      }
    } catch {
    }
  }, [profileId, accessToken]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchData().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const selectedCeleb = celebrities.find((c) => c.id === selectedCelebId) ?? null;
  const selectedOccasion = occasions.find((o) => o.id === selectedOccasionId) ?? null;
  const celebOccasions = occasions.filter((o) => o.celebrity_id === selectedCelebId);

  const canSend =
    !!selectedCelebId &&
    !!selectedOccasionId &&
    message.trim().length >= 10 &&
    message.trim().length <= 500;

  async function handleSend() {
    if (!canSend || !profileId || !accessToken) return;
    setSendLoading(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/occasion_wishes',
        {
          method: 'POST',
          body: JSON.stringify({
            user_id: profileId,
            celebrity_id: selectedCelebId,
            occasion_id: selectedOccasionId,
            message: message.trim(),
          }),
          headers: { Prefer: 'return=representation' },
        },
        accessToken,
      );

      if (!res.ok) {
        showToast('Failed to send wish. Please try again.');
        return;
      }

      const inserted = (await res.json()) as Wish[];
      const wish = inserted?.[0];

      if (wish && selectedOccasion?.auto_reply_enabled) {
        supabaseFetch(
          '/functions/v1/generate-occasion-auto-reply',
          {
            method: 'POST',
            body: JSON.stringify({
              wish_id: wish.id,
              celebrity_id: selectedCelebId,
              occasion_name: selectedOccasion.occasion_name,
              user_message: message.trim(),
            }),
          },
          accessToken,
        ).catch(() => {});
        showToast('Wish sent! Reply expected shortly.');
      } else {
        showToast('Wish sent successfully!');
      }

      setSelectedCelebId(null);
      setSelectedOccasionId(null);
      setMessage('');
      setActiveTab('wishes');
      await fetchData();
    } catch {
      showToast('Failed to send wish. Please try again.');
    } finally {
      setSendLoading(false);
    }
  }

  if (!user) {
    return (
      <AmbientBackground><View style={[s.screen, { backgroundColor: 'transparent' }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasion Wishes</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateWrap}>
          <Icon name="lock" size={52} color={colors.mutedForeground} />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>Sign in to use this feature</Text>
          <Text style={[s.gateSub, { color: colors.mutedForeground }]}>
            Log in to send wishes to your favourite celebrities
          </Text>
          <TouchableOpacity
            style={[s.gateBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)')}
          >
            <Text style={s.gateBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  if (loading) {
    return (
      <AmbientBackground><View style={[s.screen, { backgroundColor: 'transparent' }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasion Wishes</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View></AmbientBackground>
    );
  }

  if (celebrities.length === 0) {
    return (
      <AmbientBackground><View style={[s.screen, { backgroundColor: 'transparent' }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasion Wishes</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateWrap}>
          <Icon name="heart" size={52} color={colors.mutedForeground} />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>No Favorites Yet</Text>
          <Text style={[s.gateSub, { color: colors.mutedForeground }]}>
            Subscribe to celebrities to send them occasion wishes
          </Text>
          <TouchableOpacity
            style={[s.gateBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/favorites')}
          >
            <Text style={s.gateBtnText}>Browse Celebrities</Text>
          </TouchableOpacity>
        </View>
      </View></AmbientBackground>
    );
  }

  return (
    <AmbientBackground><View style={[s.screen, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Occasion Wishes</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {(['send', 'wishes'] as const).map((tab) => {
          const label = tab === 'send' ? 'Send Wish' : 'My Wishes';
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'send' ? (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#7B5CFA" />
          }
        >
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Select Celebrity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {celebrities.map((celeb) => {
              const selected = celeb.id === selectedCelebId;
              const uri = imageUri(celeb.image_url);
              return (
                <TouchableOpacity
                  key={celeb.id}
                  style={[
                    s.chip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}18` : colors.card,
                    },
                  ]}
                  onPress={() => {
                    setSelectedCelebId(selected ? null : celeb.id);
                    setSelectedOccasionId(null);
                  }}
                  activeOpacity={0.8}
                >
                  {uri ? (
                    <Image source={{ uri }} style={s.chipAvatar} />
                  ) : (
                    <View style={[s.chipAvatarPlaceholder, { backgroundColor: colors.border }]}>
                      <Icon name="user" size={18} color={colors.mutedForeground} />
                    </View>
                  )}
                  <Text
                    style={[s.chipName, { color: selected ? colors.primary : colors.foreground }]}
                    numberOfLines={1}
                  >
                    {celeb.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedCelebId && (
            <>
              <Text style={[s.sectionLabel, { color: colors.foreground }]}>Select Occasion</Text>
              {celebOccasions.length === 0 ? (
                <View style={[s.noOccasionWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="calendar" size={28} color={colors.mutedForeground} />
                  <Text style={[s.noOccasionText, { color: colors.mutedForeground }]}>
                    No upcoming occasions for {selectedCeleb?.name}
                  </Text>
                </View>
              ) : (
                celebOccasions.map((occ) => {
                  const selected = occ.id === selectedOccasionId;
                  const days = daysUntil(occ.occasion_date);
                  const badge = daysUntilBadge(days);
                  return (
                    <TouchableOpacity
                      key={occ.id}
                      style={[
                        s.occasionCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedOccasionId(selected ? null : occ.id)}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          s.occasionIconWrap,
                          { backgroundColor: selected ? `${colors.primary}20` : colors.background },
                        ]}
                      >
                        <Icon
                          name={occasionIcon(occ.occasion_type)}
                          size={20}
                          color={selected ? colors.primary : colors.mutedForeground}
                        />
                      </View>
                      <View style={s.occasionInfo}>
                        <Text style={[s.occasionName, { color: colors.foreground }]} numberOfLines={1}>
                          {occ.occasion_name}
                        </Text>
                        <Text style={[s.occasionDate, { color: colors.mutedForeground }]}>
                          {formatOccasionDate(occ.occasion_date)}
                        </Text>
                      </View>
                      <View style={[s.daysBadge, { backgroundColor: `${badge.color}18` }]}>
                        <Text style={[s.daysBadgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                      {selected && (
                        <View style={{ marginLeft: 6 }}>
                          <Icon name="check-circle" size={18} color={colors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          {selectedOccasion?.auto_reply_enabled && (
            <View style={s.autoReplyBanner}>
              <Text style={s.autoReplyText}>
                ✨ This celebrity will auto-reply to your wish with a personalised message in their voice!
              </Text>
            </View>
          )}

          {selectedCelebId && (
            <>
              <Text style={[s.sectionLabel, { color: colors.foreground }]}>Your Message</Text>
              <View
                style={[s.textAreaWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <TextInput
                  style={[s.textArea, { color: colors.foreground }]}
                  placeholder="Write your wish message here..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={5}
                  maxLength={500}
                  value={message}
                  onChangeText={setMessage}
                  textAlignVertical="top"
                />
                <Text style={[s.charCounter, { color: message.length > 480 ? '#EF4444' : colors.mutedForeground }]}>
                  {message.length} / 500
                </Text>
              </View>

              <TouchableOpacity
                style={[s.sendBtnWrap, { opacity: canSend && !sendLoading ? 1 : 0.5 }]}
                onPress={handleSend}
                disabled={!canSend || sendLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#7B5CFA', '#1F7BFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.sendBtnGrad}
                >
                  {sendLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.sendBtnText}>Send Wish</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#7B5CFA" />
          }
        >
          {wishes.length === 0 ? (
            <View style={s.gateWrap}>
              <Icon name="sparkles" size={48} color={colors.mutedForeground} />
              <Text style={[s.gateTitle, { color: colors.foreground }]}>No wishes sent yet</Text>
              <Text style={[s.gateSub, { color: colors.mutedForeground }]}>
                Send your first wish from the Send Wish tab
              </Text>
            </View>
          ) : (
            wishes.map((wish) => (
              <WishCard key={wish.id} wish={wish} colors={colors} />
            ))
          )}
        </ScrollView>
      )}

      {toast && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scrollContent: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 4, marginTop: 4 },

  chipRow: { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  chip: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
    minWidth: 72,
    maxWidth: 96,
  },
  chipAvatar: { width: 48, height: 48, borderRadius: 24 },
  chipAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipName: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center', maxWidth: 76 },

  occasionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  occasionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  occasionInfo: { flex: 1, gap: 2 },
  occasionName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  occasionDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  daysBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  daysBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  noOccasionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  noOccasionText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },

  autoReplyBanner: {
    backgroundColor: '#6366F118',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366F140',
    padding: 12,
  },
  autoReplyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#818CF8', lineHeight: 20 },

  textAreaWrap: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  textArea: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 110,
    lineHeight: 22,
  },
  charCounter: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'right' },

  sendBtnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  sendBtnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  gateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  gateTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  gateSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  gateBtn: { marginTop: 8, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 },
  gateBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  wishCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  wishCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wishAvatar: { width: 44, height: 44, borderRadius: 22 },
  wishAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishCardMeta: { flex: 1, gap: 3 },
  wishCelebName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  wishOccRow: { flexDirection: 'row', alignItems: 'center' },
  wishOccName: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  wishMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  expandHint: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },

  replyBlock: {
    backgroundColor: '#1F7BFF12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F7BFF30',
    padding: 12,
    gap: 6,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyHeaderIcon: { fontSize: 14 },
  replyHeaderName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  replyHeaderDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#9CA3AF' },
  replyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#C4B5FD', lineHeight: 20 },

  toast: {
    position: 'absolute',
    bottom: 90,
    left: 24,
    right: 24,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
