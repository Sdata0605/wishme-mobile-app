import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { askAboutImage } from '@/services/home/askGemini';

const IDEAS = ['What is this?', 'Is this safe to eat?', 'How much is this worth?', 'What plant is this?', 'Explain this to me', 'What should I do with this?'];

interface QA { q: string; a: string }

/**
 * Ask about a photo: take or choose a picture, ask anything about it, and Gemini answers. The picture is shrunk on
 * the phone before it is sent; the key stays on the server (the voice assistant's token function mints a short-lived
 * token for each question).
 */
export default function AskPhotoScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [jpeg, setJpeg] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [partial, setPartial] = useState('');
  const [history, setHistory] = useState<QA[]>([]);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => () => { void Speech.stop(); }, []);

  const prepare = async (uri: string) => {
    setImage(uri);
    setHistory([]);
    setPartial('');
    try {
      const out = await manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.72, format: SaveFormat.JPEG, base64: true });
      setJpeg(out.base64 ?? null);
    } catch {
      setJpeg(null);
      Alert.alert('Could not read that picture', 'Try another one.');
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera needed', 'Allow the camera to take the picture.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets[0]) await prepare(res.assets[0].uri);
  };
  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) await prepare(res.assets[0].uri);
  };

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || !jpeg || busy) return;
    const session = await getValidSession();
    if (!session) { Alert.alert('Sign in', 'Sign in to ask about pictures.'); return; }
    setBusy(true);
    setPartial('');
    setQuestion('');
    try {
      const answer = await askAboutImage({ accessToken: session.access_token, base64Jpeg: jpeg, question: text, onStatus: setStatus, onPartial: setPartial });
      setHistory((h) => [...h, { q: text, a: answer || 'Gemini had nothing to say about that.' }]);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setHistory((h) => [...h, { q: text, a: `Sorry, that did not work: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setBusy(false);
      setStatus('');
      setPartial('');
    }
  };

  return (
    <AmbientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <Icon name="chevron-left" size={22} color={neon.textHi} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: neon.textHi }]}>Ask about a photo</Text>
              <Text style={[styles.sub, { color: neon.textLo }]}>A plant, a dish, a product, a sign: ask anything about it.</Text>
            </View>
          </View>

          <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={styles.row}>
              <PressScale onPress={() => void takePhoto()} accessibilityRole="button" style={{ flex: 1 }}>
                <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bigBtn}>
                  <Icon name="camera" size={20} color="#FFFFFF" /><Text style={styles.bigBtnText}>Take a photo</Text>
                </LinearGradient>
              </PressScale>
              <Pressable onPress={() => void pickPhoto()} accessibilityRole="button" style={[styles.bigBtn, { backgroundColor: neon.glass, borderWidth: 1.2, borderColor: neon.cardBorder, flex: 1 }]}>
                <Icon name="image" size={20} color={neon.textHi} /><Text style={[styles.bigBtnText, { color: neon.textHi }]}>From gallery</Text>
              </Pressable>
            </View>

            {image ? <Image source={{ uri: image }} style={styles.preview} contentFit="cover" /> : (
              <View style={[styles.empty, { borderColor: neon.cardBorder }]}>
                <Icon name="sparkles" size={28} color={neon.textLo} />
                <Text style={[styles.sub, { color: neon.textLo, textAlign: 'center' }]}>Take or choose a picture, then ask. Gemini looks at it and answers in a few seconds.</Text>
              </View>
            )}

            {image ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {IDEAS.map((i) => (
                  <Pressable key={i} onPress={() => void ask(i)} disabled={busy || !jpeg} accessibilityRole="button" style={[styles.chip, { backgroundColor: neon.glass, borderColor: neon.cardBorder }, (busy || !jpeg) && { opacity: 0.5 }]}>
                    <Text style={[styles.chipText, { color: neon.textHi }]}>{i}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {history.map((qa, i) => (
              <View key={i} style={{ gap: 8 }}>
                <View style={[styles.bubble, styles.me, { backgroundColor: neon.violet }]}>
                  <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>{qa.q}</Text>
                </View>
                <View style={[styles.bubble, styles.ai, { backgroundColor: neon.glass, borderColor: neon.cardBorder, borderWidth: 1 }]}>
                  <Text style={[styles.bubbleText, { color: neon.textHi }]} selectable>{qa.a}</Text>
                  <View style={styles.bubbleActions}>
                    <Pressable onPress={() => { Speech.stop(); Speech.speak(qa.a); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Read aloud"><Icon name="volume-2" size={16} color={neon.cyan} /></Pressable>
                    <Pressable onPress={() => void Clipboard.setStringAsync(qa.a)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy answer"><Icon name="copy" size={16} color={neon.cyan} /></Pressable>
                  </View>
                </View>
              </View>
            ))}
            {busy ? (
              <View style={[styles.bubble, styles.ai, { backgroundColor: neon.glass, borderColor: neon.cardBorder, borderWidth: 1 }]}>
                {partial ? <Text style={[styles.bubbleText, { color: neon.textHi }]}>{partial}</Text> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator size="small" color={neon.cyan} /><Text style={[styles.sub, { color: neon.textLo }]}>{status || 'Thinking…'}</Text></View>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.askRow, { paddingBottom: insets.bottom + 12, borderTopColor: neon.cardBorder }]}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder={image ? 'Ask about this picture…' : 'Pick a picture first'}
              placeholderTextColor={neon.textDim}
              editable={!!image && !busy}
              onSubmitEditing={() => void ask(question)}
              returnKeyType="send"
              style={[styles.input, { color: neon.textHi, borderColor: neon.cardBorder, backgroundColor: neon.surface }]}
            />
            <PressScale onPress={() => void ask(question)} disabled={!question.trim() || !jpeg || busy} accessibilityRole="button" accessibilityLabel="Ask">
              <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.send, (!question.trim() || !jpeg || busy) && { opacity: 0.4 }]}>
                <Icon name="send" size={20} color="#FFFFFF" />
              </LinearGradient>
            </PressScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 12 },
  bigBtn: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  preview: { height: 220, borderRadius: 18 },
  empty: { borderWidth: 1, borderRadius: 18, borderStyle: 'dashed', padding: 22, alignItems: 'center', gap: 10 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13.5, fontFamily: 'Inter_500Medium' },
  bubble: { maxWidth: '88%', borderRadius: 18, padding: 12 },
  me: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  ai: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15.5, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  bubbleActions: { flexDirection: 'row', gap: 14, marginTop: 8 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, height: 48, fontSize: 15, fontFamily: 'Inter_500Medium' },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
