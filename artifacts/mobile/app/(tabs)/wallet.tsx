import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { useWallet } from '@/hooks/useWallet';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { WALLET_TABS, styles } from '@/components/wallet/shared';
import type { WalletTab } from '@/components/wallet/shared';
import { TransactionsTab } from '@/components/wallet/TransactionsTab';
import { ReferralEarningsTab } from '@/components/wallet/ReferralEarningsTab';
import { DepositModal, useDeposit } from '@/components/wallet/DepositModal';
import { WithdrawModal, useWithdraw } from '@/components/wallet/WithdrawModal';

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const bottomPad = insets.bottom + 20;
  const [activeTab, setActiveTab] = useState<WalletTab>('Transactions');

  const { balance, refetch } = useWallet();
  const agentPrefill = useAgentPrefill();

  const deposit = useDeposit({ user, session, refetch });
  const withdraw = useWithdraw({ user, session });

  // Agent: auto-open deposit modal and pre-fill amount
  useEffect(() => {
    if (agentPrefill.addAmount) {
      deposit.setDepositAmt(String(agentPrefill.addAmount));
      deposit.setDepositModal(true);
    }
  }, [agentPrefill.addAmount]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AmbientBackground><View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never))}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallet</Text>
        <View style={{ width: 22 }} />
      </View>

      <LinearGradient
        colors={['#7B5CFA', '#1F7BFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroBalanceLabel}>Total Balance</Text>
        <Text style={styles.heroBalanceAmt}>₹{balance.toLocaleString('en-IN')}</Text>

        <View style={styles.heroActionRow}>
          <TouchableOpacity
            style={styles.heroActionBtn}
            onPress={() => deposit.setDepositModal(true)}
            activeOpacity={0.85}
          >
            <Icon name="plus" size={15} color="#fff" />
            <Text style={styles.heroActionBtnText}>Add Money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.heroActionBtn}
            onPress={withdraw.openWithdrawModal}
            activeOpacity={0.85}
          >
            <Icon name="chevron-up" size={15} color="#fff" />
            <Text style={styles.heroActionBtnText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {WALLET_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab ? colors.primary : colors.mutedForeground },
                activeTab === tab && styles.tabLabelActive,
              ]}
            >
              {tab}
            </Text>
            {activeTab === tab && (
              <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Transactions' && (
        <TransactionsTab colors={colors} bottomPad={bottomPad} user={user} session={session} />
      )}
      {activeTab === 'Referral Earnings' && (
        <ReferralEarningsTab colors={colors} bottomPad={bottomPad} user={user} session={session} />
      )}

      {/* Deposit Modal */}
      <DepositModal deposit={deposit} balance={balance} colors={colors} />

      {/* Withdraw Modal */}
      <WithdrawModal withdraw={withdraw} user={user} colors={colors} />
    </View></AmbientBackground>
  );
}
