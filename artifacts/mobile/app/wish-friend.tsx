import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import type { IconName } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';

function imgUri(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : B2_BASE + url;
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(date: string): number {
  const target = new Date(date + 'T00:00:00').getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target - now.getTime()) / (1000 * 60 * 60 * 24));
}

function occasionIcon(type: string): IconName {
  if (type === 'birthday') return 'gift';
  if (type === 'anniversary') return 'heart';
  return 'star';
}

function occasionGradient(type: string): [string, string] {
  if (type === 'birthday') return ['#FF6B33', '#E8527A'];
  if (type === 'anniversary') return ['#E8527A', '#B44CFF'];
  return ['#B44CFF', '#7B2FFF'];
}

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

export default function WishFriendScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasSubscriptions, setHasSubscriptions] = useState(true);

  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [occasions, setOccasions] = useState<CelebOccasion[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);

  const [selectedCeleb, setSelectedCeleb] = useState<Celebrity | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<CelebOccasion | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(''), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!profileId || !accessToken) return;

    try {
      // Step 1: Get subscribed celebrity IDs
      const favRes = await supabaseFetch(
        `/rest/v1/celebrity_favorites?select=celebrity_id&user_id=eq.${profileId}&status=eq.active`,
        {},
        accessToken,
      );
      if (!favRes.ok) return;
      const favRows = await favRes.json() as Array<{ celebrity_id: string }>;

      if (!favRows || favRows.length === 0) {
        setHasSubscriptions(false);
        setCelebrities([]);
        setOccasions([]);
        return;
      }

      setHasSubscriptions(true);
      const celebIds = favRows.map(r => r.celebrity_id);
      const idsParam = `(${celebIds.join(',')})`;
      const today = new Date().toISOString().split('T')[0];

      // Steps 2, 3, 4 in parallel
      const [celebRes, occRes, wishRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/celebrities?select=id,name,image_url,category&id=in.${idsParam}&is_active=eq.true`,
          {},
          accessToken,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_occasions?select=*,celebrities:celebrity_id(id,name,image_url,category)&celebrity_id=in.${idsParam}&is_public=eq.true&occasion_date=gte.${today}&order=occasion_date.asc`,
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
        const rows = await celebRes.json() as Celebrity[];
        setCelebrities(rows ?? []);
      }
      if (occRes.ok) {
        const rows = await occRes.json() as CelebOccasion[];
        setOccasions(rows ?? []);
      }
      if (wishRes.ok) {
        const rows = await wishRes.json() as Wish[];
        setWishes(rows ?? []);
      }
    } catch {
      // fail silently — user sees empty states
    }
  }, [profileId, accessToken]);

  useEffect(() => {
    if (!user || !session) { setLoading(false); return; }
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [user, session, fetchData]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const celebOccasions = selectedCeleb
    ? occasions.filter(o => o.celebrity_id === selectedCeleb.id)
    : [];

  const canSend =
    !!selectedCeleb &&
    !!selectedOccasion &&
    message.trim().length >= 10 &&
    message.trim().length <= 500;

  const handleSelectCeleb = (celeb: Celebrity) => {
    if (selectedCeleb?.id === celeb.id) {
      setSelectedCeleb(null);
      setSelectedOccasion(null);
    } else {
      setSelectedCeleb(celeb);
      setSelectedOccasion(null);
    }
  };

  const handleSend = async () => {
    if (!canSend || !profileId || !accessToken || !selectedCeleb || !selectedOccasion) return;
    setSending(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/occasion_wishes',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' } as Record<string, string>,
          body: JSON.stringify({
            user_id: profileId,
            celebrity_id: selectedCeleb.id,
            occasion_id: selectedOccasion.id,
            message: message.trim(),
          }),
        },
        accessToken,
      );

      if (!res.ok) {
        Alert.alert('Send Failed', 'Could not send your wish. Please try again.');
        return;
      }

      const rows = await res.json() as Wish[];
      const insertedWish = rows?.[0];

      // Fire-and-forget AI auto-reply if enabled
      if (selectedOccasion.auto_reply_enabled && insertedWish?.id) {
        supabaseFetch(
          '/functions/v1/generate-occasion-auto-reply',
          {
            method: 'POST',
            body: JSON.stringify({
              wish_id: insertedWish.id,
              celebrity_id: selectedCeleb.id,
              occasion_name: selectedOccasion.occasion_name,
              user_message: message.trim(),
            }),
          },
          accessToken,
        ).catch(() => {});
      }

      // Reset form and switch to My Wishes tab
      setMessage('');
      setSelectedCeleb(null);
      setSelectedOccasion(null);
      setTab(1);
      showToast('Wish sent! 🎉');
      fetchData();
    } catch {
      Alert.alert('Send Failed', 'Could not send your wish. Please check your connection.');
    } finally {
      setSending(false);
    }
  };

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (!user || !session) {
    return (
      <View style={[s.container, s.centerWrap, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Friend</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateWrap}>
          <Icon name="heart" size={52} color={colors.mutedForeground} />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>Sign in to Send Wishes</Text>
          <Text style={[s.gateText, { color: colors.mutedForeground }]}>
            Log in to send heartfelt wishes to your favourite celebrities
          </Text>
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

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Friend</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color="#FF6B33" />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  // ── Subscription gate ────────────────────────────────────────────────────────
  if (!hasSubscriptions) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Friend</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateWrap}>
          <Icon name="heart" size={52} color={colors.mutedForeground} />
          <Text style={[s.gateTitle, { color: colors.foreground }]}>No Favourite Celebrities Yet</Text>
          <Text style={[s.gateText, { color: colors.mutedForeground }]}>
            Follow some celebrities to start sending them wishes on their special occasions
          </Text>
          <TouchableOpacity
            style={[s.gateBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/favorites' as never)}
          >
            <Icon name="heart" size={16} color="#fff" />
            <Text style={s.gateBtnText}>Browse Celebrities</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main content ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish a Friend</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tab selector */}
      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {['Send Wish', 'My Wishes'].map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[s.tabBtn, tab === i && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(i)}
          >
            <Text style={[s.tabLabel, { color: tab === i ? colors.primary : colors.mutedForeground }]}>
              {label}
            </Text>
            {i === 1 && wishes.length > 0 && (
              <View style={[s.tabBadge, { backgroundColor: colors.primary }]}>
                <Text style={s.tabBadgeText}>{wishes.length > 99 ? '99+' : wishes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab 0: Send Wish */}
      {tab === 0 && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 0 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step Progress Indicator */}
          {(() => {
            const currentStep = !selectedCeleb ? 1 : !selectedOccasion ? 2 : 3;
            const steps = [
              { num: 1, label: 'Select Celebrity' },
              { num: 2, label: 'Select Occasion' },
              { num: 3, label: 'Write Wish' },
            ];
            return (
              <View style={s.stepRow}>
                {steps.map((step, i) => {
                  const isActive = currentStep === step.num;
                  const isDone = currentStep > step.num;
                  return (
                    <React.Fragment key={step.num}>
                      <View style={[
                        s.stepChip,
                        isDone && { backgroundColor: colors.primary + '22', borderColor: colors.primary + '44' },
                        isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
                        !isActive && !isDone && { backgroundColor: colors.card, borderColor: colors.border },
                      ]}>
                        <Text style={[
                          s.stepNum,
                          isActive && { color: '#fff' },
                          isDone && { color: colors.primary },
                          !isActive && !isDone && { color: colors.mutedForeground },
                        ]}>
                          {isDone ? '✓' : step.num}
                        </Text>
                        <Text style={[
                          s.stepLabel,
                          isActive && { color: '#fff' },
                          isDone && { color: colors.primary },
                          !isActive && !isDone && { color: colors.mutedForeground },
                        ]} numberOfLines={1}>
                          {step.label}
                        </Text>
                      </View>
                      {i < steps.length - 1 && (
                        <View style={[s.stepDivider, { backgroundColor: currentStep > step.num ? colors.primary + '44' : colors.border }]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            );
          })()}

          {/* Celebrity Picker */}
          <Text style={[s.sectionLabel, { color: colors.foreground }]}>Choose a Celebrity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipScroll}>
            {celebrities.map(celeb => {
              const isSelected = selectedCeleb?.id === celeb.id;
              const uri = imgUri(celeb.image_url);
              return (
                <TouchableOpacity
                  key={celeb.id}
                  style={s.chip}
                  onPress={() => handleSelectCeleb(celeb)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    s.chipAvatarWrap,
                    { borderColor: isSelected ? colors.primary : 'transparent', borderWidth: isSelected ? 2.5 : 0 },
                  ]}>
                    {uri ? (
                      <Image source={{ uri }} style={s.chipAvatar} contentFit="cover" />
                    ) : (
                      <View style={[s.chipAvatarPlaceholder, { backgroundColor: colors.border }]}>
                        <Icon name="heart" size={18} color={colors.mutedForeground} />
                      </View>
                    )}
                  </View>
                  <Text style={[s.chipName, { color: isSelected ? colors.primary : colors.foreground }]} numberOfLines={1}>
                    {celeb.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Occasion List */}
          {selectedCeleb && (
            <View style={{ marginTop: 4 }}>
              <Text style={[s.sectionLabel, { color: colors.foreground }]}>
                Upcoming Occasions for {selectedCeleb.name}
              </Text>
              {celebOccasions.length === 0 ? (
                <View style={[s.noOccasionWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="calendar" size={28} color={colors.mutedForeground} />
                  <Text style={[s.noOccasionText, { color: colors.mutedForeground }]}>
                    No upcoming occasions right now
                  </Text>
                  <TouchableOpacity
                    style={[s.noOccasionBtn, { borderColor: colors.primary }]}
                    onPress={() => { setSelectedCeleb(null); setSelectedOccasion(null); }}
                    activeOpacity={0.8}
                  >
                    <Icon name="arrow-left" size={14} color={colors.primary} />
                    <Text style={[s.noOccasionBtnText, { color: colors.primary }]}>Choose Another Celebrity</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.occasionList}>
                  {celebOccasions.map(occ => {
                    const isSelected = selectedOccasion?.id === occ.id;
                    const days = daysUntil(occ.occasion_date);
                    const badgeColor = days <= 7 ? '#EF4444' : days <= 30 ? '#FF6B33' : colors.mutedForeground;
                    return (
                      <TouchableOpacity
                        key={occ.id}
                        style={[
                          s.occasionCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        onPress={() => setSelectedOccasion(isSelected ? null : occ)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={occasionGradient(occ.occasion_type)}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={s.occIconCircle}
                        >
                          <Icon name={occasionIcon(occ.occasion_type)} size={18} color="#fff" />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.occName, { color: colors.foreground }]} numberOfLines={1}>
                            {occ.occasion_name}
                          </Text>
                          <Text style={[s.occDate, { color: colors.mutedForeground }]}>
                            {formatDate(occ.occasion_date)}
                          </Text>
                        </View>
                        <View style={[s.daysBadge, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '40' }]}>
                          <Text style={[s.daysBadgeText, { color: badgeColor }]}>
                            {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days}d`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* AI Auto-Reply Banner */}
          {selectedOccasion?.auto_reply_enabled && (
            <LinearGradient
              colors={['#B44CFF', '#4B83FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.aiBanner}
            >
              <Icon name="zap" size={16} color="#fff" />
              <Text style={s.aiBannerText}>
                {selectedCeleb?.name ?? 'This celebrity'} will send you a personalised reply!
              </Text>
            </LinearGradient>
          )}

          {/* Message Input */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Text style={[s.sectionLabel, { color: colors.foreground, paddingHorizontal: 0, marginBottom: 8 }]}>
              Your Wish Message
            </Text>
            <TextInput
              style={[
                s.messageInput,
                { backgroundColor: colors.input ?? colors.card, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder={
                !selectedCeleb
                  ? 'Select a celebrity above to begin your wish...'
                  : !selectedOccasion
                  ? 'Select an occasion above, then write your wish...'
                  : `Write your heartfelt wish for ${selectedCeleb.name}...`
              }
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={t => setMessage(t.slice(0, 500))}
              multiline
              textAlignVertical="top"
              editable
            />
            <View style={s.charCountRow}>
              <Text style={[s.charCount, { color: message.length > 450 ? '#EF4444' : colors.mutedForeground }]}>
                {message.length} / 500
              </Text>
              {message.length > 0 && message.length < 10 && (
                <Text style={s.minCharHint}>Minimum 10 characters</Text>
              )}
            </View>
          </View>

          {/* Send Button */}
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!canSend || sending}
              activeOpacity={0.85}
              style={{ opacity: canSend && !sending ? 1 : 0.4, borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#FF6B33', '#B44CFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.sendBtn}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="send" size={18} color="#fff" />
                    <Text style={s.sendBtnText}>Send Wish</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Tab 1: My Wishes */}
      {tab === 1 && (
        <FlatList
          data={wishes}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: insets.bottom + 40, gap: 12, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Icon name="zap" size={48} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No wishes sent yet</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Send a heartfelt message to your favourite celebrities
              </Text>
              <TouchableOpacity
                style={[s.gateBtn, { backgroundColor: colors.primary }]}
                onPress={() => setTab(0)}
              >
                <Icon name="send" size={16} color="#fff" />
                <Text style={s.gateBtnText}>Send Your First Wish</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: wish }) => {
            const occ = wish.celebrity_occasions;
            const celeb = occ?.celebrities;
            const hasReply = !!wish.reply_message;
            const uri = imgUri(celeb?.image_url);
            return (
              <View style={[s.wishCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Header row */}
                <View style={s.wishCardHeader}>
                  {uri ? (
                    <Image source={{ uri }} style={s.wishAvatar} contentFit="cover" />
                  ) : (
                    <View style={[s.wishAvatarPlaceholder, { backgroundColor: colors.border }]}>
                      <Icon name="heart" size={14} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.wishCelebName, { color: colors.foreground }]} numberOfLines={1}>
                      {celeb?.name ?? 'Celebrity'}
                    </Text>
                    <View style={s.wishOccRow}>
                      <Icon name={occasionIcon(occ?.occasion_type ?? 'other')} size={12} color={colors.mutedForeground} />
                      <Text style={[s.wishOccName, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {occ?.occasion_name ?? '—'}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    s.statusBadge,
                    { backgroundColor: hasReply ? '#22C55E20' : colors.muted, borderColor: hasReply ? '#22C55E40' : colors.border },
                  ]}>
                    <Text style={[s.statusText, { color: hasReply ? '#22C55E' : colors.mutedForeground }]}>
                      {hasReply ? 'Replied' : 'Sent'}
                    </Text>
                  </View>
                </View>

                {/* Date */}
                <Text style={[s.wishDate, { color: colors.mutedForeground }]}>
                  {new Date(wish.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>

                {/* Message */}
                <Text style={[s.wishMessage, { color: colors.foreground }]} numberOfLines={3}>
                  {wish.message}
                </Text>

                {/* AI Reply block */}
                {hasReply && (
                  <View style={[s.replyBlock, { backgroundColor: '#B44CFF15', borderColor: '#B44CFF30' }]}>
                    <View style={s.replyHeader}>
                      <Icon name="zap" size={13} color="#B44CFF" />
                      <Text style={s.replyLabel}>
                        {celeb?.name ?? 'Celebrity'} replied
                        {wish.reply_sent_at
                          ? ` · ${new Date(wish.reply_sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                          : ''}
                      </Text>
                    </View>
                    <Text style={[s.replyText, { color: colors.foreground }]}>
                      {wish.reply_message}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Toast */}
      {toast.length > 0 && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },

  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  gateTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  gateText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  gateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  gateBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  chipScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  chip: { alignItems: 'center', gap: 6, width: 72 },
  chipAvatarWrap: { borderRadius: 32, padding: 2 },
  chipAvatar: { width: 56, height: 56, borderRadius: 28 },
  chipAvatarPlaceholder: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  chipName: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 0,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  stepNum: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  stepLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  stepDivider: { height: 1.5, width: 8 },

  noOccasionWrap: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  noOccasionText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  noOccasionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  noOccasionBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  occasionList: { paddingHorizontal: 16, gap: 10 },
  occasionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  occIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  occName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  occDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  daysBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  daysBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  aiBannerText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },

  messageInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 120,
    lineHeight: 20,
  },
  charCountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  charCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  minCharHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#EF4444' },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 24 },

  wishCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  wishCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wishAvatar: { width: 42, height: 42, borderRadius: 21 },
  wishAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  wishCelebName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  wishOccRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  wishOccName: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  wishDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  wishMessage: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  replyBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#B44CFF' },
  replyText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, fontStyle: 'italic' },

  toast: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
