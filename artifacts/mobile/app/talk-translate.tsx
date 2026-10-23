import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent, type ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';
import { TARGET_LANGS, langName, translate, warmUp, type LangCode } from '@/services/home/lens';

type Side = 'a' | 'b';
interface Turn { id: string; side: Side; heard: string; said: string }

/** The locale the phone's speech recogniser and voice use for each language. */
const LOCALE: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', gu: 'gu-IN', bn: 'bn-IN', ur: 'ur-IN',
  es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', ar: 'ar-SA', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', ru: 'ru-RU',
};
const localeOf = (c: LangCode) => LOCALE[c] ?? c;

/**
 * Android ships several speech recognisers. Samsung phones default to the on-device one bundled with Google's
 * text-to-speech package, which is quick but deaf to quiet voices and weak on Indian languages. The Google app's
 * recogniser (the one Google Translate and Assistant use) picks up far more and is much more accurate, so it is
 * preferred whenever it is installed. Order matters: first match wins.
 */
const PREFERRED_SERVICES = ['com.google.android.googlequicksearchbox', 'com.google.android.as'];

function pickService(): string | undefined {
  if (Platform.OS !== 'android') return undefined;
  try {
    const have = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    return PREFERRED_SERVICES.find((p) => have.includes(p));
  } catch {
    return undefined;
  }
}

/** How many times in a row the recogniser may hear nothing before the mic turns itself off. */
const MAX_SILENT_ROUNDS = 3;
/** Input level (0..1) below which, for a few seconds, the user is nudged to speak up. */
const QUIET_LEVEL = 0.28;
const QUIET_AFTER_MS = 2500;

/**
 * Two people, two languages, one phone. Tap your side's mic and keep talking: every sentence is translated as soon as
 * you pause, read out to the other side, and the mic comes back on by itself until you tap it again. Listening uses
 * the best speech recogniser on the phone; the translation is ML Kit on the device; the voice is the phone's.
 */
