import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_LOVED_ONES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

export default function LovedOnesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(MOCK_LOVED_ONES);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Loved Ones</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 20 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.relation, { color: colors.mutedForeground }]}>{item.relation}</Text>
              {item.birthday && (
                <View style={styles.dateRow}>
                  <Icon name="gift" size={12} color={colors.primary} />
                  <Text style={[styles.dateText, { color: colors.mutedForeground }]}>Birthday: {item.birthday}</Text>
                </View>
              )}
              {item.anniversary && (
                <View style={styles.dateRow}>
                  <Icon name="heart" size={12} color="#E8527A" />
                  <Text style={[styles.dateText, { color: colors.mutedForeground }]}>Anniversary: {item.anniversary}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>
              <Icon name="trash-2" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      />
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => {}}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, padding: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  relation: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  dateText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fab: { position: 'absolute', bottom: 32, right: 24, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6B33', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
});
