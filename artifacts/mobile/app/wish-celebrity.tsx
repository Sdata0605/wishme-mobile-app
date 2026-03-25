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
import { supabaseFetch } from '@/constants/supabase';

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';
function imgUrl(url: string | null): string {
  if (!url) return '';
  return url.startsWith('http') ? url : B2_BASE + url;
}

function formatDate(date: string): string {
  const d = new Date(date);
  const day = d.getUTCDate();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
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

export default function WishCelebrityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, user } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [occasions, setOccasions] = useState<CelebOccasion[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [toast, setToast] = useState('');

  const [selectedCelebId, setSelectedCelebId] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<CelebOccasion | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const fetchAll = useCallback(async () => {
    if (!session?.access_token || !user?.profileId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const favsRes = await supabaseFetch(
        `/rest/v1/celebrity_favorites?select=celebrity_id&user_id=eq.${user.profileId}&status=eq.active`,
        {},
        session.access_token,
      );
      if (!favsRes.ok) { setFetchError(true); setLoading(false); return; }
      const favRows = await favsRes.json() as Array<{ celebrity_id: string }>;
      if (favRows.length === 0) {
        setCelebrities([]);
        setOccasions([]);
        setLoading(false);
        return;
      }

      const ids = favRows.map(r => r.celebrity_id);
      const idList = ids.join(',');

      const today = new Date().toISOString().split('T')[0];

      const [celebRes, occasionRes, wishRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/celebrities?select=id,name,image_url,category&id=in.(${idList})&is_active=eq.true`,
          {},
          session.access_token,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_occasions?select=*,celebrities:celebrity_id(id,name,image_url,category)&celebrity_id=in.(${idList})&is_public=eq.true&occasion_date=gte.${today}&order=occasion_date.asc`,
          {},
          session.access_token,
        ),
        supabaseFetch(
          `/rest/v1/occasion_wishes?select=*,celebrity_occasions!inner(*,celebrities:celebrity_id(id,name,image_url,category))&user_id=eq.${user.profileId}&order=created_at.desc&limit=20`,
          {},
          session.access_token,
        ),
      ]);

      if (celebRes.ok) setCelebrities(await celebRes.json());
      if (occasionRes.ok) setOccasions(await occasionRes.json());
      if (wishRes.ok) setWishes(await wishRes.json());
    } catch {}
    setLoading(false);
  }, [session, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectedCeleb = celebrities.find(c => c.id === selectedCelebId) ?? null;
  const celebOccasions = occasions.filter(o => o.celebrity_id === selectedCelebId);

  const sendWish = async () => {
    if (!session?.access_token || !user?.profileId) return;
    if (!selectedCelebId || !selectedOccasion || message.length < 10) return;
    setSending(true);
    try {
      const postRes = await supabaseFetch(
        `/rest/v1/occasion_wishes`,
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            user_id: user.profileId,
            celebrity_id: selectedCelebId,
            occasion_id: selectedOccasion.id,
            message,
          }),
        },
        session.access_token,
      );
      if (!postRes.ok) {
        showToast('Failed to send wish. Please try again.');
        setSending(false);
        return;
      }
      const inserted = await postRes.json() as Wish[];
      const wishId = inserted?.[0]?.id;

      if (selectedOccasion.auto_reply_enabled && wishId) {
        supabaseFetch(
          `/functions/v1/generate-occasion-auto-reply`,
          {
            method: 'POST',
            body: JSON.stringify({
              wish_id: wishId,
              celebrity_id: selectedCelebId,
              occasion_name: selectedOccasion.occasion_name,
              user_message: message,
            }),
          },
          session.access_token,
        ).catch(() => {});
      }

      setMessage('');
      setSelectedCelebId(null);
      setSelectedOccasion(null);
      setActiveTab(1);
      await fetchAll();
      showToast('Wish sent successfully!');
    } catch {
      showToast('Failed to send wish. Please try again.');
    }
    setSending(false);
  };

  const canSend = !!selectedCelebId && !!selectedOccasion && message.length >= 10 && message.length <= 500;

  if (!session) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish Celebrity</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.centerState}>
          <Icon name="user" size={48} color={colors.mutedForeground} />
          <Text style={[s.stateTitle, { color: colors.foreground }]}>Please sign in</Text>
          <Text style={[s.stateBody, { color: colors.mutedForeground }]}>You need to be logged in to send wishes.</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)' as never)}>
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Login</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!loading && fetchError) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish Celebrity</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.centerState}>
          <Icon name="alert-circle" size={48} color={colors.mutedForeground} />
          <Text style={[s.stateTitle, { color: colors.foreground }]}>Something went wrong</Text>
          <Text style={[s.stateBody, { color: colors.mutedForeground }]}>Could not load your favourites. Please try again.</Text>
          <TouchableOpacity onPress={fetchAll}>
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!loading && celebrities.length === 0) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish Celebrity</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.centerState}>
          <Icon name="heart" size={48} color={colors.mutedForeground} />
          <Text style={[s.stateTitle, { color: colors.foreground }]}>No Favourite Celebrities Yet</Text>
          <Text style={[s.stateBody, { color: colors.mutedForeground }]}>
            Subscribe to your favourite celebrities to send them wishes on special occasions.
          </Text>
          <TouchableOpacity onPress={() => router.push('/favorites' as never)}>
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Browse Celebrities</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish Celebrity</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {(['Send Wish', 'My Wishes'] as const).map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[s.tab, activeTab === i && s.tabActive]}
            onPress={() => setActiveTab(i as 0 | 1)}
          >
            <Text style={[s.tabText, { color: activeTab === i ? '#FF6B33' : colors.mutedForeground }]}>{label}</Text>
            {activeTab === i && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#FF6B33" />
        </View>
      ) : activeTab === 0 ? (
        <SendWishTab
          colors={colors}
          insets={insets}
          celebrities={celebrities}
          occasions={celebOccasions}
          allOccasions={occasions}
          selectedCelebId={selectedCelebId}
          setSelectedCelebId={(id) => { setSelectedCelebId(id); setSelectedOccasion(null); }}
          selectedOccasion={selectedOccasion}
          setSelectedOccasion={setSelectedOccasion}
          message={message}
          setMessage={setMessage}
          canSend={canSend}
          sending={sending}
          onSend={sendWish}
          selectedCeleb={selectedCeleb}
        />
      ) : (
        <MyWishesTab
          colors={colors}
          insets={insets}
          wishes={wishes}
          onSendFirst={() => setActiveTab(0)}
        />
      )}

      {toast.length > 0 && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

interface TabColors {
  background: string;
  foreground: string;
  card: string;
  border: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  input: string;
}

function SendWishTab({
  colors, insets, celebrities, occasions, allOccasions,
  selectedCelebId, setSelectedCelebId, selectedOccasion, setSelectedOccasion,
  message, setMessage, canSend, sending, onSend, selectedCeleb,
}: {
  colors: TabColors;
  insets: { bottom: number };
  celebrities: Celebrity[];
  occasions: CelebOccasion[];
  allOccasions: CelebOccasion[];
  selectedCelebId: string | null;
  setSelectedCelebId: (id: string | null) => void;
  selectedOccasion: CelebOccasion | null;
  setSelectedOccasion: (o: CelebOccasion | null) => void;
  message: string;
  setMessage: (m: string) => void;
  canSend: boolean;
  sending: boolean;
  onSend: () => void;
  selectedCeleb: Celebrity | null;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingTop: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[s.sectionHeading, { color: colors.foreground }]}>Select a Celebrity</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {celebrities.map(celeb => {
          const isSelected = selectedCelebId === celeb.id;
          return (
            <TouchableOpacity
              key={celeb.id}
              style={[s.celebChip, isSelected && s.celebChipSelected]}
              onPress={() => setSelectedCelebId(isSelected ? null : celeb.id)}
              activeOpacity={0.8}
            >
              <View style={[s.chipAvatarWrap, isSelected && s.chipAvatarWrapSelected]}>
                <Image source={{ uri: imgUrl(celeb.image_url) }} style={[s.chipAvatar, isSelected && s.chipAvatarSelected]} contentFit="cover" />
              </View>
              <Text style={[s.chipName, { color: isSelected ? '#FF6B33' : colors.mutedForeground }]} numberOfLines={1}>
                {celeb.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!selectedCelebId && (
        <Text style={[s.instrText, { color: colors.mutedForeground }]}>Select a celebrity above to see upcoming occasions</Text>
      )}

      {selectedCelebId && (
        <View style={{ marginTop: 20 }}>
          <Text style={[s.sectionHeading, { color: colors.foreground }]}>
            Upcoming Occasions for {selectedCeleb?.name ?? ''}
          </Text>
          {occasions.length === 0 ? (
            <View style={[s.infoBox, { backgroundColor: colors.muted, marginHorizontal: 16 }]}>
              <Icon name="info" size={16} color={colors.mutedForeground} />
              <Text style={[s.infoText, { color: colors.mutedForeground }]}>No upcoming occasions right now</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {occasions.map(occ => {
                const days = daysUntil(occ.occasion_date);
                const isSelected = selectedOccasion?.id === occ.id;
                const badgeColor = days <= 7 ? '#EF4444' : days <= 30 ? '#F97316' : '#9CA3AF';
                const typeIcon = occ.occasion_type === 'birthday' ? 'gift' : occ.occasion_type === 'anniversary' ? 'heart' : 'star';
                const typeGrad: [string, string] = occ.occasion_type === 'birthday' ? ['#FF6B33', '#FF8C33'] : occ.occasion_type === 'anniversary' ? ['#E8527A', '#B44CFF'] : ['#4B83FF', '#B44CFF'];
                return (
                  <TouchableOpacity
                    key={occ.id}
                    style={[s.occasionCard, { backgroundColor: colors.card, borderColor: isSelected ? '#FF6B33' : colors.border }]}
                    onPress={() => setSelectedOccasion(isSelected ? null : occ)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={typeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.occIcon}>
                      <Icon name={typeIcon} size={18} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.occName, { color: colors.foreground }]}>{occ.occasion_name}</Text>
                      <Text style={[s.occDate, { color: colors.mutedForeground }]}>{formatDate(occ.occasion_date)}</Text>
                    </View>
                    <View style={[s.daysBadge, { backgroundColor: badgeColor + '22' }]}>
                      <Text style={[s.daysBadgeText, { color: badgeColor }]}>{days}d</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {selectedOccasion?.auto_reply_enabled && selectedCeleb && (
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <LinearGradient colors={['#7C3AED', '#4B83FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.autoReplyBanner}>
            <Icon name="zap" size={18} color="#fff" />
            <Text style={s.autoReplyText}>✨ {selectedCeleb.name} will auto-reply to your wish!</Text>
          </LinearGradient>
        </View>
      )}

      {selectedCelebId && selectedOccasion && (
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <TextInput
            style={[s.msgInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Write your wish..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            value={message}
            onChangeText={setMessage}
          />
          <Text style={[s.charCount, { color: colors.mutedForeground }]}>{message.length} / 500</Text>

          <TouchableOpacity disabled={!canSend || sending} onPress={onSend} style={{ marginTop: 16, borderRadius: 9999, overflow: 'hidden', opacity: canSend && !sending ? 1 : 0.45 }}>
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sendBtn}>
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.sendBtnText}>Send Wish</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function WishCard({ wish, colors }: { wish: Wish; colors: TabColors }) {
  const [expanded, setExpanded] = useState(false);
  const occ = wish.celebrity_occasions;
  const celeb = occ?.celebrities;
  const hasReply = !!wish.reply_message;
  const typeIcon = occ?.occasion_type === 'birthday' ? 'gift' : occ?.occasion_type === 'anniversary' ? 'heart' : 'star';
  const msgLong = wish.message.length > 180;

  return (
    <View style={[s.wishCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.wishCardTop}>
        {celeb?.image_url ? (
          <Image source={{ uri: imgUrl(celeb.image_url) }} style={s.wishAvatar} contentFit="cover" />
        ) : (
          <View style={[s.wishAvatarPlaceholder, { backgroundColor: colors.muted }]}>
            <Icon name="user" size={18} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.wishCelebName, { color: colors.foreground }]}>{celeb?.name ?? 'Celebrity'}</Text>
          <View style={s.wishOccRow}>
            <Icon name={typeIcon} size={12} color={colors.mutedForeground} />
            <Text style={[s.wishOccName, { color: colors.mutedForeground }]}>{occ?.occasion_name}</Text>
            <Text style={[s.wishOccDate, { color: colors.mutedForeground }]}> · {occ?.occasion_date ? formatDate(occ.occasion_date) : ''}</Text>
          </View>
        </View>
        <View style={[s.statusBadge, { backgroundColor: hasReply ? '#16A34A22' : '#9CA3AF22' }]}>
          <Text style={[s.statusBadgeText, { color: hasReply ? '#16A34A' : '#9CA3AF' }]}>{hasReply ? 'Replied' : 'Sent'}</Text>
        </View>
      </View>

      <Text style={[s.wishMsg, { color: colors.foreground }]} numberOfLines={expanded ? undefined : 3}>
        {wish.message}
      </Text>
      {msgLong && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)}>
          <Text style={{ color: '#FF6B33', fontSize: 12, fontFamily: 'Inter_500Medium' }}>{expanded ? 'See less' : 'See more'}</Text>
        </TouchableOpacity>
      )}

      {hasReply && (
        <View style={[s.replyBlock, { backgroundColor: '#7C3AED18' }]}>
          <View style={s.replyHeader}>
            <Icon name="zap" size={14} color="#7C3AED" />
            <Text style={[s.replyLabel, { color: '#7C3AED' }]}>
              {celeb?.name ?? 'Celebrity'} replied
            </Text>
            {wish.reply_sent_at && (
              <Text style={[s.replyTime, { color: colors.mutedForeground }]}>
                {formatDate(wish.reply_sent_at)}
              </Text>
            )}
          </View>
          <Text style={[s.replyText, { color: colors.foreground }]}>{wish.reply_message}</Text>
        </View>
      )}
    </View>
  );
}

function MyWishesTab({
  colors, insets, wishes, onSendFirst,
}: {
  colors: TabColors;
  insets: { bottom: number };
  wishes: Wish[];
  onSendFirst: () => void;
}) {
  if (wishes.length === 0) {
    return (
      <View style={s.centerState}>
        <Icon name="zap" size={48} color={colors.mutedForeground} />
        <Text style={[s.stateTitle, { color: colors.foreground }]}>No wishes sent yet</Text>
        <TouchableOpacity onPress={onSendFirst}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>Send Your First Wish</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {wishes.map(wish => (
        <WishCard key={wish.id} wish={wish} colors={colors} />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#FF6B33' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  stateTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  stateBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 9999 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sectionHeading: { fontSize: 14, fontFamily: 'Inter_600SemiBold', paddingHorizontal: 16, marginBottom: 12 },
  celebChip: { alignItems: 'center', gap: 6, width: 72 },
  celebChipSelected: {},
  chipAvatarWrap: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  chipAvatarWrapSelected: { borderColor: '#FF6B33' },
  chipAvatar: { width: 48, height: 48, borderRadius: 24 },
  chipAvatarSelected: { width: 52, height: 52, borderRadius: 26 },
  chipName: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  instrText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 16, paddingHorizontal: 32 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  occasionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  occIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  occName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  occDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  daysBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  daysBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  autoReplyBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  autoReplyText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  msgInput: { borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 120, maxHeight: 200, textAlignVertical: 'top' },
  charCount: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 4 },
  sendBtn: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  wishCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  wishCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wishAvatar: { width: 40, height: 40, borderRadius: 20 },
  wishAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wishCelebName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  wishOccRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  wishOccName: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  wishOccDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  wishMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  replyBlock: { borderRadius: 10, padding: 12, gap: 6 },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  replyTime: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  replyText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  toast: { position: 'absolute', bottom: 90, left: 24, right: 24, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
