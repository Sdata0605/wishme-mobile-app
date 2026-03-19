import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_TRANSACTIONS } from '@/constants/mockData';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallet</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        ListHeaderComponent={() => (
          <>
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balance}>₹{user?.walletBalance?.toLocaleString('en-IN') ?? '0'}</Text>
              <View style={styles.addMoneyRow}>
                {['₹500', '₹1000', '₹2000', '₹5000'].map((amt) => (
                  <TouchableOpacity key={amt} style={styles.amtChip}>
                    <Text style={styles.amtChipText}>{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ Add Money</Text>
              </TouchableOpacity>
            </LinearGradient>
            <Text style={[styles.txTitle, { color: colors.foreground }]}>Transaction History</Text>
          </>
        )}
        data={MOCK_TRANSACTIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.txRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.txIcon, { backgroundColor: item.type === 'credit' ? '#22C55E20' : '#EF444420' }]}>
              <Feather
                name={item.type === 'credit' ? 'arrow-down-left' : 'arrow-up-right'}
                size={18}
                color={item.type === 'credit' ? '#22C55E' : '#EF4444'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.txDesc, { color: colors.foreground }]}>{item.desc}</Text>
              <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{item.date}</Text>
            </View>
            <Text style={[styles.txAmt, { color: item.type === 'credit' ? '#22C55E' : '#EF4444' }]}>
              {item.type === 'credit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
            </Text>
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
  balanceCard: { margin: 20, borderRadius: 20, padding: 24, alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  balance: { color: '#fff', fontSize: 42, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  addMoneyRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' },
  amtChip: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  amtChipText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  addBtn: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 9999 },
  addBtnText: { color: '#FF6B33', fontSize: 15, fontFamily: 'Inter_700Bold' },
  txTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', paddingHorizontal: 20, marginBottom: 8 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  txIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  txDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  txAmt: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