export default function TalkTranslateScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const [langA, setLangA] = useState<LangCode>(TARGET_LANGS[0].code); // English
  const [langB, setLangB] = useState<LangCode>(TARGET_LANGS[1].code); // Hindi
  const [listening, setListening] = useState<Side | null>(null);
  const [partial, setPartial] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [status, setStatus] = useState('Tap a mic and talk. Each sentence is translated when you pause.');
  const [level, setLevel] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [picker, setPicker] = useState<Side | null>(null);
  const scroll = useRef<ScrollView>(null);
  /** The side whose mic the user switched on; stays set across automatic restarts until they tap it again. */
  const armed = useRef<Side | null>(null);
  /** The side a recogniser session is running for right now. */
  const active = useRef<Side | null>(null);
  const finalText = useRef('');
  const partialRef = useRef('');
  const service = useRef<string | undefined>(pickService());
  const triedDefault = useRef(false);
  const silentRounds = useRef(0);
  const loudest = useRef(0);
  const quietTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  useEffect(() => {
    warmUp(langA, langB).catch(() => {});
    warmUp(langB, langA).catch(() => {});
  }, [langA, langB]);

  useEffect(() => () => {
    armed.current = null;
    if (quietTimer.current) clearTimeout(quietTimer.current);
    ExpoSpeechRecognitionModule.abort();
    Speech.stop();
  }, []);

  const clearQuietTimer = () => { if (quietTimer.current) { clearTimeout(quietTimer.current); quietTimer.current = null; } };

  const startSession = useCallback((side: Side) => {
    const lang = side === 'a' ? langA : langB;
    active.current = side;
    finalText.current = '';
    partialRef.current = '';
    loudest.current = 0;
    setPartial('');
    setLevel(0);
    setQuiet(false);
    setListening(side);
    setStatus(`Listening in ${langName(lang)}. Keep talking; tap the mic when you are done.`);
    clearQuietTimer();
    quietTimer.current = setTimeout(() => { if (active.current === side && loudest.current < QUIET_LEVEL) setQuiet(true); }, QUIET_AFTER_MS);
    const opts: ExpoSpeechRecognitionOptions = {
      lang: localeOf(lang),
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      addsPunctuation: true,
      androidRecognitionServicePackage: service.current,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
      androidIntentOptions: {
        EXTRA_LANGUAGE_MODEL: 'free_form',
        EXTRA_PREFER_OFFLINE: false,
        // Wait longer before deciding a sentence is over, so soft or slow speech is not cut off mid-way.
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1800,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1800,
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 5000,
      },
    };
    try {
      ExpoSpeechRecognitionModule.start(opts);
    } catch {
      active.current = null;
      armed.current = null;
      setListening(null);
      setStatus('Speech recognition is not available on this phone.');
    }
  }, [langA, langB]);

  const stopAll = useCallback((message?: string) => {
    armed.current = null;
    active.current = null;
    clearQuietTimer();
    setListening(null);
    setPartial('');
    setLevel(0);
    setQuiet(false);
    if (message !== undefined) setStatus(message);
  }, []);

  /** Switch the mic back on for the armed side, unless the user turned it off meanwhile. */
  const resume = useCallback((side: Side) => {
    if (armed.current !== side || active.current !== null) return;
    startSession(side);
  }, [startSession]);

  const finish = useCallback(async (side: Side, heard: string) => {
    const text = heard.trim();
    if (!text) {
      silentRounds.current += 1;
      if (silentRounds.current >= MAX_SILENT_ROUNDS) stopAll('Nothing heard for a while. Tap the mic to talk again, a little closer to the phone.');
      else resume(side);
      return;
    }
    silentRounds.current = 0;
    const from = side === 'a' ? langA : langB;
    const to = side === 'a' ? langB : langA;
    setStatus('Translating…');
    try {
      const said = await translate(text, from, to);
      const turn: Turn = { id: `${Date.now()}`, side, heard: text, said };
      setTurns((t) => [...t, turn]);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
      if (autoSpeakRef.current && said) {
        setStatus('Speaking…');
        Speech.stop();
        // The mic stays off while the phone talks, so it does not hear its own voice, then comes back on.
        Speech.speak(said, { language: localeOf(to), onDone: () => resume(side), onError: () => resume(side) });
      } else {
        resume(side);
      }
    } catch {
      setStatus('Could not translate that. The language pack may still be downloading.');
      resume(side);
    }
  }, [langA, langB, resume, stopAll]);

  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results?.[0]?.transcript ?? '';
    if (e.isFinal) finalText.current = t;
    else { partialRef.current = t; setPartial(t); }
  });
  useSpeechRecognitionEvent('speechstart', () => {
    silentRounds.current = 0;
    setQuiet(false);
    setStatus('Hearing you…');
  });
  useSpeechRecognitionEvent('volumechange', (e) => {
    // The recogniser reports roughly -2 (silence) to 10 (loud); squash that to 0..1 for the meter.
    const v = Math.max(0, Math.min(1, (e.value + 2) / 12));
    if (v > loudest.current) loudest.current = v;
    setLevel(v);
  });
  useSpeechRecognitionEvent('end', () => {
    const side = active.current;
    active.current = null;
    clearQuietTimer();
    setListening(null);
    setLevel(0);
    const heard = finalText.current || partialRef.current;
    finalText.current = '';
    partialRef.current = '';
    setPartial('');
    if (side) void finish(side, heard);
  });
  useSpeechRecognitionEvent('error', (e) => {
    const side = active.current;
    active.current = null;
    clearQuietTimer();
    setListening(null);
    setPartial('');
    setLevel(0);
    const heard = finalText.current || partialRef.current;
    finalText.current = '';
    partialRef.current = '';
    if (e.error === 'no-speech' || e.error === 'speech-timeout') {
      if (side && heard.trim()) { void finish(side, heard); return; }
      if (side && armed.current === side) {
        silentRounds.current += 1;
        if (silentRounds.current >= MAX_SILENT_ROUNDS) stopAll('Nothing heard for a while. Tap the mic to talk again, a little closer to the phone.');
        else { setStatus('Still listening. Speak a little louder.'); resume(side); }
        return;
      }
      stopAll('Nothing heard. Tap and speak again.');
      return;
    }
    if ((e.error === 'service-not-allowed' || e.error === 'language-not-supported' || e.error === 'client' || e.error === 'busy') && service.current && !triedDefault.current && side) {
      // The preferred recogniser refused: fall back to the phone's default one for the rest of this screen.
      triedDefault.current = true;
      service.current = undefined;
      if (armed.current === side) { startSession(side); return; }
    }
    if (e.error === 'network') { stopAll('Speech recognition needs the internet for this language.'); return; }
    if (e.error === 'aborted') { stopAll(); return; }
    stopAll(`Could not listen (${e.error}).`);
  });

  const listen = async (side: Side) => {
    if (armed.current === side) {
      // User is done with this side: let the recogniser hand over whatever it has, then stay off.
      armed.current = null;
      if (active.current === side) ExpoSpeechRecognitionModule.stop(); else stopAll('');
      return;
    }
    if (armed.current) return;
    Speech.stop();
    const mic = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    if (!mic.granted) { setStatus('Microphone permission is needed to listen.'); return; }
    const rec = await ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
    if (!rec.granted) { setStatus('Speech recognition permission is needed to listen.'); return; }
    silentRounds.current = 0;
    armed.current = side;
    startSession(side);
  };

  const swap = () => { if (armed.current) return; setLangA(langB); setLangB(langA); };
  const say = (turn: Turn) => { const to = turn.side === 'a' ? langB : langA; Speech.stop(); Speech.speak(turn.said, { language: localeOf(to) }); };

  const renderMic = (side: Side) => {
    const on = listening === side;
    const mine = armed.current === side;
    const lang = side === 'a' ? langA : langB;
    const blocked = listening !== null && !on && !mine;
    const ring = on ? 1 + level * 0.55 : 1;
    return (
      <View style={styles.micCol}>
        <Pressable onPress={() => setPicker(side)} disabled={armed.current !== null} accessibilityRole="button" style={[styles.langBtn, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
          <Text style={[styles.langBtnText, { color: neon.textHi }]}>{langName(lang)}</Text>
          <Icon name="chevron-down" size={14} color={neon.textLo} />
        </Pressable>
        <View style={styles.micWrap}>
          {on ? <View pointerEvents="none" style={[styles.ring, { borderColor: '#19E3FF', opacity: 0.25 + level * 0.6, transform: [{ scale: ring }] }]} /> : null}
          <PressScale onPress={() => void listen(side)} disabled={blocked} accessibilityRole="button" accessibilityLabel={on || mine ? `Stop ${langName(lang)}` : `Speak ${langName(lang)}`}>
            <LinearGradient colors={on || mine ? ['#19E3FF', '#1F7BFF'] : side === 'a' ? [neon.blue, neon.violet] : [neon.violet, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mic, blocked && { opacity: 0.4 }]}>
              <Icon name={on || mine ? 'mic-off' : 'mic'} size={30} color="#FFFFFF" />
            </LinearGradient>
          </PressScale>
        </View>
        <Text style={[styles.micHint, { color: neon.textLo }]}>{on || mine ? 'Tap when done' : 'Tap to talk'}</Text>
      </View>
    );
  };

  return (
    <AmbientBackground>
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
            <Icon name="chevron-left" size={22} color={neon.textHi} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: neon.textHi }]}>Conversation</Text>
            <Text style={[styles.sub, { color: neon.textLo }]}>{langName(langA)} ↔ {langName(langB)} · on-device translation</Text>
          </View>
          <Pressable onPress={swap} accessibilityRole="button" accessibilityLabel="Swap languages" hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
            <Icon name="refresh-cw" size={18} color={neon.textHi} />
          </Pressable>
        </View>

        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
          {turns.length === 0 && !partial ? (
            <View style={[styles.empty, { borderColor: neon.cardBorder }]}>
              <Icon name="users" size={28} color={neon.textLo} />
              <Text style={[styles.emptyText, { color: neon.textLo }]}>Hold the phone between you. Tap your mic and talk normally: every sentence is translated when you pause, spoken to the other side, and the mic comes back on. Tap again when you are done.</Text>
            </View>
          ) : null}
          {turns.map((t) => (
            <View key={t.id} style={[styles.bubble, t.side === 'a' ? styles.left : styles.right, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
              <Text style={[styles.heard, { color: neon.textLo }]}>{t.heard}</Text>
              <Text style={[styles.said, { color: neon.textHi }]}>{t.said}</Text>
              <Pressable onPress={() => say(t)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Say it again" style={styles.sayBtn}>
                <Icon name="volume-2" size={16} color={neon.cyan} />
              </Pressable>
            </View>
          ))}
          {partial ? (
            <View style={[styles.bubble, listening === 'a' ? styles.left : styles.right, { backgroundColor: neon.glass, borderColor: neon.cyan }]}>
              <Text style={[styles.said, { color: neon.textHi, fontStyle: 'italic' }]}>{partial}</Text>
            </View>
          ) : null}
        </ScrollView>

        {quiet && listening ? (
          <View style={[styles.quiet, { backgroundColor: 'rgba(255,196,0,0.12)', borderColor: 'rgba(255,196,0,0.45)' }]}>
            <Icon name="volume-x" size={16} color="#FFC400" />
            <Text style={[styles.quietText, { color: neon.textHi }]}>I can barely hear you. Speak a little louder or bring the phone closer.</Text>
          </View>
        ) : null}
        {status ? <Text style={[styles.status, { color: neon.textLo }]}>{status}</Text> : null}
        <View style={[styles.mics, { paddingBottom: insets.bottom + 12 }]}>
          {renderMic('a')}
          <View style={styles.middle}>
            <Switch value={autoSpeak} onValueChange={setAutoSpeak} trackColor={{ true: neon.violet, false: neon.cardBorder }} thumbColor="#FFFFFF" />
            <Text style={[styles.micHint, { color: neon.textLo }]}>Speak out loud</Text>
          </View>
          {renderMic('b')}
        </View>
      </View>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.scrim} onPress={() => setPicker(null)} />
        <View style={[styles.sheet, { backgroundColor: '#0E0D2C', borderColor: 'rgba(255,255,255,0.12)', paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.sheetTitle}>{picker === 'a' ? 'Left side speaks' : 'Right side speaks'}</Text>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {TARGET_LANGS.map((l) => {
              const on = (picker === 'a' ? langA : langB) === l.code;
              return (
                <Pressable key={l.code} onPress={() => { if (picker === 'a') setLangA(l.code); else setLangB(l.code); setPicker(null); }} style={[styles.opt, on && { backgroundColor: neon.violet }]}>
                  <Text style={styles.optText}>{l.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  empty: { borderWidth: 1, borderRadius: 18, borderStyle: 'dashed', padding: 22, alignItems: 'center', gap: 10, marginTop: 10 },
  emptyText: { fontSize: 14.5, lineHeight: 21, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  bubble: { maxWidth: '86%', borderWidth: 1, borderRadius: 18, padding: 12, paddingRight: 36 },
  left: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  right: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  heard: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  said: { fontSize: 17, lineHeight: 24, fontFamily: 'Inter_600SemiBold' },
  sayBtn: { position: 'absolute', right: 10, top: 10 },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  quietText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  status: { textAlign: 'center', fontSize: 13, fontFamily: 'Inter_500Medium', paddingHorizontal: 24, marginBottom: 6 },
  mics: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 12, paddingTop: 6 },
  micCol: { alignItems: 'center', gap: 10 },
  middle: { alignItems: 'center', gap: 6, paddingBottom: 26 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1.2 },
  langBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  micWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 3 },
  mic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  micHint: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingTop: 16 },
  sheetTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  opt: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_500Medium' },
});
