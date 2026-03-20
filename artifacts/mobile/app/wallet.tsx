import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MOCK_REFERRAL_EARNINGS, MOCK_TRANSACTIONS } from '@/constants/mockData';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const WALLET_TABS = ['Add Money', 'Transactions', 'Referral Earnings'] as const;
type WalletTab = (typeof WALLET_TABS)[number];

const QUICK_AMOUNTS = ['₹100', '₹500', '₹1,000', '₹2,000'];

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22C55E',
  Pending: '#F59E0B',
  Failed: '#EF4444',
};
const LEVEL_COLORS: Record<string, string> = { L1: '#FF6B33', L2: '#B44CFF' };

function AddMoneyTab({ balance, colors }: { balance: number; colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors'] }) {
  const [amount, setAmount] = useState('');
  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmt}>₹{balance.toLocaleString('en-IN')}</Text>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Enter Amount</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.rupeeSign, { color: colors.foreground }]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.amtInput, { color: colors.foreground }]}
          />
        </View>

        <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>Quick Add</Text>
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => setAmount(a.replace(/[₹,]/g, ''))}
              style={[styles.quickChip, { borderColor: colors.primary, backgroundColor: colors.background }]}
            >
              <Text style={[styles.quickChipText, { color: colors.primary }]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.razorpayBtn}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.razorpayGrad}>
            <View style={styles.razorpayInner}>
              <Icon name="credit-card" size={18} color="#fff" />
              <Text style={styles.razorpayText}>Add via Razorpay</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.safeNote, { color: colors.mutedForeground }]}>
          Secured by Razorpay · 256-bit SSL encrypted
        </Text>
      </View>
    </ScrollView>
  );
}

function TransactionsTab({ colors, bottomPad }: { colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']; bottomPad: number }) {
  return (
    <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      {MOCK_TRANSACTIONS.map((item) => (
        <View key={item.id} style={[styles.txRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.txIconCircle, { backgroundColor: item.type === 'credit' ? '#22C55E20' : '#EF444420' }]}>
            <Icon
              name={item.type === 'credit' ? 'arrow-down-left' : 'arrow-up-right'}
              size={18}
              color={item.type === 'credit' ? '#22C55E' : '#EF4444'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.txTopRow}>
              <Text style={[styles.txDesc, { color: colors.foreground }]}>{item.desc}</Text>
              <View style={[styles.typeBadge, { backgroundColor: item.type === 'credit' ? '#22C55E20' : '#EF444420' }]}>
                <Text style={[styles.typeBadgeText, { color: item.type === 'credit' ? '#22C55E' : '#EF4444' }]}>
                  {item.type === 'credit' ? 'Credit' : 'Debit'}
                </Text>
              </View>
            </View>
            <View style={styles.txBottomRow}>
              <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{item.date}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.txAmt, { color: item.type === 'credit' ? '#22C55E' : '#EF4444' }]}>
            {item.type === 'credit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ReferralEarningsTab({ colors, bottomPad }: { colors: ReturnType<typeof import('@/context/ThemeContext').useTheme>['colors']; bottomPad: number }) {
  const total = MOCK_REFERRAL_EARNINGS.filter((r) => r.status === 'Completed').reduce((s, r) => s + r.amount, 0);
  return (
    <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#7B2FFF', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.refEarningCard}>
        <Text style={styles.balanceLabel}>Total Referral Earnings</Text>
        <Text style={styles.balanceAmt}>₹{total.toLocaleString('en-IN')}</Text>
        <Text style={[styles.balanceLabel, { marginTop: 4 }]}>Credited to wallet</Text>
      </LinearGradient>

      {MOCK_REFERRAL_EARNINGS.map((item) => (
        <View key={item.id} style={[styles.refRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={styles.refTopRow}>
              <Text style={[styles.txDesc, { color: colors.foreground }]}>Booking #{item.bookingId}</Text>
              <View style={[styles.levelBadge, { backgroundColor: LEVEL_COLORS[item.level] + '20' }]}>
                <Text style={[styles.levelText, { color: LEVEL_COLORS[item.level] }]}>{item.level}</Text>
              </View>
            </View>
            <View style={styles.txBottomRow}>
              <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{item.date}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.txAmt, { color: '#22C55E' }]}>+₹{item.amount}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = insets.bottom + 20;
  const [activeTab, setActiveTab] = useState<WalletTab>('Add Money');
  const balance = user?.walletBalance ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallet</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {WALLET_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.mutedForeground },
              activeTab === tab && styles.tabLabelActive,
            ]}>
              {tab}
            </Text>
            {activeTab === tab && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Add Money' && <AddMoneyTab balance={balance} colors={colors} />}
      {activeTab === 'Transactions' && <TransactionsTab colors={colors} bottomPad={bottomPad} />}
      {activeTab === 'Referral Earnings' && <ReferralEarningsTab colors={colors} bottomPad={bottomPad} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative',
  },
  tabItemActive: {},
  tabLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  tabLabelActive: { fontFamily: 'Inter_700Bold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },
  tabContent: { padding: 16, gap: 12 },
  balanceCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 4 },
  refEarningCard: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  balanceAmt: { color: '#fff', fontSize: 38, fontFamily: 'Inter_700Bold' },
  card: { borderRadius: 16, padding: 20, borderWidth: 1, gap: 12 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, height: 52, gap: 4,
  },
  rupeeSign: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  amtInput: { flex: 1, fontSize: 24, fontFamily: 'Inter_700Bold' },
  quickLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, borderWidth: 1.5 },
  quickChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  razorpayBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  razorpayGrad: { paddingVertical: 15 },
  razorpayInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  razorpayText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  safeNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14,
    padding: 14, borderWidth: 1,
  },
  txIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  txTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  txBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txDesc: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flex: 1 },
  txDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  txAmt: { fontSize: 15, fontFamily: 'Inter_700Bold', minWidth: 60, textAlign: 'right' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  typeBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  refRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14,
    padding: 14, borderWidth: 1,
  },
  refTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  levelText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});
