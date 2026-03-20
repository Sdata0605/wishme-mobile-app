import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_BOOKINGS } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Pending: '#F59E0B',
  Cancelled: '#EF4444',
};

export default function WishOrdersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Wish Orders</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={MOCK_BOOKINGS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 20 }}
        renderItem={({ item }) => {
          const sc = STATUS_COLORS[item.status] ?? '#6B7280';
          return (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Top row: image + info + status */}
              <View style={s.topRow}>
                <Image
                  source={{ uri: item.celebrityImage }}
                  style={s.celebImg}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={[s.celebName, { color: colors.foreground }]}>{item.celebrityName}</Text>
                  <Text style={[s.occasion, { color: colors.mutedForeground }]}>{item.occasion} · {item.date}</Text>
                  <Text style={[s.price, { color: colors.primary }]}>₹{item.price.toLocaleString('en-IN')}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: sc + '20' }]}>
                  <Text style={[s.statusText, { color: sc }]}>{item.status}</Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={s.actions}>
                {item.status === 'Completed' && (
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#22C55E15', borderColor: '#22C55E30' }]}>
                    <Icon name="download" size={14} color="#22C55E" />
                    <Text style={[s.actionBtnText, { color: '#22C55E' }]}>Download</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border, flex: item.status === 'Completed' ? 0 : 1 }]}
                  onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } } as never)}
                >
                  <Icon name="eye" size={14} color={colors.foreground} />
                  <Text style={[s.actionBtnText, { color: colors.foreground }]}>View</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  celebImg: { width: 64, height: 64, borderRadius: 12 },
  celebName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  occasion: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  price: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 10 },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
