import React, { useEffect } from 'react';
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { GradientText } from '@/components/neon/GradientText';
import { useTheme } from '@/context/ThemeContext';
import { ago, type Story } from '@/services/home/news';

/**
 * The headlines pop-up: shown over the assistant when the user asks for the news, so the assistant can say one line and the
 * list is read on screen. Same idea as MyAssistant's news panel. Tapping a headline opens the story on its own screen.
 */
export function NewsPanel({ topic, stories, onClose, onOpen }: { topic: string; stories: Story[]; onClose: () => void; onOpen: (s: Story) => void }) {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();

  // Android back closes the panel first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const title = topic ? `News · ${topic}` : 'Today’s headlines';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="news-panel">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={onClose} accessibilityLabel="Close the headlines" />
      <View style={[styles.sheet, { backgroundColor: neon.bg, borderColor: neon.line, paddingBottom: insets.bottom + 8 }]}>
        <View style={[styles.grab, { backgroundColor: neon.line }]} />
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <GradientText colors={[neon.cyan, neon.violet, neon.pink]} fontSize={22} fontFamily="PlayfairDisplay_700Bold">{title}</GradientText>
            <Text style={[styles.count, { color: neon.textDim }]}>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={22} color={neon.textLo} />
          </Pressable>
        </View>
        <FlatList
          data={stories}
          keyExtractor={(s, i) => `${s.url}${i}`}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: neon.line }} />}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => onOpen(item)} accessibilityRole="link" accessibilityLabel={item.title} style={styles.row}>
              <View style={[styles.num, { borderColor: neon.cyan }]}>
                <Text style={[styles.numText, { color: neon.cyan }]}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: neon.textHi }]} numberOfLines={3}>{item.title}</Text>
                <Text style={[styles.meta, { color: neon.textDim }]}>{item.source} · {ago(item.at)}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={neon.textDim} />
            </Pressable>
          )}
        />
        <View style={styles.foot}>
          <Icon name="audio-lines" size={15} color={neon.pink} />
          <Text style={[styles.footText, { color: neon.pink }]}>Tap a story to read it, or ask me anything about these</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  count: { fontSize: 12.5, fontFamily: 'Inter_500Medium', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  num: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  rowTitle: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 3 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  footText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
});
