import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
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
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const B2_BASE = 'https://f005.backblazeb2.com/file/wishmetoday/';

function celebImageUri(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : B2_BASE + url;
}

function msgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtSecs(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

const EMOJIS = [
  '❤️','🔥','😊','😂','🎉','👏','🙏','✨',
  '💫','😍','🥰','😘','👍','💪','🌟','🎂',
  '🎁','🎤','💃','🎵','🎶','💝','💖','💗',
  '🌹','🌺','🌸','🎊','🥳','🎬','🤩','😎',
  '🥂','🍰','🎈','💐','🌈','🎯','🏆','👑',
  '💎','🦋','🌙','⭐','🎠','🎡','🤗','😄',
];

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'user' | 'celebrity';
  message_text: string;
  is_read: boolean;
  is_ai_generated: boolean;
  created_at: string;
  conversation_message_number?: number | null;
}

interface ConvMeta {
  id: string;
  message_count: number;
  is_closed: boolean;
  closed_reason: string | null;
  unread_count_celebrity: number;
  celebrity: {
    id: string;
    name: string;
    image_url: string | null;
  };
}

type MsgContentType = 'text' | 'voice' | 'card';

function parseMsgContent(text: string): { type: MsgContentType; url?: string; plain?: string } {
  if (text.startsWith('[Voice Note: ') && text.endsWith(']')) {
    return { type: 'voice', url: text.slice('[Voice Note: '.length, -1) };
  }
  if (text.startsWith('[Greeting Card: ') && text.endsWith(']')) {
    return { type: 'card', url: text.slice('[Greeting Card: '.length, -1) };
  }
  return { type: 'text', plain: text };
}

