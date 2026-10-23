import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';
import { AUTO, SOURCE_LANGS, TARGET_LANGS, guessLanguage, langName, readText, translate, warmUp, type LangCode, type ReadBlock, type SourceChoice } from '@/services/home/lens';

interface Shown extends ReadBlock { translated: string }
interface Frame { uri: string; width: number; height: number; blocks: Shown[]; from: LangCode }

const PAUSE_BETWEEN_FRAMES_MS = 350;

/**
 * Lens-style live translation: the camera takes a small picture about once a second, ML Kit reads the text on the
 * phone, each block is translated and drawn over the spot it was read from. Freeze keeps the last picture still so
 * it can be read, spoken or copied; a photo from the gallery works the same way. Everything runs on the device.
 */
export default function TranslateLensScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [source, setSource] = useState<SourceChoice>(AUTO);
  const [target, setTarget] = useState<LangCode>(TARGET_LANGS[0].code);
  const [detected, setDetected] = useState<LangCode | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [status, setStatus] = useState('Point the camera at some text');
  const [busyPack, setBusyPack] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });

  // The loop reads these without re-rendering.
  const live = useRef({ alive: true, frozen: false, busy: false, cameraReady: false, source: AUTO as SourceChoice, target: TARGET_LANGS[0].code as LangCode, lastUri: '' });
  live.current.frozen = frozen;
  live.current.cameraReady = cameraReady;
  live.current.source = source;
  live.current.target = target;

  useEffect(() => {
    if (!permission?.granted) void requestPermission();
  }, [permission?.granted, requestPermission]);

  const translateBlocks = useCallback(async (blocks: ReadBlock[], text: string, src: SourceChoice, dst: LangCode): Promise<{ shown: Shown[]; from: LangCode }> => {
    const from = src === AUTO ? await guessLanguage(text) : src;
    const slow = setTimeout(() => setBusyPack(true), 1500);
    try {
      const shown: Shown[] = [];
      for (const b of blocks) shown.push({ ...b, translated: await translate(b.text, from, dst) });
      return { shown, from };
    } finally {
      clearTimeout(slow);
      setBusyPack(false);
    }
  }, []);

  const dropFile = (uri: string) => { if (uri) void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}); };

  // One pass: picture → text → translations → overlay. Then the next, after a short pause.
  const cycle = useCallback(async () => {
    const L = live.current;
    if (!L.alive) return;
    if (L.frozen || !L.cameraReady || L.busy || !camera.current) {
      setTimeout(() => void cycle(), PAUSE_BETWEEN_FRAMES_MS);
      return;
    }
    L.busy = true;
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.5, exif: false, shutterSound: false });
      if (!pic || L.frozen || !L.alive) { if (pic) dropFile(pic.uri); return; }
      const { text, blocks } = await readText(pic.uri, L.source);
      if (L.frozen || !L.alive) { dropFile(pic.uri); return; }
      if (!blocks.length) {
        setStatus('No text found yet. Move closer or hold still.');
        dropFile(pic.uri);
        return;
      }
      const { shown, from } = await translateBlocks(blocks, text, L.source, L.target);
      if (L.frozen || !L.alive) { dropFile(pic.uri); return; }
      setDetected(from);
      setStatus('');
      const prev = L.lastUri;
      L.lastUri = pic.uri;
      setFrame({ uri: pic.uri, width: pic.width, height: pic.height, blocks: shown, from });
      if (prev && prev !== pic.uri) dropFile(prev);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(/model|download|network/i.test(msg) ? 'The language pack could not be downloaded. Check the connection.' : 'Could not read that frame. Trying again…');
    } finally {
      L.busy = false;
      if (L.alive) setTimeout(() => void cycle(), PAUSE_BETWEEN_FRAMES_MS);
    }
  }, [translateBlocks]);

  useEffect(() => {
    live.current.alive = true;
    void cycle();
    return () => {
      live.current.alive = false;
      Speech.stop();
      dropFile(live.current.lastUri);
    };
  }, [cycle]);

  // A new target language: fetch its pack now, and redo the frozen picture in it.
  useEffect(() => {
    const from = source === AUTO ? detected ?? TARGET_LANGS[0].code : source;
    setBusyPack(true);
    warmUp(from, target).catch(() => {}).finally(() => setBusyPack(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, source]);

  const retranslateFrozen = useCallback(async () => {
    if (!frame) return;
    const { shown, from } = await translateBlocks(frame.blocks, frame.blocks.map((b) => b.text).join('\n'), source, target);
    setFrame({ ...frame, blocks: shown, from });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.uri, source, target]);

  useEffect(() => { if (frozen) void retranslateFrozen(); }, [frozen, retranslateFrozen]);

  const onFreeze = () => {
    if (!frozen && !frame) return;
    setFrozen((f) => !f);
  };

  const fromPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setFrozen(true);
    setStatus('Reading the photo…');
    try {
      const { text, blocks } = await readText(a.uri, source);
      if (!blocks.length) { setStatus('No text found in that photo.'); return; }
      const { shown, from } = await translateBlocks(blocks, text, source, target);
      setDetected(from);
      setStatus('');
      setFrame({ uri: a.uri, width: a.width, height: a.height, blocks: shown, from });
    } catch {
      setStatus('Could not read that photo.');
    }
  };

  const fullText = frame?.blocks.map((b) => b.translated).filter(Boolean).join('\n') ?? '';
  const speak = () => { if (fullText) { Speech.stop(); Speech.speak(fullText, { language: target }); } };
  const copy = async () => { if (fullText) await Clipboard.setStringAsync(fullText); };

  // Picture pixels → screen points. The preview and the still both fill the view (centre crop).
  const place = (b: ReadBlock) => {
    if (!frame || !view.w || !view.h) return null;
    const scale = Math.max(view.w / frame.width, view.h / frame.height);
    const dx = (view.w - frame.width * scale) / 2;
    const dy = (view.h - frame.height * scale) / 2;
    return { left: b.frame.left * scale + dx, top: b.frame.top * scale + dy, width: b.frame.width * scale, height: b.frame.height * scale };
  };

  const onLayout = (e: LayoutChangeEvent) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const sourceLabel = source === AUTO ? (detected ? `Auto · ${langName(detected)}` : 'Auto') : langName(source);

  if (!permission?.granted) {
    return (
      <View style={[styles.root, { backgroundColor: '#07071A', paddingTop: insets.top + 60, alignItems: 'center', paddingHorizontal: 32 }]}>
        <Icon name="camera" size={44} color={neon.pink} />
        <Text style={[styles.permTitle, { color: '#FFFFFF' }]}>Camera needed</Text>
        <Text style={[styles.permText, { color: 'rgba(255,255,255,0.7)' }]}>WishMe reads text through the camera to translate it on your phone. Nothing is uploaded.</Text>
        <PressScale onPress={() => void requestPermission()} accessibilityRole="button">
          <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.permBtn}>
            <Text style={styles.permBtnText}>Allow camera</Text>
          </LinearGradient>
        </PressScale>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginTop: 18 }}><Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter_500Medium' }}>Back</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]} onLayout={onLayout}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" animateShutter={false} mute onCameraReady={() => setCameraReady(true)} />
      {frozen && frame ? <Image source={{ uri: frame.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}

      {/* Translations drawn where the text was read */}
      {frame ? frame.blocks.map((b, i) => {
        const box = place(b);
        if (!box) return null;
        const fontSize = Math.max(10, Math.min(24, (box.height / b.lines) * 0.62));
        return (
          <View key={`${frame.uri}-${i}`} pointerEvents="none" style={[styles.block, box]}>
            <Text style={[styles.blockText, { fontSize, lineHeight: fontSize * 1.18 }]} numberOfLines={b.lines + 1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {b.translated || b.text}
            </Text>
          </View>
        );
      }) : null}

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.round}>
          <Icon name="chevron-left" size={22} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Choose languages" style={styles.langPill}>
          <Text style={styles.langText} numberOfLines={1}>{sourceLabel}</Text>
          <Icon name="arrow-right" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.langText} numberOfLines={1}>{langName(target)}</Text>
          <Icon name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Pressable onPress={() => void fromPhoto()} accessibilityRole="button" accessibilityLabel="Translate a photo" hitSlop={8} style={styles.round}>
          <Icon name="image" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Bottom panel */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
        {status || busyPack ? (
          <View style={styles.statusRow}>
            {busyPack ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.statusText}>{busyPack ? 'Getting the language pack… (one time, about 30 MB)' : status}</Text>
          </View>
        ) : null}
        {fullText ? (
          <ScrollView style={styles.textBox} contentContainerStyle={{ padding: 12 }} nestedScrollEnabled>
            <Text style={styles.fullText}>{fullText}</Text>
          </ScrollView>
        ) : null}
        <View style={styles.controls}>
          <Pressable onPress={() => void copy()} disabled={!fullText} accessibilityRole="button" accessibilityLabel="Copy translation" style={[styles.side, !fullText && { opacity: 0.4 }]}>
            <Icon name="copy" size={20} color="#FFFFFF" />
            <Text style={styles.sideText}>Copy</Text>
          </Pressable>
          <PressScale onPress={onFreeze} accessibilityRole="button" accessibilityLabel={frozen ? 'Resume live view' : 'Freeze this frame'}>
            <LinearGradient colors={frozen ? ['#19E3FF', '#1F7BFF'] : [neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.big}>
              <Icon name={frozen ? 'play' : 'pause'} size={26} color="#FFFFFF" />
            </LinearGradient>
          </PressScale>
          <Pressable onPress={speak} disabled={!fullText} accessibilityRole="button" accessibilityLabel="Read the translation aloud" style={[styles.side, !fullText && { opacity: 0.4 }]}>
            <Icon name="volume-2" size={20} color="#FFFFFF" />
            <Text style={styles.sideText}>Speak</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{frozen ? 'Frozen · tap to go live again' : 'Live · tap to freeze'}</Text>
      </View>

      {/* Language picker */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: '#0E0D2C', borderColor: 'rgba(255,255,255,0.12)', paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.cols}>
            <View style={styles.col}>
              <Text style={styles.colTitle}>Read</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {[{ code: AUTO as SourceChoice, name: 'Auto (Latin script)' }, ...SOURCE_LANGS.map((l) => ({ code: l.code as SourceChoice, name: l.name }))].map((l) => (
                  <Pressable key={l.code} onPress={() => { setSource(l.code); setDetected(null); }} style={[styles.opt, source === l.code && { backgroundColor: neon.violet }]}>
                    <Text style={styles.optText}>{l.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.col}>
              <Text style={styles.colTitle}>Translate to</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {TARGET_LANGS.map((l) => (
                  <Pressable key={l.code} onPress={() => setTarget(l.code)} style={[styles.opt, target === l.code && { backgroundColor: neon.violet }]}>
                    <Text style={styles.optText}>{l.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
          <Text style={styles.sheetNote}>The camera can read Latin, Hindi/Marathi, Chinese, Japanese and Korean text. Each language is a one-time download of about 30 MB.</Text>
          <Pressable onPress={() => setPickerOpen(false)} accessibilityRole="button" style={[styles.done, { backgroundColor: neon.violet }]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  permTitle: { fontSize: 24, fontFamily: 'PlayfairDisplay_700Bold', marginTop: 16 },
  permText: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 22 },
  permBtn: { paddingHorizontal: 28, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  block: { position: 'absolute', backgroundColor: 'rgba(8,8,24,0.82)', borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1, justifyContent: 'center', overflow: 'hidden' },
  blockText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(8,8,24,0.6)', alignItems: 'center', justifyContent: 'center' },
  langPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 21, backgroundColor: 'rgba(8,8,24,0.6)', paddingHorizontal: 14 },
  langText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(8,8,24,0.6)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  statusText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', flexShrink: 1 },
  textBox: { maxHeight: 120, backgroundColor: 'rgba(8,8,24,0.72)', borderRadius: 14 },
  fullText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 34 },
  side: { alignItems: 'center', gap: 4, width: 56 },
  sideText: { color: '#FFFFFF', fontSize: 11.5, fontFamily: 'Inter_500Medium' },
  big: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  hint: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingTop: 10, maxHeight: '70%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 12 },
  cols: { flexDirection: 'row', gap: 12, height: 300 },
  col: { flex: 1 },
  colTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  opt: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  optText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_500Medium' },
  sheetNote: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginTop: 10 },
  done: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  doneText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
