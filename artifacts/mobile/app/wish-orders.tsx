import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_BOOKINGS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const STATUS_COLORS: Record<string, string> = { Completed: '#22C55E', Pending: '#F59E0B', Cancelled: '#EF4444' };

export default function WishOrdersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wish Orders</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={MOCK_BOOKINGS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.occasionIcon, { backgroundColor: colors.primary + '20' }]}>
              <Feather name="gift" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.celeb, { color: colors.foreground }]}>{item.celebrityName}</Text>
              <Text style={[styles.occasion, { color: colors.mutedForeground }]}>{item.occasion} · {item.date}</Text>
              <Text style={[styles.price, { color: colors.primary }]}>₹{item.price.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, padding: 14 },
  occasionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  celeb: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  occasion: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  price: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
