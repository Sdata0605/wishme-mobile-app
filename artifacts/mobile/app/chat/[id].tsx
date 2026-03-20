import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_MESSAGES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

interface Message {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
}

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'Hi! Your birthday wish video is ready!', isMe: false, time: '10:30 AM' },
  { id: '2', text: 'Oh wow, really? That was so fast!', isMe: true, time: '10:32 AM' },
  { id: '3', text: 'Yes! I recorded a special personalized message. Hope you love it!', isMe: false, time: '10:33 AM' },
  { id: '4', text: "Thank you so much! I can't wait to see it", isMe: true, time: '10:34 AM' },
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [text, setText] = useState('');
  const contact = MOCK_MESSAGES.find((m) => m.id === id) ?? MOCK_MESSAGES[0];
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const send = () => {
    if (!text.trim()) return;
    const msg: Message = { id: Date.now().toString(), text: text.trim(), isMe: true, time: 'Now' };
    setMessages((prev) => [...prev, msg]);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={[styles.headerName, { color: colors.foreground }]}>{contact.name}</Text>
            <Text style={[styles.headerStatus, { color: '#22C55E' }]}>{contact.isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          <Icon name="phone" size={22} color={colors.primary} />
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.bubbleWrap, { alignItems: item.isMe ? 'flex-end' : 'flex-start' }]}>
              <View style={[
                styles.bubble,
                {
                  backgroundColor: item.isMe ? colors.primary : colors.card,
                  borderColor: item.isMe ? 'transparent' : colors.border,
                  borderWidth: item.isMe ? 0 : 1,
                  borderBottomRightRadius: item.isMe ? 4 : 16,
                  borderBottomLeftRadius: item.isMe ? 16 : 4,
                },
              ]}>
                <Text style={[styles.bubbleText, { color: item.isMe ? '#fff' : colors.foreground }]}>{item.text}</Text>
              </View>
              <Text style={[styles.bubbleTime, { color: colors.mutedForeground }]}>{item.time}</Text>
            </View>
          )}
        />

        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
          />
          <TouchableOpacity onPress={send} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
            <Icon name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  headerStatus: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  bubbleWrap: { gap: 3 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  bubbleTime: { fontSize: 11, fontFamily: 'Inter_400Regular', marginHorizontal: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
