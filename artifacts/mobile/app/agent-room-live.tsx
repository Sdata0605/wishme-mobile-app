import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initials, seatColour, SeatTable } from '@/components/council/shared';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { getCurrentCouncil, setCurrentCouncil } from '@/services/council/current';
import type { CouncilEngine } from '@/services/council/engine';
import { ROOM_LOCALES } from '@/services/council/presets';
import { DIRECTOR_ID, type CouncilStatus, type Decision, type SpeakerId, type TranscriptLine } from '@/services/council/types';
import { renderDocument } from '@/services/documents/render';
import { newDocumentId, saveContent, saveDocument } from '@/services/documents/store';

/**
 * The room itself. The table shows who is talking and who is about to; the transcript fills in as each line is heard;
 * the user can pause, mute, type or say something into the room, ask for more once it ends, and keep the record.
 * Leaving the screen closes the room and every connection behind it.
 */
export default function AgentRoomLiveScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const assistant = useVoiceAssistant();
  const engineRef = useRef<CouncilEngine | null>(getCurrentCouncil());
  const engine = engineRef.current;

  const [lines, setLines] = useState<TranscriptLine[]>(engine?.transcript ?? []);
  const [speaking, setSpeaking] = useState<SpeakerId | null>(null);
  const [thinking, setThinking] = useState<SpeakerId | null>(null);
  const [status, setStatus] = useState<CouncilStatus>(engine?.status ?? 'idle');
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<Decision | null>(engine?.decision ?? null);
  const [muted, setMuted] = useState(engine?.muted ?? false);
  const [paused, setPaused] = useState(false);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEarphones, setShowEarphones] = useState(engine?.roomSoundAvailable ?? false);
  const scroll = useRef<ScrollView>(null);
  const heardFinal = useRef('');
  const left = useRef(false);

  // The room has the speakers: the main assistant steps aside while it runs.
  useEffect(() => {
    if (assistant.open) assistant.close();
  }, []);

  useEffect(() => {
    if (!engine) { router.back(); return; }
    const unsub = engine.subscribe((e) => {
      switch (e.type) {
        case 'transcript': setLines(e.lines); setShowEarphones(false); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); break;
        case 'speaking': setSpeaking(e.speaker); break;
        case 'thinking': setThinking(e.speaker); break;
        case 'status': setStatus(e.status); setNote(e.note ?? ''); if (e.status === 'running') setPaused(false); if (e.status === 'paused') setPaused(true); break;
        case 'decision': setDecision(e.decision); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); break;
        case 'error': setNote(e.message); break;
      }
    });
    void engine.start();
    return () => {
      unsub();
      // Leaving the screen ends the room.
      if (getCurrentCouncil() === engine) setCurrentCouncil(null);
      else engine.stop();
      ExpoSpeechRecognitionModule.abort();
    };
  }, [engine]);

  const leave = useCallback(() => {
    if (left.current) return;
    Alert.alert('Leave the room?', 'The discussion ends when you leave. Save the record first if you want to keep it.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => { left.current = true; router.back(); } },
    ]);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; });
    return () => sub.remove();
  }, [leave]);

  const togglePause = () => {
    if (!engine) return;
    if (paused) { engine.resume(); setPaused(false); } else { engine.pause(); setPaused(true); }
  };

  const toggleMute = () => {
    if (!engine) return;
    const next = !muted;
    engine.setMuted(next);
    setMuted(next);
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || !engine || sending) return;
    setDraft('');
    setSending(true);
    try {
      await engine.interject(t);
    } finally {
      setSending(false);
    }
  };

  // Speaking into the room: the room pauses while the mic is open, so it does not hear itself.
  const listen = async () => {
    if (!engine) return;
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    const mic = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    if (!mic.granted) { setNote('Microphone permission is needed to speak into the room.'); return; }
    const rec = await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
    if (!rec.granted) { setNote('Speech recognition permission is needed to speak into the room.'); return; }
    engine.pause();
    setPaused(true);
    heardFinal.current = '';
    setListening(true);
    setNote('Listening… say your question or point.');
    try {
      ExpoSpeechRecognitionModule.start({
        lang: ROOM_LOCALES[engine.scenario.language] ?? 'en-IN',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
        androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500, EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1500 },
      });
    } catch {
      setListening(false);
      setNote('Speech recognition is not available on this phone.');
      engine.resume();
      setPaused(false);
    }
  };

  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results?.[0]?.transcript ?? '';
    if (e.isFinal) heardFinal.current = t; else setDraft(t);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const heard = (heardFinal.current || draft).trim();
    heardFinal.current = '';
    setNote('');
    engine?.resume();
    setPaused(false);
    if (heard) void send(heard); else setDraft('');
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    heardFinal.current = '';
    setNote(e.error === 'no-speech' ? 'Nothing heard. Tap the mic and try again.' : `Could not listen (${e.error}).`);
    engine?.resume();
    setPaused(false);
  });

  const more = () => { void engine?.more(); };

  const save = async () => {
    const content = engine?.toDocument();
    if (!content || saving) return;
    setSaving(true);
    try {
      const id = newDocumentId();
      const file = await renderDocument(content, 'pdf', id);
      await saveDocument({
        id, title: content.title, kind: 'notes', format: 'pdf', fileName: file.fileName, uri: file.uri, byteSize: file.byteSize,
        pageCount: file.pageCount, wordCount: content.wordCount, topic: `Agent room: ${engine!.scenario.scenario.slice(0, 80)}`, createdAt: new Date().toISOString(),
      });
      await saveContent(id, content);
      Alert.alert('Saved to Documents', 'The record of this room, with the decision and the full transcript, is in your Documents.', [
        { text: 'OK' },
        { text: 'Open Documents', onPress: () => router.push('/documents' as never) },
      ]);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!engine || !engine.plan) return <AmbientBackground />;
  const plan = engine.plan;
  const colourOf = (id: SpeakerId) => {
    if (id === DIRECTOR_ID) return neon.violet;
    const i = plan.cast.findIndex((c) => c.id === id);
    return i >= 0 ? seatColour(i) : neon.cyan;
  };
  const finished = status === 'finished';
  const statusText = (() => {
    if (note) return note;
    if (status === 'paused') return 'Paused.';
    if (speaking) return `${nameOf(speaking)} is speaking…`;
    if (thinking) return `${nameOf(thinking)} is thinking…`;
    if (finished) return 'The room has finished. Ask for more, or speak up.';
    return 'Starting…';
  })();
  function nameOf(id: SpeakerId) {
    return id === DIRECTOR_ID ? engine!.identity.name : plan.cast.find((c) => c.id === id)?.name.split(' ')[0] ?? 'Someone';
  }

  return (
    <AmbientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
          <View style={styles.header}>
            <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Leave the room" hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <Icon name="chevron-left" size={22} color={neon.textHi} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: neon.textHi }]} numberOfLines={1}>{plan.title}</Text>
              <Text style={[styles.sub, { color: neon.textLo }]} numberOfLines={1}>{plan.setting}</Text>
            </View>
            <Pressable onPress={toggleMute} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute the room' : 'Mute the room'} hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: muted ? neon.pink : neon.cardBorder }]}>
              <Icon name={muted ? 'volume-x' : 'volume-2'} size={20} color={muted ? neon.pink : neon.textHi} />
            </Pressable>
          </View>

          <SeatTable cast={plan.cast} directorName={engine.identity.name} speaking={speaking} thinking={thinking} />

          {showEarphones ? (
            <View style={[styles.earphones, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <Icon name="audio-lines" size={16} color={neon.cyan} />
              <Text style={[styles.earphonesText, { color: neon.textLo }]}>Put earphones on: every voice comes from its seat at the table.</Text>
            </View>
          ) : null}

          <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, gap: 10 }}>
            {lines.map((l) => {
              const mine = l.kind === 'user';
              const colour = mine ? neon.cyan : colourOf(l.speaker);
              return (
                <View key={l.id} style={[styles.line, mine && styles.mine, { backgroundColor: neon.glass, borderColor: speaking === l.speaker && lines[lines.length - 1]?.id === l.id ? colour : neon.cardBorder }]}>
                  <View style={styles.lineHead}>
                    <View style={[styles.lineDot, { backgroundColor: colour }]}>
                      {l.kind === 'director' ? <Icon name="sparkles" size={10} color="#FFFFFF" /> : <Text style={styles.lineInitials}>{initials(l.name)}</Text>}
                    </View>
                    <Text style={[styles.lineName, { color: colour }]}>{l.name}</Text>
                  </View>
                  <Text style={[styles.lineText, { color: neon.textHi }]} selectable>{l.text}</Text>
                </View>
              );
            })}
            {thinking && !speaking ? (
              <View style={[styles.line, { backgroundColor: neon.glass, borderColor: neon.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <ActivityIndicator size="small" color={colourOf(thinking)} />
                <Text style={[styles.sub, { color: neon.textLo, marginTop: 0 }]}>{nameOf(thinking)} is thinking…</Text>
              </View>
            ) : null}

            {decision ? (
              <View style={[styles.decision, { borderColor: neon.violet, backgroundColor: neon.glass }]}>
                <View style={styles.lineHead}>
                  <Icon name="award" size={18} color={neon.violet} />
                  <Text style={[styles.decisionTitle, { color: neon.textHi }]}>The record</Text>
                </View>
                <Text style={[styles.decisionLabel, { color: neon.textLo }]}>Summary</Text>
                <Text style={[styles.lineText, { color: neon.textHi }]}>{decision.summary}</Text>
                <Text style={[styles.decisionLabel, { color: neon.textLo }]}>Decision</Text>
                <Text style={[styles.lineText, { color: neon.textHi, fontFamily: 'Inter_600SemiBold' }]}>{decision.decision}</Text>
                {decision.keyPoints.length ? <Text style={[styles.decisionLabel, { color: neon.textLo }]}>Key points</Text> : null}
                {decision.keyPoints.map((p, i) => <Text key={i} style={[styles.bullet, { color: neon.textHi }]}>•  {p}</Text>)}
                {decision.nextSteps.length ? <Text style={[styles.decisionLabel, { color: neon.textLo }]}>Next steps</Text> : null}
                {decision.nextSteps.map((p, i) => <Text key={i} style={[styles.bullet, { color: neon.textHi }]}>•  {p}</Text>)}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Pressable onPress={() => void save()} disabled={saving} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: neon.violet }]}>
                    {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="download" size={16} color="#FFFFFF" />}
                    <Text style={styles.smallBtnText}>Save to Documents</Text>
                  </Pressable>
                  <Pressable onPress={more} disabled={!finished} accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: neon.glass, borderWidth: 1.2, borderColor: neon.cardBorder, opacity: finished ? 1 : 0.5 }]}>
                    <Icon name="refresh-cw" size={16} color={neon.textHi} />
                    <Text style={[styles.smallBtnText, { color: neon.textHi }]}>Continue</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <Text style={[styles.status, { color: neon.textLo }]} numberOfLines={2}>{statusText}</Text>

          <View style={[styles.bar, { paddingBottom: insets.bottom + 10, borderTopColor: neon.cardBorder }]}>
            <Pressable onPress={togglePause} disabled={finished && !engine.hasMoreQueued} accessibilityRole="button" accessibilityLabel={paused ? 'Resume' : 'Pause'} style={[styles.ctl, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <Icon name={paused ? 'play' : 'pause'} size={20} color={neon.textHi} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={listening ? 'Listening…' : 'Say something to the room…'}
              placeholderTextColor={neon.textDim}
              editable={!listening && !sending}
              onSubmitEditing={() => void send(draft)}
              returnKeyType="send"
              style={[styles.input, { color: neon.textHi, borderColor: listening ? neon.cyan : neon.cardBorder, backgroundColor: neon.surface }]}
            />
            {draft.trim() && !listening ? (
              <PressScale onPress={() => void send(draft)} disabled={sending} accessibilityRole="button" accessibilityLabel="Send">
                <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctl}>
                  {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="send" size={18} color="#FFFFFF" />}
                </LinearGradient>
              </PressScale>
            ) : (
              <PressScale onPress={() => void listen()} disabled={sending} accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Speak into the room'}>
                <LinearGradient colors={listening ? ['#19E3FF', '#1F7BFF'] : [neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctl}>
                  <Icon name={listening ? 'mic-off' : 'mic'} size={20} color="#FFFFFF" />
                </LinearGradient>
              </PressScale>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  earphones: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  earphonesText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  line: { borderWidth: 1, borderRadius: 16, padding: 12, maxWidth: '92%', alignSelf: 'flex-start' },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  lineDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  lineInitials: { color: '#FFFFFF', fontSize: 9.5, fontFamily: 'Inter_700Bold' },
  lineName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  lineText: { fontSize: 15.5, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  decision: { borderWidth: 1.5, borderRadius: 18, padding: 14, marginTop: 6 },
  decisionTitle: { fontSize: 17, fontFamily: 'PlayfairDisplay_700Bold' },
  decisionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  bullet: { fontSize: 14.5, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 3 },
  smallBtn: { flex: 1, height: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  smallBtnText: { color: '#FFFFFF', fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  status: { textAlign: 'center', fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_500Medium', paddingHorizontal: 24, marginBottom: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  ctl: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 23, paddingHorizontal: 16, height: 46, fontSize: 15, fontFamily: 'Inter_500Medium' },
});
