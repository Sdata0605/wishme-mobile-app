import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useAIAssistant, type AIMessage } from '@/context/AIAssistantContext';

const { height: H } = Dimensions.get('window');
const SHEET_HEIGHT = H * 0.88;

const QUICK_STARTS = [
  { label: 'Book a Celebrity', query: 'How do I book a celebrity?' },
  { label: 'My Bookings', query: 'Show me my bookings' },
  { label: 'Wallet Balance', query: 'What is my wallet balance?' },
  { label: 'How it works', query: 'How does WishMe work?' },
];

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(700 - delay),
        ]),
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot: Animated.Value) => ({
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={styles.typingWrap}>
      <View style={styles.assistantBubble}>
        <View style={styles.typingDots}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View key={i} style={[styles.typingDot, dotStyle(d)]} />
          ))}
        </View>
      </View>
    </View>
  );
}

function MessageBubble({ msg, onSuggestion }: { msg: AIMessage; onSuggestion: (s: string) => void }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <View style={styles.userBubbleWrap}>
        <LinearGradient
          colors={['#FF6B33', '#EC4899', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <Text style={styles.userText}>{msg.content}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.assistantBubbleWrap}>
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantText}>{msg.content}</Text>
      </View>
      {msg.actions && msg.actions.length > 0 && (
        <View style={styles.actionsRow}>
          {msg.actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionBtn}
              onPress={() => {
                if (action.type === 'navigate' && action.data.route) {
                  router.push(action.data.route as Href);
                }
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnText}>{action.label}</Text>
              <Icon name="arrow-right" size={12} color="#aaa" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {msg.suggestions && msg.suggestions.length > 0 && (
        <View style={styles.suggestionsRow}>
          {msg.suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.suggestionChip}
              onPress={() => onSuggestion(s)}
              activeOpacity={0.75}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function AIChatSheet() {
  const { isOpen, closeChat, messages, isTyping, sendMessage, clearMessages } = useAIAssistant();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');

  const dragY = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(0);

  useEffect(() => {
    if (isOpen) {
      dragY.setValue(0);
      dragOffset.current = 0;
    }
  }, [isOpen, dragY]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isTyping]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        dragOffset.current = 0;
        dragY.setOffset(0);
        dragY.setValue(0);
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          dragY.setValue(gs.dy);
          dragOffset.current = gs.dy;
        }
      },
      onPanResponderRelease: () => {
        dragY.flattenOffset();
        if (dragOffset.current > 150) {
          dragY.setValue(0);
          closeChat();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }
        dragOffset.current = 0;
      },
    }),
  ).current;

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage(text);
  }, [input, sendMessage]);

  const handleSuggestion = useCallback((s: string) => {
    sendMessage(s);
  }, [sendMessage]);

  const handleQuickStart = useCallback((query: string) => {
    sendMessage(query);
  }, [sendMessage]);

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={closeChat}
      statusBarTranslucent
    >
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} onPress={closeChat} activeOpacity={1} />

        {/* KAV wraps the sheet — on Android, behavior="height" shrinks KAV height
            by keyboard height so the sheet lifts and the input stays visible. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          style={{ height: SHEET_HEIGHT }}
        >
          {/* Sheet fills the KAV — flex: 1 lets it shrink with KAV */}
          <Animated.View
            style={[
              styles.sheet,
              { flex: 1, transform: [{ translateY: dragY }] },
            ]}
          >
            {/* Drag handle */}
            <View {...panResponder.panHandlers} style={styles.dragArea}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <LinearGradient
                colors={['#FF6B33', '#EC4899', '#B44CFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Icon name="sparkles" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>AI Assistant</Text>
                <Text style={styles.headerStatus}>● ONLINE NOW</Text>
              </View>
              <TouchableOpacity onPress={clearMessages} style={styles.headerAction}>
                <Icon name="trash-2" size={16} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
              <TouchableOpacity onPress={closeChat} style={styles.closeBtn}>
                <Icon name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <View style={{ flex: 1 }}>
              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyState}>
                    <LinearGradient
                      colors={['#FF6B33', '#EC4899', '#B44CFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.emptyAvatar}
                    >
                      <Icon name="sparkles" size={32} color="#fff" />
                    </LinearGradient>
                    <Text style={styles.emptyTitle}>How can I help you?</Text>
                    <Text style={styles.emptySubtitle}>Ask me anything about WishMe</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.quickStartScroll}
                      contentContainerStyle={styles.quickStartRow}
                    >
                      {QUICK_STARTS.map((qs) => (
                        <TouchableOpacity
                          key={qs.label}
                          style={styles.quickChip}
                          onPress={() => handleQuickStart(qs.query)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.quickChipText}>{qs.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} onSuggestion={handleSuggestion} />
                    ))}
                    {isTyping && <TypingIndicator />}
                  </>
                )}
              </ScrollView>

              {/* Input bar */}
              <View style={[styles.inputBar, { paddingBottom: Math.max(16, insets.bottom) }]}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask me anything..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  multiline={false}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.8}
                  disabled={!input.trim()}
                >
                  {input.trim() ? (
                    <LinearGradient
                      colors={['#FF6B33', '#B44CFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.sendBtn}
                    >
                      <Icon name="send" size={18} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.sendBtn, styles.sendBtnDisabled]}>
                      <Icon name="send" size={18} color="rgba(255,255,255,0.3)" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0D1117',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  dragArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  headerStatus: {
    color: '#22C55E',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  headerAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: { flex: 1 },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 24,
  },
  quickStartScroll: {
    flexShrink: 0,
    flexGrow: 0,
  },
  quickStartRow: {
    gap: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  quickChipText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  userBubbleWrap: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    maxWidth: '88%',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  assistantBubbleWrap: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  assistantBubble: {
    backgroundColor: '#1C2438',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    maxWidth: '92%',
  },
  assistantText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#1C2438',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#1C2438',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  typingWrap: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0D1117',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
