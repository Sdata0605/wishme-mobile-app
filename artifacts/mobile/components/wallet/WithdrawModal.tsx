/**
 * The "Withdraw" sheet. useWithdraw loads the celebrity's available balance and bank account when the sheet
 * opens and submits the payout request; WithdrawModal renders it (with the non-celebrity notice and the success
 * state). The screen calls the hook and passes its result down.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import { styles } from './shared';
import type { AuthSession, AuthUser, ColorsType } from './shared';

interface BankDetails {
  id: string;
  account_number: string;
  bank_name: string;
  ifsc_code: string;
  account_holder_name: string;
  is_default?: boolean;
}

export function useWithdraw({ user, session }: { user: AuthUser; session: AuthSession }) {
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [celebAvailableBalance, setCelebAvailableBalance] = useState<number>(0);
  const [celebId, setCelebId] = useState<string>('');
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  const openWithdrawModal = async () => {
    setWithdrawModal(true);
    setWithdrawSuccess(false);
    setWithdrawError('');
    setWithdrawAmt('');

    if (user?.role === 'celebrity') {
      setBankLoading(true);
      const profileId = user?.profileId ?? '';
      try {
        const [celebRes, bankRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/celebrities?profile_id=eq.${profileId}&select=id,available_balance&limit=1`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }),
          fetch(`${SUPABASE_URL}/rest/v1/bank_details?user_id=eq.${profileId}&order=is_default.desc&select=*&limit=1`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${session?.access_token}`,
            },
          }),
        ]);

        if (celebRes.ok) {
          const celebRows = await celebRes.json() as Array<{ id: string; available_balance: number }>;
          if (celebRows?.length) {
            setCelebId(celebRows[0].id);
            setCelebAvailableBalance(celebRows[0].available_balance ?? 0);
          }
        }

        if (bankRes.ok) {
          const bankRows = await bankRes.json() as BankDetails[];
          setBankDetails(bankRows?.length ? bankRows[0] : null);
        }
      } catch {}
      setBankLoading(false);
    }
  };

  const closeWithdrawModal = () => {
    setWithdrawModal(false);
    setWithdrawAmt('');
    setWithdrawError('');
    setWithdrawSuccess(false);
    setWithdrawLoading(false);
    setCelebAvailableBalance(0);
    setCelebId('');
    setBankDetails(null);
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmt, 10);
    if (!amount || amount <= 0) {
      setWithdrawError('Please enter a valid amount');
      return;
    }
    if (amount > celebAvailableBalance) {
      setWithdrawError(`Amount exceeds available balance of ₹${celebAvailableBalance}`);
      return;
    }
    if (!bankDetails) {
      setWithdrawError('No bank details found. Please add bank details in Edit Profile.');
      return;
    }

    setWithdrawLoading(true);
    setWithdrawError('');

    try {
      // One server call reserves the money and sends it to the bank account. It checks the amount against the
      // real balance, so the same money can never be sent twice.
      const payoutRes = await fetch(`${SUPABASE_URL}/functions/v1/celebrity-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          amount,
          bank_name: bankDetails.bank_name,
          account_number: bankDetails.account_number,
          ifsc_code: bankDetails.ifsc_code,
          account_holder_name: bankDetails.account_holder_name,
        }),
      });

      const out = await payoutRes.json().catch(() => ({})) as { error?: string; message?: string; available_balance?: number };
      if (!payoutRes.ok) {
        throw new Error(out.error || out.message || 'Failed to send the withdrawal. Please try again.');
      }
      if (typeof out.available_balance === 'number') setCelebAvailableBalance(out.available_balance);

      setWithdrawSuccess(true);
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : 'Request failed. Please try again.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  return {
    withdrawModal, withdrawAmt, setWithdrawAmt, withdrawLoading, withdrawError, setWithdrawError,
    withdrawSuccess, celebAvailableBalance, bankDetails, bankLoading,
    openWithdrawModal, closeWithdrawModal, handleWithdraw,
  };
}

export type WithdrawState = ReturnType<typeof useWithdraw>;

const maskAccount = (acc: string) => {
  if (!acc || acc.length < 4) return acc;
  return 'XXXX XXXX ' + acc.slice(-4);
};

export function WithdrawModal({ withdraw, user, colors }: { withdraw: WithdrawState; user: AuthUser; colors: ColorsType }) {
  const {
    withdrawModal, withdrawAmt, setWithdrawAmt, withdrawLoading, withdrawError, setWithdrawError,
    withdrawSuccess, celebAvailableBalance, bankDetails, bankLoading, closeWithdrawModal, handleWithdraw,
  } = withdraw;

  return (
    <Modal
      visible={withdrawModal}
      animationType="slide"
      transparent
      onRequestClose={closeWithdrawModal}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          {user?.role !== 'celebrity' ? (
            <>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Withdraw Funds</Text>
              <View style={styles.centeredSection}>
                <View style={[styles.infoIconCircle, { backgroundColor: '#FF6B3320' }]}>
                  <Icon name="info" size={32} color="#FF6B33" />
                </View>
                <Text style={[styles.infoText, { color: colors.foreground }]}>
                  Withdrawals are available for celebrity accounts. Regular users can use their wallet balance to book services.
                </Text>
                <TouchableOpacity
                  style={[styles.supportBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => Linking.openURL('mailto:support@wishme.today')}
                  activeOpacity={0.85}
                >
                  <Icon name="mail" size={16} color={colors.primary} />
                  <Text style={[styles.supportBtnText, { color: colors.primary }]}>Contact Support</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={closeWithdrawModal} style={styles.cancelLink}>
                <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Close</Text>
              </TouchableOpacity>
            </>
          ) : withdrawSuccess ? (
            <View style={styles.centeredSection}>
              <View style={styles.successIconCircle}>
                <Icon name="check" size={36} color="#fff" />
              </View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>Money is on its way!</Text>
              <Text style={[styles.infoText, { color: colors.mutedForeground, textAlign: 'center' }]}>
                Your withdrawal is being sent to your bank account. It usually arrives within minutes. You can follow it under Payout History in your dashboard.
              </Text>
              <TouchableOpacity
                onPress={closeWithdrawModal}
                style={{ marginTop: 24, borderRadius: 14, overflow: 'hidden', width: '100%' }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payBtn}
                >
                  <Text style={styles.payBtnText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Withdraw Funds</Text>

              {bankLoading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator color="#FF6B33" />
                </View>
              ) : (
                <>
                  <View style={[styles.celebBalanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Available Balance</Text>
                    <Text style={[styles.celebBalanceAmt, { color: '#22C55E' }]}>
                      ₹{celebAvailableBalance.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  {bankDetails ? (
                    <View style={[styles.bankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Bank Account</Text>
                      <Text style={[styles.bankName, { color: colors.foreground }]}>{bankDetails.bank_name}</Text>
                      <Text style={[styles.bankAcc, { color: colors.mutedForeground }]}>
                        {maskAccount(bankDetails.account_number)}
                      </Text>
                      <Text style={[styles.bankIfsc, { color: colors.mutedForeground }]}>
                        IFSC: {bankDetails.ifsc_code}
                      </Text>
                      <Text style={[styles.bankHolder, { color: colors.mutedForeground }]}>
                        {bankDetails.account_holder_name}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.bankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                        No bank details found.
                      </Text>
                      <TouchableOpacity onPress={() => { closeWithdrawModal(); router.push('/edit-profile' as never); }}>
                        <Text style={[styles.linkText, { color: colors.primary }]}>
                          Please add bank details in Edit Profile
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Amount to Withdraw</Text>
                  <View style={[styles.amtInputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Text style={[styles.amtCurrency, { color: colors.foreground }]}>₹</Text>
                    <TextInput
                      value={withdrawAmt}
                      onChangeText={(v) => { setWithdrawAmt(v.replace(/[^0-9]/g, '')); setWithdrawError(''); }}
                      keyboardType="numeric"
                      placeholder={`Max ₹${celebAvailableBalance.toLocaleString('en-IN')}`}
                      placeholderTextColor={colors.mutedForeground}
                      style={[styles.amtInput, { color: colors.foreground }]}
                    />
                  </View>

                  {withdrawError ? (
                    <Text style={styles.errorText}>{withdrawError}</Text>
                  ) : null}

                  <TouchableOpacity
                    onPress={handleWithdraw}
                    disabled={withdrawLoading || !bankDetails}
                    style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', opacity: !bankDetails ? 0.5 : 1 }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#FF6B33', '#B44CFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.payBtn}
                    >
                      {withdrawLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.payBtnText}>Request Withdrawal</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={closeWithdrawModal} style={styles.cancelLink}>
                    <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
