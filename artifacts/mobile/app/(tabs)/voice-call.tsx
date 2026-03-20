import { LinearGradient } from 'expo-linear-gradient';
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
import { CELEBRITIES } from '@/constants/mockData';
import { useTheme } from '@/context/ThemeContext';

export default function VoiceCallScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'available' | 'scheduled'>('available');
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const available = CELEBRITIES.filter((c) => c.isAvailable);
  const scheduled = CELEBRITIES.filter((c) => !c.isAvailable).slice(0, 3);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#FF6B33', '#FF8C42', '#FFB347']}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <Text style={styles.headerTitle}>Celebrity Voice Calls</Text>
        <Text style={styles.headerSub}>Live 1-on-1 calls with your favorite stars</Text>
        <View style={[styles.featuredBanner, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Icon name="phone-call" size={18} color="#fff" />
          <Text style={styles.featuredText}>Book a 1-on-1 live call with your favorite celebrity</Text>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
        {(['available', 'scheduled'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, {
              color: activeTab === tab ? colors.primary : colors.mutedForeground,
              fontFamily: activeTab === tab ? 'Inter_600SemiBold' : 'Inter_400Regular',
            }]}>
              {tab === 'available' ? 'Available Now' : 'Scheduled'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={activeTab === 'available' ? available : scheduled}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={[styles.callCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardLeft}>
              <View style={styles.avatarWrap}>
                <Image source={{ uri: item.imageUrl }} style={styles.avatar} />
                {item.isAvailable && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.category, { color: colors.mutedForeground }]}>{item.category}</Text>
                <View style={styles.rateRow}>
                  <Icon name="clock" size={12} color={colors.primary} />
                  <Text style={[styles.rate, { color: colors.primary }]}>₹{item.ratePerMinute}/min</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardRight}>
              <View style={[styles.statusBadge, { backgroundColor: item.isAvailable ? '#22C55E20' : '#F59E0B20' }]}>
                <View style={[styles.statusDot, { backgroundColor: item.isAvailable ? '#22C55E' : '#F59E0B' }]} />
                <Text style={[styles.statusText, { color: item.isAvailable ? '#22C55E' : '#F59E0B' }]}>
                  {item.isAvailable ? 'Live' : 'Busy'}
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.8}>
                <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callBtn}>
                  <Icon name="phone" size={14} color="#fff" />
                  <Text style={styles.callBtnText}>{item.isAvailable ? 'Call Now' : 'Schedule'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="phone-off" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No calls available</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Check back soon</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', marginBottom: 6 },
  headerSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginBottom: 14 },
  featuredBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  featuredText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { fontSize: 14 },
  callCard: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  category: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rate: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  callBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
