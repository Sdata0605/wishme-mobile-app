import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

const CARDS = [
  { id: '1', emoji: '🎂', title: 'Birthday', gradient: ['#FF6B33', '#E8527A'] as const },
  { id: '2', emoji: '💕', title: 'Anniversary', gradient: ['#E8527A', '#B44CFF'] as const },
  { id: '3', emoji: '🎓', title: 'Graduation', gradient: ['#4B83FF', '#7B2FFF'] as const },
  { id: '4', emoji: '💍', title: 'Wedding', gradient: ['#FFB347', '#FF6B33'] as const },
  { id: '5', emoji: '🪷', title: 'Festival', gradient: ['#B44CFF', '#7B2FFF'] as const },
  { id: '6', emoji: '🎉', title: 'Celebration', gradient: ['#22C55E', '#4B83FF'] as const },
];

export default function GreetingCardsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Greeting Cards</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={CARDS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item.id)}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1, borderWidth: 2, borderColor: selected === item.id ? colors.primary : 'transparent' }]}
          >
            <LinearGradient colors={item.gradient as [string, string]} style={styles.cardGrad}>
              <Text style={styles.cardEmoji}>{item.emoji}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {selected === item.id && (
                <View style={styles.checkCircle}>
                  <Icon name="check" size={14} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </Pressable>
        )}
        ListFooterComponent={
          selected ? (
            <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 8 }]}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendBtn}>
                <Text style={styles.sendBtnText}>Send Greeting Card</Text>
              </LinearGradient>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  cardGrad: { height: 140, alignItems: 'center', justifyContent: 'center', gap: 8, position: 'relative' },
  cardEmoji: { fontSize: 40 },
  cardTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  checkCircle: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  sendBtn: { height: 52, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
