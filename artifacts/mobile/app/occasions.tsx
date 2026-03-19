import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_OCCASIONS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const OCCASION_ICONS: Record<string, string> = {
  Birthday: 'gift',
  Anniversary: 'heart',
  Wedding: 'star',
  Graduation: 'award',
};
const OCCASION_COLORS: Record<string, string[]> = {
  Birthday: ['#FF6B33', '#E8527A'],
  Anniversary: ['#E8527A', '#B44CFF'],
  Wedding: ['#B44CFF', '#7B2FFF'],
  Graduation: ['#4B83FF', '#7B2FFF'],
};

export default function OccasionsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(MOCK_OCCASIONS);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Occasions</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <LinearGradient
            colors={(OCCASION_COLORS[item.type] ?? ['#FF6B33', '#B44CFF']) as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.card}
          >
            <View style={styles.cardLeft}>
              <View style={styles.iconCircle}>
                <Feather name={(OCCASION_ICONS[item.type] ?? 'calendar') as any} size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardPerson}>{item.person}</Text>
                <Text style={styles.cardDate}>{item.date}</Text>
              </View>
            </View>
            <View style={styles.daysLeft}>
              <Text style={styles.daysNum}>{item.daysLeft}</Text>
              <Text style={styles.daysLabel}>days</Text>
            </View>
          </LinearGradient>
        )}
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => {}}>
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  cardPerson: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  cardDate: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  daysLeft: { alignItems: 'center' },
  daysNum: { color: '#fff', fontSize: 28, fontFamily: 'Inter_700Bold' },
  daysLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6B33', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});
