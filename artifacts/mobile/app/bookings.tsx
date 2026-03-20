import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_BOOKINGS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Pending: '#F59E0B',
  Cancelled: '#EF4444',
};

export default function BookingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Bookings</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={MOCK_BOOKINGS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); }} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.celebrityId } })}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <Image source={{ uri: item.celebrityImage }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.celeb, { color: colors.foreground }]}>{item.celebrityName}</Text>
              <Text style={[styles.occasion, { color: colors.mutedForeground }]}>{item.occasion} for {item.recipientName}</Text>
              <Text style={[styles.date, { color: colors.mutedForeground }]}>{item.date}</Text>
              <Text style={[styles.price, { color: colors.primary }]}>₹{item.price.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="calendar" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bookings yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Book your first celebrity wish</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 1, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  thumb: { width: 64, height: 64, borderRadius: 12 },
  celeb: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  occasion: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  date: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
