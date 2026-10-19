import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { fetchQuoteDay, indiaToday, type QuoteCard, type QuoteDay } from '@/services/home/quoteOfDay';

/**
 * THE DAY'S LINE AS PICTURES: a tap on the home quote opens this sheet — the line set over each of the server's pictures
 * (one set a day, shared by everyone), swiped through, shared as a PNG. A plain card drawn on the phone is always last, so
 * there is something to share even before the pictures exist or when the network is away.
 */

type Item = { kind: 'card'; card: QuoteCard } | { kind: 'making'; key: string } | { kind: 'plain' };

const POLL_MS = 8_000;
const POLL_FOR_MS = 5 * 60_000;

export function QuoteCardsSheet({
  visible,
  onClose,
  text,
  day,
  onDay,
}: {
  visible: boolean;
  onClose: () => void;
  text: string;
  day: QuoteDay | null;
  onDay: (d: QuoteDay) => void;
}) {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef(new Map<string, View | null>());

  // While the server is still making pictures, look again every few seconds — for five minutes at most.
  useEffect(() => {
    if (!visible) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const opened = Date.now();
    const look = async () => {
      const d = await fetchQuoteDay();
      if (stop) return;
      if (d) onDay(d);
      if (d?.status === 'generating' && Date.now() - opened < POLL_FOR_MS) timer = setTimeout(look, POLL_MS);
    };
    void look();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [visible, onDay]);

  useEffect(() => {
    if (!visible) {
      setPage(0);
      setError(null);
    }
  }, [visible]);

  const today = day && day.date === indiaToday() ? day : null;
  const cards = (today?.cards ?? []).filter((c) => !failed.has(c.url));
  const waiting = today?.status === 'generating' ? Math.max(0, Math.min(10, today.total - today.cards.length)) : 0;
  // Pictures, then placeholders for the ones still being made, then the plain card.
  const items: Item[] = [
    ...cards.map((card) => ({ kind: 'card' as const, card })),
    ...Array.from({ length: waiting }, (_, i) => ({ kind: 'making' as const, key: `making-${i}` })),
    { kind: 'plain' },
  ];
  const at = Math.min(page, items.length - 1);
  const current = items[at];
  const shareId = current.kind === 'card' ? current.card.style : current.kind === 'plain' ? 'plain' : null;
  const ready = current.kind === 'plain' || (current.kind === 'card' && loaded.has(current.card.url));
  const label = current.kind === 'card' ? current.card.label : current.kind === 'plain' ? 'Classic' : 'Creating';

  const cardW = Math.round(width * 0.82 - 16);
  const cardH = Math.round(cardW * 1.25);
  const step = cardW + 16;
  const side = (width - step) / 2;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / step);
    if (i !== page) setPage(i);
  };

  const share = useCallback(async () => {
    if (!shareId) return;
    const view = refs.current.get(shareId);
    if (!view) return;
    setSharing(true);
    setError(null);
    try {
      // 1080 px wide whatever the phone: the size WhatsApp and Instagram show without scaling.
      const uri = await captureRef(view, { format: 'png', quality: 1, width: 1080, height: 1350, result: 'tmpfile', fileName: `quote-${indiaToday()}-${shareId}` });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: "Share today's quote" });
    } catch {
      setError('The image could not be shared. Please try again.');
    } finally {
      setSharing(false);
    }
  }, [shareId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: neon.surface, paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <Text style={[styles.title, { color: neon.textHi }]}>Today&apos;s quote</Text>
          <Text style={[styles.sub, { color: neon.textLo }]}>Swipe to choose a style, then share it.</Text>

          <FlatList
            data={items}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={step}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: side }}
            style={{ height: cardH, flexGrow: 0, marginTop: 16 }}
            keyExtractor={(it) => (it.kind === 'card' ? it.card.style : it.kind === 'making' ? it.key : 'plain')}
            onScroll={onScroll}
            scrollEventThrottle={32}
            renderItem={({ item }) => (
              <View style={{ width: cardW, height: cardH, marginHorizontal: 8, borderRadius: 18, overflow: 'hidden' }}>
                {item.kind === 'making' ? (
                  <Making />
                ) : (
                  <View
                    ref={(v) => { refs.current.set(item.kind === 'card' ? item.card.style : 'plain', v); }}
                    collapsable={false}
                    style={StyleSheet.absoluteFill}
                  >
                    <QuoteArt
                      text={text}
                      card={item.kind === 'card' ? item.card : undefined}
                      width={cardW}
                      onLoad={(url) => setLoaded((s) => new Set(s).add(url))}
                      onError={(url) => setFailed((s) => new Set(s).add(url))}
                    />
                  </View>
                )}
              </View>
            )}
          />

          <View style={styles.dots}>
            {items.map((it, i) => (
              <View
                key={it.kind === 'card' ? it.card.style : it.kind === 'making' ? it.key : 'plain'}
                style={[styles.dot, { width: i === at ? 18 : 6, backgroundColor: i === at ? neon.violet : neon.textDim }]}
              />
            ))}
          </View>
          <Text style={[styles.label, { color: neon.textLo }]}>{label}</Text>
          {error ? <Text style={[styles.label, { color: neon.error }]}>{error}</Text> : null}

          <Pressable
            onPress={() => void share()}
            disabled={!shareId || !ready || sharing}
            accessibilityRole="button"
            accessibilityLabel="Share"
            style={({ pressed }) => [styles.shareWrap, { opacity: !shareId || !ready || sharing ? 0.5 : pressed ? 0.85 : 1 }]}
          >
            <LinearGradient colors={neon.gBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.share}>
              {sharing ? <ActivityIndicator size="small" color={neon.onInk} /> : <Icon name="share-2" size={20} color={neon.onInk} />}
              <Text style={[styles.shareText, { color: neon.onInk }]}>{sharing ? 'Preparing' : 'Share'}</Text>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The line set over a picture (or, with no card, over the app's own gradient). Sizes follow the card's width, so the
 * shared PNG looks the same as the card on screen.
 */
function QuoteArt({ text, card, width, onLoad, onError }: { text: string; card?: QuoteCard; width: number; onLoad: (url: string) => void; onError: (url: string) => void }) {
  const { neon } = useTheme();
  const size = width * (text.length > 90 ? 0.062 : text.length > 55 ? 0.072 : 0.085);
  const ink = card?.ink ?? '#FFFFFF';
  const light = card?.scrim === 'light';
  const lower = card?.place === 'lower';
  const serif = card?.font === 'serif';
  // A wash so the words read on any picture: darkest (or lightest) where the words are.
  const wash: [string, string, string] = light
    ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']
    : lower
      ? ['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.5)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.12)'];
  return (
    <View style={StyleSheet.absoluteFill}>
      {card ? (
        <Image
          source={{ uri: card.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          onLoad={() => onLoad(card.url)}
          onError={() => onError(card.url)}
        />
      ) : (
        <LinearGradient colors={neon.gBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={wash} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { paddingHorizontal: width * 0.1, justifyContent: lower ? 'flex-end' : 'center', paddingBottom: lower ? width * 0.2 : 0, alignItems: 'center' }]}>
        <View style={{ width: width * 0.12, height: Math.max(2, width * 0.008), marginBottom: width * 0.05, backgroundColor: ink, opacity: 0.85 }} />
        <Text
          style={{
            color: ink,
            fontSize: size,
            lineHeight: size * 1.32,
            textAlign: 'center',
            letterSpacing: 0.2,
            fontFamily: serif ? 'serif' : 'Inter_700Bold',
            fontWeight: serif ? '600' : undefined,
            textShadowColor: light ? 'transparent' : 'rgba(0,0,0,0.55)',
            textShadowRadius: light ? 0 : width * 0.03,
          }}
          allowFontScaling={false}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

/** A picture the server is still making. */
function Making() {
  const { neon } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: neon.surfaceHigh, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator size="small" color={neon.violet} />
      <Text style={[styles.label, { color: neon.textLo, marginTop: 10 }]}>Creating image</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, alignItems: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  dot: { height: 6, borderRadius: 3, marginHorizontal: 3 },
  label: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8, textAlign: 'center' },
  shareWrap: { alignSelf: 'stretch', marginHorizontal: 24, marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  share: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
