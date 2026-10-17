import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { NeonCard } from '@/components/neon/NeonCard';

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';

function imageUri(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : B2_BASE + url;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function previewText(text: string | null | undefined): string {
  if (!text) return '';
  if (text.startsWith('[Voice Note:')) return '🎙 Voice note';
  if (text.startsWith('[Greeting Card:')) return '🖼 Greeting card';
  return text.length > 55 ? text.slice(0, 52) + '...' : text;
}

interface Celebrity {
  id: string;
  name: string;
  image_url: string | null;
}

interface Conversation {
  id: string;
  user_id: string;
  celebrity_id: string;
  last_message_at: string | null;
  unread_count_user: number;
  message_count: number;
  is_closed: boolean;
  celebrity: Celebrity;
}

interface LastMessage {
  message_text: string;
  sender_type: string;
}

interface SubscriptionRow {
  celebrity: Celebrity | null;
}

/** One line in the list: a celebrity the user is subscribed to, or an older conversation, with its chat if it exists. */
interface ChatRow {
  key: string;
  celebrity: Celebrity;
  conversation: Conversation | null;
  subscribed: boolean;
}

export default function MessagesScreen() {
  const { colors, neon } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [subscribed, setSubscribed] = useState<Celebrity[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!profileId || !accessToken) {
      setConversations([]);
      setSubscribed([]);
      return;
    }
    try {
      const [res, subRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/conversations?select=*,celebrity:celebrities!conversations_celebrity_id_fkey(id,name,image_url)&user_id=eq.${profileId}&order=last_message_at.desc`,
          {},
          accessToken,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_favorites?select=celebrity:celebrities(id,name,image_url)&user_id=eq.${profileId}&status=eq.active&order=created_at.desc`,
          {},
          accessToken,
        ),
      ]);
      if (!res.ok) {
        Alert.alert('Error', `Could not load conversations (${res.status}). Please try again.`);
        return;
      }
      const convs = await res.json() as Conversation[];
      setConversations(convs ?? []);

      // Subscribed celebrities are the ones the user can start a new chat with. If this call fails, keep the old list.
      if (subRes.ok) {
        const rows = await subRes.json() as SubscriptionRow[];
        const seen = new Set<string>();
        const celebs: Celebrity[] = [];
        for (const r of rows ?? []) {
          if (r.celebrity && !seen.has(r.celebrity.id)) {
            seen.add(r.celebrity.id);
            celebs.push(r.celebrity);
          }
        }
        setSubscribed(celebs);
      }

      // Fetch last message for each conversation in parallel
      if (convs && convs.length > 0) {
        const results = await Promise.all(
          convs.map(async (c) => {
            try {
              const msgRes = await supabaseFetch(
                `/rest/v1/messages?select=message_text,sender_type&conversation_id=eq.${c.id}&order=created_at.desc&limit=1`,
                {},
                accessToken,
              );
              if (msgRes.ok) {
                const rows = await msgRes.json() as LastMessage[];
                return { id: c.id, msg: rows?.[0] ?? null };
              }
            } catch {}
            return { id: c.id, msg: null };
          }),
        );
        const map: Record<string, LastMessage> = {};
        results.forEach(({ id, msg }) => {
          if (msg) map[id] = msg;
        });
        setLastMessages(map);
      }
    } catch {
      Alert.alert('Error', 'Could not load conversations. Please check your connection.');
    }
  }, [profileId, accessToken]);

  useEffect(() => {
    setLoading(true);
    fetchConversations().finally(() => setLoading(false));

    pollRef.current = setInterval(() => {
      fetchConversations();
    }, 8000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchConversations]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  // Subscribed celebrities first-class: each appears once, with its chat when there is one. Chats with celebrities the
  // user is not subscribed to (e.g. started by sending a wish) stay in the list too.
  const rows: ChatRow[] = (() => {
    const byCeleb = new Map<string, Conversation>();
    conversations.forEach((c) => byCeleb.set(c.celebrity_id, c));
    const subIds = new Set(subscribed.map((c) => c.id));

    const out: ChatRow[] = subscribed.map((celebrity) => ({
      key: celebrity.id,
      celebrity,
      conversation: byCeleb.get(celebrity.id) ?? null,
      subscribed: true,
    }));
    conversations.forEach((c) => {
      if (!subIds.has(c.celebrity_id) && c.celebrity) {
        out.push({ key: c.celebrity_id, celebrity: c.celebrity, conversation: c, subscribed: false });
      }
    });

    // Chats that have messages come first, newest on top; celebrities not yet messaged follow, A to Z.
    const talked = (r: ChatRow) => (r.conversation && r.conversation.message_count > 0 ? 1 : 0);
    return out.sort((a, b) => {
      if (talked(a) !== talked(b)) return talked(b) - talked(a);
      if (talked(a) === 1) {
        return (b.conversation!.last_message_at ?? '').localeCompare(a.conversation!.last_message_at ?? '');
      }
      return a.celebrity.name.localeCompare(b.celebrity.name);
    });
  })();

  const filtered = rows.filter((r) => r.celebrity.name?.toLowerCase().includes(search.toLowerCase()));

  const openChat = (conversationId: string) =>
    router.push({ pathname: '/chat/[id]', params: { id: conversationId } });

  // Opens the chat with a subscribed celebrity, creating the conversation the first time. There is one conversation
  // per user and celebrity, so if it already exists (e.g. created by a wish) it is reused.
  const startChat = async (celebrity: Celebrity) => {
    if (!profileId || !accessToken || startingId) return;
    setStartingId(celebrity.id);
    try {
      let conversationId: string | undefined;
      const created = await supabaseFetch(
        '/rest/v1/conversations',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' } as Record<string, string>,
          body: JSON.stringify({ user_id: profileId, celebrity_id: celebrity.id }),
        },
        accessToken,
      );
      if (created.ok) {
        const inserted = await created.json() as Array<{ id: string }>;
        conversationId = inserted?.[0]?.id;
      } else {
        const existing = await supabaseFetch(
          `/rest/v1/conversations?select=id&user_id=eq.${profileId}&celebrity_id=eq.${celebrity.id}&limit=1`,
          {},
          accessToken,
        );
        if (existing.ok) {
          const found = await existing.json() as Array<{ id: string }>;
          conversationId = found?.[0]?.id;
        }
      }
      if (!conversationId) {
        Alert.alert('Error', `Could not start a chat with ${celebrity.name}. Please try again.`);
        return;
      }
      openChat(conversationId);
      fetchConversations();
    } catch {
      Alert.alert('Error', 'Could not start the chat. Please check your connection.');
    } finally {
      setStartingId(null);
    }
  };

  const renderItem = ({ item }: { item: ChatRow }) => {
    const { celebrity, conversation } = item;
    const avatarUri = imageUri(celebrity.image_url);
    const lastMsg = conversation ? lastMessages[conversation.id] : undefined;
    const preview = previewText(lastMsg?.message_text);
    const isClosed = conversation?.is_closed ?? false;
    const hasChat = !!conversation && conversation.message_count > 0;
    const unread = conversation?.unread_count_user ?? 0;
    const starting = startingId === celebrity.id;

    return (
      <TouchableOpacity
        style={{ opacity: isClosed ? 0.65 : 1 }}
        onPress={() => (conversation ? openChat(conversation.id) : startChat(celebrity))}
        disabled={starting}
        activeOpacity={0.75}
      >
        <NeonCard radius={18} style={s.row}>
          <View style={s.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} contentFit="cover" />
            ) : (
              <View style={[s.avatarPlaceholder, { backgroundColor: colors.border }]}>
                <Icon name="heart" size={20} color={colors.mutedForeground} />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={s.rowTop}>
              <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>
                {celebrity.name ?? 'Unknown'}
              </Text>
              {hasChat && (
                <Text style={[s.time, { color: colors.mutedForeground }]}>
                  {relativeTime(conversation?.last_message_at)}
                </Text>
              )}
            </View>
            <View style={s.rowBottom}>
              <Text
                style={[
                  s.lastMsg,
                  { color: hasChat || isClosed ? colors.mutedForeground : neon.cyan, flex: 1 },
                  isClosed && { fontStyle: 'italic' },
                ]}
                numberOfLines={1}
              >
                {isClosed ? '🔒 Conversation closed' : hasChat ? preview : item.subscribed ? 'Say hello 👋' : 'No messages yet'}
              </Text>
              {unread > 0 && !isClosed && (
                <View style={[s.badge, { backgroundColor: colors.primary }]}>
                  <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
          </View>

          {starting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : !hasChat && !isClosed ? (
            <View style={[s.startBtn, { backgroundColor: colors.primary }]}>
              <Icon name="send" size={14} color="#fff" />
            </View>
          ) : null}
        </NeonCard>
      </TouchableOpacity>
    );
  };

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Messages</Text>
        <Icon name="message-circle" size={22} color={colors.primary} />
      </View>

      <View style={[s.searchWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <Icon name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          style={[s.searchInput, { color: colors.foreground }]}
          placeholder="Search by celebrity name..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="x" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#FF6B33" />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: insets.bottom + 20, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF6B33" />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Icon name="message-circle" size={52} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {search ? 'No celebrities found' : 'No subscribed celebrities yet'}
              </Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {search
                  ? 'Try a different celebrity name'
                  : 'Subscribe to a celebrity to start messaging them.'}
              </Text>
              {!search && (
                <TouchableOpacity
                  style={[s.emptyBtn, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340' }]}
                  onPress={() => router.push('/(tabs)/celebrities')}
                  activeOpacity={0.8}
                >
                  <Icon name="heart" size={15} color="#FF6B33" />
                  <Text style={[s.emptyBtnText, { color: '#FF6B33' }]}>Explore Celebrities</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    margin: 14,
    marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 14, height: 46, fontFamily: 'Inter_400Regular' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    marginVertical: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1, marginRight: 8 },
  lastMsg: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  time: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  startBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
