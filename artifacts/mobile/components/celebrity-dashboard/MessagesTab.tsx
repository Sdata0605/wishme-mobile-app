import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { fmtDate, SectionEmpty, LoadingBox, Card, SectionTitle, styles } from './shared';
import type { TabPropsWithUser } from './shared';
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseFetch } from '@/constants/supabase';

interface Conversation {
  id: string;
  user_id: string;
  last_message_at: string;
  last_message_text: string;
  unread_count_celebrity?: number;
  profiles?: { first_name: string; last_name: string };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  is_read: boolean;
  is_ai_generated?: boolean;
}

interface CelebSettings {
  id?: string;
  celebrity_id: string;
  ai_auto_reply_enabled: boolean;
}

export function MessagesTab({ celebrity, colors, session, user }: TabPropsWithUser) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [aiSettings, setAiSettings] = useState<CelebSettings | null>(null);
  const [togglingAI, setTogglingAI] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const fetchConvos = useCallback(async () => {
    setLoading(true);
    try {
      const [convoRes, settingsRes] = await Promise.all([
        supabaseFetch(
          `/rest/v1/conversations?celebrity_id=eq.${celebrity.id}&select=*,profiles(first_name,last_name)&order=last_message_at.desc&limit=30`,
          {},
          session?.access_token,
        ),
        supabaseFetch(
          `/rest/v1/celebrity_settings?celebrity_id=eq.${celebrity.id}&limit=1`,
          {},
          session?.access_token,
        ),
      ]);
      if (convoRes.ok) { const r = await convoRes.json() as Conversation[]; setConvos(r ?? []); }
      if (settingsRes.ok) {
        const r = await settingsRes.json() as CelebSettings[];
        setAiSettings(r?.[0] ?? { celebrity_id: celebrity.id, ai_auto_reply_enabled: false });
      }
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token]);

  const toggleAIAutoReply = async () => {
    if (!session?.access_token) return;
    setTogglingAI(true);
    try {
      const newVal = !(aiSettings?.ai_auto_reply_enabled ?? false);
      const res = await supabaseFetch(
        '/rest/v1/celebrity_settings',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } as Record<string, string>,
          body: JSON.stringify({ celebrity_id: celebrity.id, ai_auto_reply_enabled: newVal }),
        },
        session.access_token,
      );
      if (res.ok) {
        setAiSettings(prev => prev ? { ...prev, ai_auto_reply_enabled: newVal } : { celebrity_id: celebrity.id, ai_auto_reply_enabled: newVal });
      }
    } catch {}
    setTogglingAI(false);
  };

  useEffect(() => { fetchConvos(); }, [fetchConvos]);

  useEffect(() => {
    if (!session?.access_token) return;
    const wsBase = SUPABASE_URL.replace('https://', 'wss://');
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;
    const send = (msg: object) => { try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {} };
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        send({
          topic: `realtime:public:conversations`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              postgres_changes: [{ event: '*', schema: 'public', table: 'conversations', filter: `celebrity_id=eq.${celebrity.id}` }],
            },
            access_token: session.access_token,
          },
          ref: String(++ref),
        });
        heartbeat = setInterval(() => { send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.event === 'postgres_changes') fetchConvos();
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}
    return () => { if (heartbeat) clearInterval(heartbeat); ws?.close(); };
  }, [celebrity.id, session?.access_token, fetchConvos]);

  const activeConvoRef = useRef<Conversation | null>(null);
  activeConvoRef.current = activeConvo;

  useEffect(() => {
    if (!activeConvo?.id || !session?.access_token) return;
    const wsBase = SUPABASE_URL.replace('https://', 'wss://');
    const wsUrl = `${wsBase}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let ref = 0;
    const send = (msg: object) => { try { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); } catch {} };
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        send({
          topic: `realtime:public:messages`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvo.id}` }],
            },
            access_token: session.access_token,
          },
          ref: String(++ref),
        });
        heartbeat = setInterval(() => { send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          if (msg.event === 'postgres_changes' && activeConvoRef.current) {
            supabaseFetch(
              `/rest/v1/messages?conversation_id=eq.${activeConvoRef.current.id}&order=created_at.asc&limit=100`,
              {},
              session.access_token,
            ).then(async res => {
              if (res.ok) { const r = await res.json() as Message[]; setMessages(r ?? []); }
            }).catch(() => {});
          }
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}
    return () => { if (heartbeat) clearInterval(heartbeat); ws?.close(); };
  }, [activeConvo?.id, session?.access_token]);

  const openConvo = async (c: Conversation) => {
    setActiveConvo(c);
    setMsgLoading(true);
    try {
      const res = await supabaseFetch(
        `/rest/v1/messages?conversation_id=eq.${c.id}&order=created_at.asc&limit=100`,
        {},
        session?.access_token,
      );
      if (res.ok) { const r = await res.json() as Message[]; setMessages(r ?? []); }
      await supabaseFetch(
        `/rest/v1/messages?conversation_id=eq.${c.id}&sender_id=neq.${user?.profileId}&is_read=eq.false`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ is_read: true }) },
        session?.access_token,
      );
    } catch {}
    setMsgLoading(false);
  };

  const generateAIReply = async () => {
    if (!activeConvo || !session?.access_token) return;
    const fanMessages = messages.filter(m => m.sender_id !== user?.profileId);
    const lastFanMessage = fanMessages[fanMessages.length - 1]?.message_text ?? '';
    setGeneratingAI(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/celebrity-ai-message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ conversationId: activeConvo.id, userMessage: lastFanMessage }),
      });
      if (res.ok) {
        await openConvo(activeConvo);
      } else {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('AI Error', err.message ?? 'Failed to generate reply');
      }
    } catch (err) {
      Alert.alert('AI Error', err instanceof Error ? err.message : 'Failed to generate reply');
    }
    setGeneratingAI(false);
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeConvo || !session?.access_token) return;
    setSending(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/messages',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({
            conversation_id: activeConvo.id,
            sender_id: user?.profileId,
            sender_type: 'celebrity',
            message_text: reply.trim(),
          }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to send message (${res.status})`);
      } else {
        setReply('');
        await supabaseFetch(
          `/rest/v1/conversations?id=eq.${activeConvo.id}`,
          { method: 'PATCH', headers: { Prefer: 'return=minimal' } as Record<string, string>, body: JSON.stringify({ last_message_at: new Date().toISOString() }) },
          session.access_token,
        ).catch(() => {});
        await openConvo(activeConvo);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
    }
    setSending(false);
  };

  if (activeConvo) {
    const fanName = activeConvo.profiles ? `${activeConvo.profiles.first_name ?? ''} ${activeConvo.profiles.last_name ?? ''}`.trim() : 'Fan';
    const fanMessages = messages.filter(m => m.sender_id !== user?.profileId);
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.msgHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setActiveConvo(null)}>
            <Icon name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1, marginLeft: 12 }]}>{fanName}</Text>
          <TouchableOpacity
            onPress={generateAIReply}
            disabled={generatingAI || fanMessages.length === 0}
            style={[styles.aiBtnSmall, { opacity: fanMessages.length === 0 ? 0.4 : 1 }]}
          >
            {generatingAI ? <ActivityIndicator size="small" color="#7B5CFA" /> : (
              <>
                <Text style={{ color: '#7B5CFA', fontFamily: 'Inter_700Bold', fontSize: 11 }}>AI</Text>
                <Text style={{ color: '#7B5CFA', fontFamily: 'Inter_500Medium', fontSize: 11, marginLeft: 3 }}>Reply</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        {msgLoading ? (
          <LoadingBox />
        ) : (
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {messages.map(m => {
              const isMine = m.sender_id === user?.profileId;
              return (
                <View key={m.id} style={{ alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  {m.is_ai_generated && isMine && (
                    <View style={styles.aiBadge}>
                      <Text style={{ color: '#7B5CFA', fontFamily: 'Inter_700Bold', fontSize: 10 }}>AI</Text>
                    </View>
                  )}
                  <View style={[styles.bubble, { backgroundColor: isMine ? '#7B5CFA' : colors.card, borderColor: m.is_ai_generated ? '#7B5CFA' : colors.border }]}>
                    <Text style={{ color: isMine ? '#fff' : colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{m.message_text}</Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>{fmtDate(m.created_at)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
        <View style={[styles.replyRow, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder="Type a reply..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.replyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            multiline
          />
          <TouchableOpacity onPress={sendReply} disabled={sending} style={styles.sendBtn}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) return <LoadingBox />;

  return (
    <View style={styles.tabPad}>
      <Card colors={colors}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>AI Auto-Reply</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Automatically reply to fan messages with AI</Text>
          </View>
          <TouchableOpacity
            onPress={toggleAIAutoReply}
            disabled={togglingAI}
            style={[styles.toggleBtn, { backgroundColor: aiSettings?.ai_auto_reply_enabled ? '#7B5CFA' : colors.border }]}
          >
            {togglingAI ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 }}>
                {aiSettings?.ai_auto_reply_enabled ? 'ON' : 'OFF'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {aiSettings?.ai_auto_reply_enabled && (
          <View style={[styles.aiBanner]}>
            <Icon name="check-circle" size={14} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontFamily: 'Inter_600SemiBold', fontSize: 13, marginLeft: 6 }}>AI Auto-Reply is ON</Text>
          </View>
        )}
      </Card>

      <SectionTitle text="Conversations" colors={colors} />
      {!convos.length && <SectionEmpty icon="message-circle" text="No conversations yet" colors={colors} />}
      {convos.map(c => {
        const fanName = c.profiles ? `${c.profiles.first_name ?? ''} ${c.profiles.last_name ?? ''}`.trim() : 'Fan';
        const unread = c.unread_count_celebrity ?? 0;
        return (
          <TouchableOpacity key={c.id} onPress={() => openConvo(c)}>
            <Card colors={colors}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{fanName}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>{c.last_message_text}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{fmtDate(c.last_message_at)}</Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }}>{unread}</Text>
                    </View>
                  ) : (
                    <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
                  )}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
