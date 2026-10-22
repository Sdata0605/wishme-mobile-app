import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/Icon';
import { QUOTE_DESIGNS, QuoteCard } from '@/components/home/QuoteCard';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { PressScale, Reveal } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';
import { todaysQuote } from '@/services/home/dailyQuote';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GAP = 14;

type Param = string | string[] | undefined;
const one = (p: Param) => (Array.isArray(p) ? p[0] : p) ?? '';

/**
 * The day's thought as pictures: one card per look, swiped through, each shareable on its own (the share sheet) and all
 * of them saveable to the gallery in one go. Opened by tapping the thought on Home. The cards are plain views
 * captured on the phone, so no network and nothing leaves the device until the user shares it.
 */
export default function QuoteCardsScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const params = useLocalSearchParams<{ q?: string }>();
  const quote = one(params.q) || todaysQuote();
  const date = useMemo(() => {
    const d = new Date();
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }, []);

  const cardW = Math.min(screenW - 48, 400);
  const stride = cardW + GAP;
  const sideInset = (screenW - cardW) / 2;

  const refs = useRef<(View | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [status, setStatus] = useState('');

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / stride);
      setIndex(Math.max(0, Math.min(QUOTE_DESIGNS.length - 1, i)));
    },
    [stride],
  );

  // The capture lands in a temp file with a random name; give it a readable one, which is what the gallery and the
  // share sheet show (WishMe-thought-midnight-2026-10-22.png).
  const capture = useCallback(async (i: number) => {
    const view = refs.current[i];
    if (!view) throw new Error('Card not ready');
    const tmp = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const named = `${FileSystem.cacheDirectory ?? ''}WishMe-thought-${QUOTE_DESIGNS[i].id}-${stamp}.png`;
    try {
      await FileSystem.deleteAsync(named, { idempotent: true });
      await FileSystem.moveAsync({ from: tmp, to: named });
      return named;
    } catch {
      return tmp;
    }
  }, []);

  const shareCurrent = async () => {
    if (busy) return;
    setBusy('share');
    setStatus('');
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This phone has no app to share the picture with.');
        return;
      }
      const uri = await capture(index);
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: "Share today's thought" });
    } catch {
      Alert.alert('Could not share', 'Something went wrong while making the picture. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const saveAll = async () => {
    if (busy) return;
    setBusy('save');
    setStatus('');
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission needed', 'Allow WishMe to add pictures to your gallery to save the cards.');
        return;
      }
      let saved = 0;
      for (let i = 0; i < QUOTE_DESIGNS.length; i++) {
        setStatus(`Saving ${i + 1} of ${QUOTE_DESIGNS.length}…`);
        const uri = await capture(i);
        await MediaLibrary.saveToLibraryAsync(uri);
        saved++;
      }
      setStatus(`Saved ${saved} pictures to your gallery. Share them from there, together or one by one.`);
    } catch {
      setStatus('');
      Alert.alert('Could not save', 'Something went wrong while saving the pictures. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <AmbientBackground>
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={[styles.round, { backgroundColor: neon.glass, borderColor: neon.cardBorder }]}
          >
            <Icon name="chevron-left" size={22} color={neon.textHi} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: neon.textHi }]}>Today's thought</Text>
            <Text style={[styles.sub, { color: neon.textLo }]}>Swipe for a look, then share it or save them all.</Text>
          </View>
        </View>

        <Reveal delayMs={40} style={{ flex: 1, justifyContent: 'center' }}>
          <FlatList
            data={QUOTE_DESIGNS}
            keyExtractor={(d) => d.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={stride}
            decelerationRate="fast"
            onMomentumScrollEnd={onScrollEnd}
            contentContainerStyle={{ paddingHorizontal: sideInset, gap: GAP, alignItems: 'center' }}
            // Every card stays mounted so "Save all" can capture each one.
            initialNumToRender={QUOTE_DESIGNS.length}
            windowSize={QUOTE_DESIGNS.length + 1}
            removeClippedSubviews={false}
            renderItem={({ item, index: i }) => (
              <View style={styles.shadow}>
                <QuoteCard ref={(v) => { refs.current[i] = v; }} quote={quote} date={date} design={item} width={cardW} />
              </View>
            )}
          />
          <View style={styles.dots}>
            {QUOTE_DESIGNS.map((d, i) => (
              <View key={d.id} style={[styles.dot, { backgroundColor: i === index ? neon.pink : neon.cardBorder, width: i === index ? 18 : 6 }]} />
            ))}
          </View>
          <Text style={[styles.look, { color: neon.textLo }]}>{QUOTE_DESIGNS[index]?.name}</Text>
        </Reveal>

        <View style={styles.actions}>
          <PressScale onPress={shareCurrent} disabled={busy !== null} accessibilityRole="button" accessibilityLabel="Share this picture" style={{ flex: 1 }}>
            <LinearGradient colors={[neon.blue, neon.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.btn, busy === 'share' && { opacity: 0.6 }]}>
              <Icon name="share-2" size={18} color="#FFFFFF" />
              <Text style={styles.btnText}>{busy === 'share' ? 'Making…' : 'Share'}</Text>
            </LinearGradient>
          </PressScale>
          <PressScale onPress={saveAll} disabled={busy !== null} accessibilityRole="button" accessibilityLabel="Save all pictures to the gallery" style={{ flex: 1 }}>
            <View style={[styles.btn, { backgroundColor: neon.glass, borderWidth: 1.4, borderColor: neon.cardBorder }, busy === 'save' && { opacity: 0.6 }]}>
              <Icon name="download" size={18} color={neon.textHi} />
              <Text style={[styles.btnText, { color: neon.textHi }]}>{busy === 'save' ? 'Saving…' : `Save all ${QUOTE_DESIGNS.length}`}</Text>
            </View>
          </PressScale>
        </View>
        {status ? <Text style={[styles.status, { color: neon.textLo }]}>{status}</Text> : null}
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
  sub: { fontSize: 13.5, fontFamily: 'Inter_400Regular', marginTop: 2 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  dot: { height: 6, borderRadius: 3 },
  look: { textAlign: 'center', fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 8 },
  btn: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  status: { textAlign: 'center', fontSize: 13, fontFamily: 'Inter_400Regular', paddingHorizontal: 28, marginTop: 12 },
});
