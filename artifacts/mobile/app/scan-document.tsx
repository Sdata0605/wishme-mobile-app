import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DocumentScanner, { ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';
import { DOCUMENTS_DIR, shareDocument } from '@/services/documents/render';
import { newDocumentId, saveContent, saveDocument } from '@/services/documents/store';
import { AUTO, readText } from '@/services/home/lens';

interface Page { uri: string; text: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Scan pages with the camera (Google's document scanner: finds the edges, straightens and cleans each page), read
 * their text on the phone, and make a PDF that is searchable because the text sits invisibly on each page. The PDF
 * is kept with the app's other documents.
 */
export default function ScanDocumentScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState<Page[]>([]);
  const [title, setTitle] = useState(`Scan ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`);
  const [busy, setBusy] = useState<'scan' | 'read' | 'pdf' | null>(null);
  const [saved, setSaved] = useState<{ uri: string; fileName: string; pageCount: number } | null>(null);

  const scan = async () => {
    setBusy('scan');
    try {
      const res = await DocumentScanner.scanDocument({ croppedImageQuality: 85 });
      if (res.status !== ScanDocumentResponseStatus.Success || !res.scannedImages?.length) return;
      setBusy('read');
      const fresh: Page[] = [];
      for (const uri of res.scannedImages) {
        let text = '';
        try { text = (await readText(uri, AUTO)).text; } catch { /* a page with no readable text is fine */ }
        fresh.push({ uri, text });
      }
      setPages((p) => [...p, ...fresh]);
      setSaved(null);
    } catch (e) {
      Alert.alert('Scanner unavailable', e instanceof Error ? e.message : 'The document scanner could not start. It needs Google Play services.');
    } finally {
      setBusy(null);
    }
  };

  const remove = (i: number) => setPages((p) => p.filter((_, k) => k !== i));

  const makePdf = async () => {
    if (!pages.length || !DOCUMENTS_DIR) return;
    setBusy('pdf');
    try {
      const parts: string[] = [];
      for (const p of pages) {
        const b64 = await FileSystem.readAsStringAsync(p.uri, { encoding: FileSystem.EncodingType.Base64 });
        parts.push(
          `<section class="page"><img src="data:image/jpeg;base64,${b64}" /><div class="ocr">${esc(p.text)}</div></section>`,
        );
      }
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        @page { margin: 0; } body { margin: 0; }
        .page { position: relative; width: 100vw; height: 100vh; page-break-after: always; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .page:last-child { page-break-after: auto; }
        img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .ocr { position: absolute; top: 0; left: 0; color: transparent; font-size: 2px; line-height: 2px; }
      </style></head><body>${parts.join('')}</body></html>`;
      const { uri, numberOfPages } = await Print.printToFileAsync({ html, base64: false });
      const id = newDocumentId();
      const safe = (title.trim() || 'Scan').replace(/[\\/:*?"<>|]+/g, ' ').trim();
      const fileName = `${safe}.pdf`;
      const dir = `${DOCUMENTS_DIR}${id}/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = `${dir}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      const info = await FileSystem.getInfoAsync(dest);
      const words = pages.reduce((n, p) => n + (p.text.match(/\S+/g)?.length ?? 0), 0);
      await saveDocument({
        id, title: safe, kind: 'notes', format: 'pdf', fileName, uri: dest,
        byteSize: info.exists && 'size' in info ? info.size ?? 0 : 0,
        pageCount: numberOfPages ?? pages.length, wordCount: words,
        topic: 'Scanned with the camera', createdAt: new Date().toISOString(),
      });
      await saveContent(id, {
        kind: 'notes', title: safe, subtitle: 'Scanned document',
        sections: pages.map((p, i) => ({ heading: `Page ${i + 1}`, body: p.text || '(no text found on this page)' })),
        sheet: null, wordCount: words,
      });
      setSaved({ uri: dest, fileName, pageCount: numberOfPages ?? pages.length });
    } catch (e) {
      Alert.alert('Could not make the PDF', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!saved) return;
    const r = await shareDocument({ uri: saved.uri, fileName: saved.fileName, format: 'pdf' });
    if (!r.ok) Alert.alert('Could not share', r.error);
  };

  const words = pages.reduce((n, p) => n + (p.text.match(/\S+/g)?.length ?? 0), 0);

  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
            <Icon name="chevron-left" size={22} color={neon.textHi} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: neon.textHi }]}>Scan a document</Text>
            <Text style={[styles.sub, { color: neon.textLo }]}>Pages are straightened and cleaned, the text is read on the phone, and the PDF is searchable.</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <PressScale onPress={() => void scan()} disabled={busy !== null} accessibilityRole="button">
            <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.bigBtn, busy && { opacity: 0.6 }]}>
              {busy === 'scan' || busy === 'read' ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="camera" size={20} color="#FFFFFF" />}
              <Text style={styles.bigBtnText}>{busy === 'read' ? 'Reading the pages…' : pages.length ? 'Scan more pages' : 'Scan pages'}</Text>
            </LinearGradient>
          </PressScale>

          {pages.length ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {pages.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={[styles.thumbWrap, { borderColor: neon.cardBorder }]}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                    <Text style={[styles.thumbLabel, { color: neon.textLo }]}>Page {i + 1}{p.text ? '' : ' · no text'}</Text>
                    <Pressable onPress={() => remove(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove page ${i + 1}`} style={styles.x}>
                      <Icon name="x" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              <Text style={[styles.sub, { color: neon.textLo }]}>{pages.length} page{pages.length === 1 ? '' : 's'} · {words} words read</Text>

              <View style={[styles.card, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                <Text style={[styles.label, { color: neon.textLo }]}>Document name</Text>
                <TextInput value={title} onChangeText={setTitle} style={[styles.input, { color: neon.textHi, borderColor: neon.cardBorder, backgroundColor: neon.surface }]} />
                {saved ? (
                  <>
                    <Text style={[styles.saved, { color: neon.success }]}>Saved to Documents: {saved.fileName} ({saved.pageCount} page{saved.pageCount === 1 ? '' : 's'}).</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <PressScale onPress={() => void share()} accessibilityRole="button" style={{ flex: 1 }}>
                        <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
                          <Icon name="share-2" size={16} color="#FFFFFF" /><Text style={styles.btnText}>Share PDF</Text>
                        </LinearGradient>
                      </PressScale>
                      <Pressable onPress={() => router.push('/documents' as never)} accessibilityRole="button" style={[styles.btn, { flex: 1, backgroundColor: neon.surface, borderWidth: 1, borderColor: neon.cardBorder }]}>
                        <Text style={[styles.btnText, { color: neon.textHi }]}>Open Documents</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <PressScale onPress={() => void makePdf()} disabled={busy !== null} accessibilityRole="button">
                    <LinearGradient colors={[neon.violet, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.btn, busy && { opacity: 0.6 }]}>
                      {busy === 'pdf' ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="download" size={16} color="#FFFFFF" />}
                      <Text style={styles.btnText}>{busy === 'pdf' ? 'Making the PDF…' : 'Make PDF'}</Text>
                    </LinearGradient>
                  </PressScale>
                )}
              </View>

              {pages.some((p) => p.text) ? (
                <View style={[styles.card, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}>
                  <Text style={[styles.label, { color: neon.textLo }]}>Text read</Text>
                  <Text style={[styles.raw, { color: neon.textLo }]} selectable numberOfLines={14}>{pages.map((p) => p.text).filter(Boolean).join('\n\n')}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.empty, { borderColor: neon.cardBorder }]}>
              <Icon name="layers" size={28} color={neon.textLo} />
              <Text style={[styles.sub, { color: neon.textLo, textAlign: 'center' }]}>Tap Scan pages. Point at a page and the scanner finds its edges; add as many pages as you need.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 18 },
  bigBtn: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  thumbWrap: { width: 110, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  thumb: { width: 110, height: 146 },
  thumbLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center', paddingVertical: 5 },
  x: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 20, borderWidth: 1.2, padding: 16, gap: 10 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_500Medium' },
  btn: { height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#FFFFFF', fontSize: 14.5, fontFamily: 'Inter_600SemiBold' },
  saved: { fontSize: 13.5, fontFamily: 'Inter_500Medium' },
  raw: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  empty: { borderWidth: 1, borderRadius: 18, borderStyle: 'dashed', padding: 22, alignItems: 'center', gap: 10 },
});