function TypingIndicator({ colors }: { colors: { card: string; border: string; mutedForeground: string } }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: -7, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(300),
        ]),
      ),
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={[td.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[td.dot, { backgroundColor: colors.mutedForeground, transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

const td = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

function VoiceNotePlayer({
  url,
  isMe,
  colors,
}: {
  url: string;
  isMe: boolean;
  colors: { foreground: string; mutedForeground: string };
}) {
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const toggle = async () => {
    if (loadingAudio) return;
    if (!soundRef.current) {
      setLoadingAudio(true);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
        sound.setOnPlaybackStatusUpdate((s) => {
          if (s.isLoaded && s.didJustFinish) {
            setPlaying(false);
          }
        });
        soundRef.current = sound;
        setPlaying(true);
      } catch {
        Alert.alert('Error', 'Could not play voice note. Please try again.');
      } finally {
        setLoadingAudio(false);
      }
      return;
    }
    if (playing) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  };

  const iconName = loadingAudio ? 'refresh-cw' : playing ? 'pause' : 'play';
  const textColor = isMe ? 'rgba(255,255,255,0.9)' : colors.mutedForeground;

  return (
    <View style={vn.container}>
      <TouchableOpacity onPress={toggle} disabled={loadingAudio} style={vn.playBtn}>
        <Icon name={iconName} size={18} color={isMe ? '#fff' : colors.foreground} />
      </TouchableOpacity>
      <View style={vn.bars}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[
              vn.bar,
              {
                height: 4 + ((i % 3) * 6),
                backgroundColor: isMe ? 'rgba(255,255,255,0.7)' : colors.foreground,
                opacity: playing ? 1 : 0.4,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[vn.label, { color: textColor }]}>Voice note</Text>
    </View>
  );
}

const vn = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 160 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  bar: { width: 3, borderRadius: 2 },
  label: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

function MessageBubble({
  msg,
  isMe,
  colors,
}: {
  msg: ChatMessage;
  isMe: boolean;
  colors: { primary: string; card: string; border: string; foreground: string; mutedForeground: string };
}) {
  const parsed = parseMsgContent(msg.message_text);
  const isTemp = msg.id.startsWith('temp-');

  return (
    <View style={[mb.wrap, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          mb.bubble,
          {
            backgroundColor: isMe ? colors.primary : colors.card,
            borderColor: isMe ? 'transparent' : colors.border,
            borderWidth: isMe ? 0 : 1,
            borderBottomRightRadius: isMe ? 4 : 16,
            borderBottomLeftRadius: isMe ? 16 : 4,
            opacity: isTemp ? 0.6 : 1,
          },
        ]}
      >
        {parsed.type === 'text' && (
          <Text style={[mb.text, { color: isMe ? '#fff' : colors.foreground }]}>
            {parsed.plain}
          </Text>
        )}
        {parsed.type === 'voice' && parsed.url && (
          <VoiceNotePlayer url={parsed.url} isMe={isMe} colors={colors} />
        )}
        {parsed.type === 'card' && parsed.url && (
          <View style={mb.cardWrap}>
            <Image
              source={{ uri: parsed.url }}
              style={[mb.cardImg, { width: Math.min(Dimensions.get('window').width * 0.75, 320) }]}
              contentFit="cover"
            />
            <TouchableOpacity
              style={mb.cardLink}
              onPress={() => WebBrowser.openBrowserAsync(parsed.url!)}
            >
              <Icon name="eye" size={13} color={isMe ? '#fff' : colors.primary} />
              <Text style={[mb.cardLinkText, { color: isMe ? '#fff' : colors.primary }]}>
                View Full Card
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {!isMe && msg.is_ai_generated && (
          <View style={mb.aiBadge}>
            <Text style={mb.aiBadgeText}>AI</Text>
          </View>
        )}
      </View>
      <Text style={[mb.time, { color: colors.mutedForeground }]}>
        {isTemp ? 'Sending...' : msgTime(msg.created_at)}
      </Text>
    </View>
  );
}

const mb = StyleSheet.create({
  wrap: { gap: 3, marginVertical: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  text: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  time: { fontSize: 11, fontFamily: 'Inter_400Regular', marginHorizontal: 4 },
  cardWrap: { gap: 8 },
  cardImg: { height: 180, borderRadius: 10 },
  cardLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardLinkText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  aiBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(180,76,255,0.2)',
  },
  aiBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#B44CFF' },
});

export default function ChatScreen() {
  const { id: convId } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const profileId = user?.profileId ?? '';
  const accessToken = session?.access_token ?? null;

  const [convMeta, setConvMeta] = useState<ConvMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTypingRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const unreadCelebRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);

  const setTyping = (val: boolean) => {
    showTypingRef.current = val;
    setShowTyping(val);
  };

  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const markAsRead = useCallback(async () => {
    if (!convId || !accessToken) return;
    try {
      supabaseFetch(
        `/rest/v1/conversations?id=eq.${convId}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ unread_count_user: 0 }),
        },
        accessToken,
      ).catch(() => {});
      supabaseFetch(
        `/rest/v1/messages?conversation_id=eq.${convId}&is_read=eq.false`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ is_read: true }),
        },
        accessToken,
      ).catch(() => {});
    } catch {}
  }, [convId, accessToken]);

  const fetchNewMessages = useCallback(async () => {
    if (!convId || !accessToken) return;
    const latest = messagesRef.current.find(m => !m.id.startsWith('temp-'));
    const latestTs = latest?.created_at;

    try {
      const url = latestTs
        ? `/rest/v1/messages?select=*&conversation_id=eq.${convId}&created_at=gt.${encodeURIComponent(latestTs)}&order=created_at.desc&limit=50`
        : `/rest/v1/messages?select=*&conversation_id=eq.${convId}&order=created_at.desc&limit=50`;

      const res = await supabaseFetch(url, {}, accessToken);
      if (!res.ok) return;
      const newMsgs = await res.json() as ChatMessage[];
      if (newMsgs && newMsgs.length > 0) {
        setMessages(prev => [
          ...newMsgs,
          ...prev.filter(m => !m.id.startsWith('temp-')),
        ]);
        if (showTypingRef.current) {
          setTyping(false);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
        if (scrollOffsetRef.current <= 200) {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }
      }
    } catch {}
  }, [convId, accessToken]);

  const bootstrap = useCallback(async () => {
    if (!convId || !accessToken) return;
    try {
      const [metaRes, limitRes, msgsRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/conversations?select=*,celebrity:celebrities!conversations_celebrity_id_fkey(id,name,image_url)&id=eq.${convId}&limit=1`,
          {},
          accessToken,
        ),
        supabaseFetch(
          `/rest/v1/platform_settings?select=setting_value&setting_key=eq.conversation_message_limit`,
          {},
          accessToken,
        ),
        supabaseFetch(
          `/rest/v1/messages?select=*&conversation_id=eq.${convId}&order=created_at.desc&limit=50`,
          {},
          accessToken,
        ),
      ]);

      if (metaRes.ok) {
        const rows = await metaRes.json() as ConvMeta[];
        if (rows?.[0]) {
          setConvMeta(rows[0]);
          unreadCelebRef.current = rows[0].unread_count_celebrity;
        }
      }

      if (limitRes.ok) {
        const rows = await limitRes.json() as Array<{ setting_value: string }>;
        if (rows?.[0]) {
          const lim = parseInt(rows[0].setting_value, 10);
          if (!isNaN(lim)) {
            // messageLimit would be used for UI warning; stored in conv meta
          }
        }
      }

      if (msgsRes.ok) {
        const rows = await msgsRes.json() as ChatMessage[];
        setMessages(rows ?? []);
        if (rows && rows.length < 50) setHasMoreMessages(false);
      }

      markAsRead();
    } catch (err) {
      Alert.alert('Error', 'Could not load conversation. Please check your connection.');
    }
  }, [convId, accessToken, markAsRead]);

  useEffect(() => {
    setLoading(true);
    bootstrap().finally(() => setLoading(false));

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchNewMessages, 5000);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    startPolling();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') startPolling();
      else stopPolling();
    });

    return () => {
      stopPolling();
      appStateSub.remove();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, [bootstrap, fetchNewMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages || !convId || !accessToken) return;
    const oldest = messagesRef.current.filter(m => !m.id.startsWith('temp-')).slice(-1)[0]?.created_at;
    if (!oldest) return;
    setIsLoadingMore(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/messages?select=*&conversation_id=eq.${convId}&created_at=lt.${encodeURIComponent(oldest)}&order=created_at.desc&limit=30`,
        {},
        accessToken,
      );
      if (res.ok) {
        const rows = await res.json() as ChatMessage[];
        if (!rows || rows.length === 0) {
          setHasMoreMessages(false);
        } else {
          setMessages(prev => [...prev, ...rows]);
        }
      }
    } catch {}
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreMessages, convId, accessToken]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!profileId || !accessToken || !convId) return;
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      conversation_id: convId,
      sender_id: profileId,
      sender_type: 'user',
      message_text: trimmed,
      is_read: false,
      is_ai_generated: false,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [tempMsg, ...prev]);
    setSending(true);

    try {
      const msgRes = await supabaseFetch(
        '/rest/v1/messages',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({
            conversation_id: convId,
            sender_id: profileId,
            sender_type: 'user',
            message_text: trimmed,
            is_read: false,
            is_ai_generated: false,
          }),
        },
        accessToken,
      );

      if (!msgRes.ok) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        Alert.alert('Send Failed', 'Could not send message. Please try again.');
        return;
      }

      const now = new Date().toISOString();
      supabaseFetch(
        `/rest/v1/conversations?id=eq.${convId}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ last_message_at: now }),
        },
        accessToken,
      ).catch(() => {});

      const nextUnread = unreadCelebRef.current + 1;
      supabaseFetch(
        `/rest/v1/conversations?id=eq.${convId}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ unread_count_celebrity: nextUnread }),
        },
        accessToken,
      ).catch(() => {});
      unreadCelebRef.current = nextUnread;

      setTyping(true);

      supabaseFetch(
        '/functions/v1/celebrity-conversation-auto-reply',
        {
          method: 'POST',
          body: JSON.stringify({ conversationId: convId, userMessage: trimmed }),
        },
        accessToken,
      ).catch(() => {});

      const fallback = setTimeout(() => {
        if (showTypingRef.current) fetchNewMessages();
      }, 8000);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
        clearTimeout(fallback);
      }, 20000);

      setTimeout(() => fetchNewMessages(), 1500);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Send Failed', 'Could not send message. Please check your connection.');
    } finally {
      setSending(false);
    }
  }, [profileId, accessToken, convId, fetchNewMessages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || convMeta?.is_closed) return;
    setText('');
    setShowEmoji(false);
    sendMessage(trimmed);
  };

  const startRecording = async () => {
    if (convMeta?.is_closed) return;
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow microphone access to record voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingSecs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSecs(s => s + 1);
      }, 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const rec = recordingRef.current;
    if (!rec) {
      setIsRecording(false);
      setRecordingSecs(0);
      return;
    }
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingSecs(0);
      if (!uri) {
        Alert.alert('Error', 'Recording failed. Please try again.');
        return;
      }
      await uploadAndSendVoiceNote(uri);
    } catch {
      setIsRecording(false);
      setRecordingSecs(0);
      Alert.alert('Error', 'Could not stop recording. Please try again.');
    }
  };

  const uploadAndSendVoiceNote = async (uri: string) => {
    if (!profileId || !accessToken) return;
    const fileName = `voice-${Date.now()}.m4a`;
    const path = `${profileId}/${fileName}`;

    try {
      // Read file as base64, then convert to Blob for binary PUT upload
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const dataUriResponse = await fetch(`data:audio/m4a;base64,${base64}`);
      const blob = await dataUriResponse.blob();

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/voice-notes/${path}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'audio/m4a',
            'x-upsert': 'true',
          },
          body: blob,
        },
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        Alert.alert(
          'Upload Failed',
          `Could not upload voice note (${uploadRes.status}). ${errText || 'Please try again.'}`,
        );
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/voice-notes/${path}`;
      await sendMessage(`[Voice Note: ${publicUrl}]`);
    } catch {
      Alert.alert('Upload Failed', 'Could not upload voice note. Please check your connection.');
    }
  };

  const toggleEmoji = () => {
    if (!showEmoji) {
      inputRef.current?.blur();
      setShowEmoji(true);
    } else {
      setShowEmoji(false);
    }
  };

  const isClosed = convMeta?.is_closed ?? false;
  const celebAvatar = celebImageUri(convMeta?.celebrity?.image_url);
  const celebName = convMeta?.celebrity?.name ?? 'Celebrity';

  if (loading) {
    return (
      <View style={[s.container, s.centerWrap, { backgroundColor: colors.background }]}>
        <Text style={[s.loadingText, { color: colors.mutedForeground }]}>Loading conversation...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={s.headerInfo}>
            {celebAvatar ? (
              <Image source={{ uri: celebAvatar }} style={s.headerAvatar} contentFit="cover" />
            ) : (
              <View style={[s.headerAvatarPlaceholder, { backgroundColor: colors.border }]}>
                <Icon name="heart" size={16} color={colors.mutedForeground} />
              </View>
            )}
            <View>
              <Text style={[s.headerName, { color: colors.foreground }]} numberOfLines={1}>
                {celebName}
              </Text>
              <Text style={[s.headerStatus, { color: isClosed ? '#EF4444' : '#22C55E' }]}>
                {isClosed ? 'Closed' : 'AI Powered'}
              </Text>
            </View>
          </View>
        </View>

        {/* Closed banner */}
        {isClosed && (
          <View style={[s.closedBanner, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
            <Icon name="alert-circle" size={16} color="#F59E0B" />
            <Text style={s.closedText}>
              {'Conversation closed'}
              {convMeta?.closed_reason ? ` — ${convMeta.closed_reason}` : ''}
            </Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={[s.msgList, { paddingBottom: 8 }]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.3}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={100}
          ListHeaderComponent={showTyping ? <TypingIndicator colors={colors} /> : null}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={s.loadMoreWrap}>
                <Text style={[s.loadMoreText, { color: colors.mutedForeground }]}>Loading older messages...</Text>
              </View>
            ) : !hasMoreMessages && messages.length > 0 ? (
              <View style={s.loadMoreWrap}>
                <Text style={[s.loadMoreText, { color: colors.mutedForeground }]}>Start of conversation</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={[s.emptyWrap, { transform: [{ scaleY: -1 }] }]}>
              <Icon name="message-circle" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Say hello to {celebName}!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              msg={item}
              isMe={item.sender_type === 'user'}
              colors={colors}
            />
          )}
        />

        {/* Emoji panel */}
        {showEmoji && (
          <View style={[s.emojiPanel, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.emojiGrid}>
                {EMOJIS.map((emoji, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.emojiBtn}
                    onPress={() => setText(prev => prev + emoji)}
                  >
                    <Text style={s.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Input bar */}
        <View
          style={[
            s.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 8,
              opacity: isClosed ? 0.5 : 1,
            },
          ]}
        >
          {isRecording ? (
            <View style={s.recordingRow}>
              <View style={[s.recDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[s.recLabel, { color: '#EF4444', flex: 1 }]}>
                Recording {fmtSecs(recordingSecs)}
              </Text>
              <TouchableOpacity
                style={[s.recStopBtn, { backgroundColor: '#EF444420', borderColor: '#EF444440' }]}
                onPress={stopRecording}
              >
                <Icon name="pause" size={16} color="#EF4444" />
                <Text style={[s.recStopText, { color: '#EF4444' }]}>Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.inputRow}>
              <TouchableOpacity
                onPress={toggleEmoji}
                style={s.iconBtn}
                disabled={isClosed}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon
                  name="smile"
                  size={22}
                  color={showEmoji ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={[
                  s.textInput,
                  {
                    backgroundColor: colors.input ?? colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={isClosed ? 'Conversation closed' : 'Type a message...'}
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                onFocus={() => setShowEmoji(false)}
                onSubmitEditing={handleSend}
                editable={!isClosed && !sending}
                multiline
                maxLength={1000}
              />

              {text.trim().length > 0 ? (
                <TouchableOpacity
                  style={[s.sendBtn, { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 }]}
                  onPress={handleSend}
                  disabled={sending || isClosed}
                >
                  <Icon name="send" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.micBtn, { borderColor: colors.border }]}
                  onPress={startRecording}
                  disabled={isClosed}
                >
                  <Icon name="mic" size={20} color={isClosed ? colors.mutedForeground : colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centerWrap: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarPlaceholder: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  headerStatus: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderTopWidth: 1,
  },
  closedText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#F59E0B', flex: 1 },

  msgList: { paddingHorizontal: 16, paddingTop: 10, gap: 0 },

  loadMoreWrap: { alignItems: 'center', paddingVertical: 12 },
  loadMoreText: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },

  emojiPanel: {
    height: 256,
    borderTopWidth: 1,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 0,
  },
  emojiBtn: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 24 },

  inputBar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconBtn: { paddingBottom: 10 },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  recStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  recStopText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
