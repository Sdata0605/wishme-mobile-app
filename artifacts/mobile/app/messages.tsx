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

export default function MessagesScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!profileId || !accessToken) {
      setConversations([]);
      return;
    }
    try {
      const res = await supabaseFetch(
        `/rest/v1/conversations?select=*,celebrity:celebrities!conversations_celebrity_id_fkey(id,name,image_url)&user_id=eq.${profileId}&order=last_message_at.desc`,
        {},
        accessToken,
      );
      if (!res.ok) {
        Alert.alert('Error', `Could not load conversations (${res.status}). Please try again.`);
        return;
      }
      const convs = await res.json() as Conversation[];
      setConversations(convs ?? []);

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

  const filtered = conversations.filter((c) =>
    c.celebrity?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const renderItem = ({ item }: { item: Conversation }) => {
    const avatarUri = imageUri(item.celebrity?.image_url);
    const lastMsg = lastMessages[item.id];
    const preview = previewText(lastMsg?.message_text);
    const isClosed = item.is_closed;

    return (
      <TouchableOpacity
        style={[s.row, { borderBottomColor: colors.border, opacity: isClosed ? 0.65 : 1 }]}
        onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
        activeOpacity={0.75}
      >
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
              {item.celebrity?.name ?? 'Unknown'}
            </Text>
            <Text style={[s.time, { color: colors.mutedForeground }]}>
              {relativeTime(item.last_message_at)}
            </Text>
          </View>
          <View style={s.rowBottom}>
            <Text
              style={[
                s.lastMsg,
                { color: isClosed ? colors.mutedForeground : colors.mutedForeground, flex: 1 },
                isClosed && { fontStyle: 'italic' },
              ]}
              numberOfLines={1}
            >
              {isClosed ? '🔒 Conversation closed' : preview || 'No messages yet'}
            </Text>
            {item.unread_count_user > 0 && !isClosed && (
              <View style={[s.badge, { backgroundColor: colors.primary }]}>
                <Text style={s.badgeText}>
                  {item.unread_count_user > 99 ? '99+' : item.unread_count_user}
                </Text>
              </View>
            )}
          </View>
        </View>
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
          <ActivityIndicator size="large" color="#7B5CFA" />
          <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#7B5CFA" />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Icon name="message-circle" size={52} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {search ? 'No conversations found' : 'No conversations yet'}
              </Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {search
                  ? 'Try a different celebrity name'
                  : 'Follow a celebrity and start chatting!'}
              </Text>
              {!search && (
                <TouchableOpacity
                  style={[s.emptyBtn, { backgroundColor: '#7B5CFA15', borderColor: '#7B5CFA40' }]}
                  onPress={() => router.push('/favorites')}
                  activeOpacity={0.8}
                >
                  <Icon name="heart" size={15} color="#7B5CFA" />
                  <Text style={[s.emptyBtnText, { color: '#7B5CFA' }]}>Explore Celebrities</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
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
