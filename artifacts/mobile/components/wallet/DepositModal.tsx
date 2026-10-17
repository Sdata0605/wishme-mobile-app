/**
 * The "Add Money" sheet. useDeposit owns the deposit state machine (amount -> Razorpay checkout -> verify ->
 * record the transaction); DepositModal renders it. The screen calls the hook and passes its result down so the
 * agent prefill can open the sheet with an amount.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';
import { generateWMId, QUICK_AMOUNTS, styles } from './shared';
import type { AuthSession, AuthUser, ColorsType } from './shared';

export function useDeposit({ user, session, refetch }: { user: AuthUser; session: AuthSession; refetch: () => void }) {
  const [depositModal, setDepositModal] = useState(false);
  const [depositAmt, setDepositAmt] = useState('');
  const [depositStep, setDepositStep] = useState<'amount' | 'processing' | 'success'>('amount');
  const [depositPaymentId, setDepositPaymentId] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  const handleDeposit = async () => {
    const amount = parseInt(depositAmt, 10);
    if (!amount || amount < 100) {
      setDepositError('Minimum deposit is ₹100');
      return;
    }
    setDepositLoading(true);
    setDepositError('');

    const profileId = user?.profileId ?? '';
    const receipt = `wallet_${profileId}_${Date.now()}`.slice(0, 40);

    try {
      const orderRes = await fetch(`${SUPABASE_URL}/functions/v1/create-razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt,
          notes: { user_id: profileId, type: 'wallet_deposit' },
        }),
      });
      if (!orderRes.ok) throw new Error('Could not create payment order. Please try again.');
      const order = await orderRes.json() as { id: string; amount: number; key_id: string };

      setDepositStep('processing');
      const RazorpayCheckout = require('react-native-razorpay').default;
      const paymentData = await RazorpayCheckout.open({
        key: order.key_id,
        amount: order.amount,
        currency: 'INR',
        name: 'WishMe',
        description: 'Add money to wallet',
        order_id: order.id,
        prefill: {
          name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          email: user?.email ?? '',
          contact: user?.phone ?? '',
        },
        theme: { color: '#B026FF' },
      });

      const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify-razorpay-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          razorpay_order_id: paymentData.razorpay_order_id,
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_signature: paymentData.razorpay_signature,
        }),
      });
      const verifyData = await verifyRes.json() as { success?: boolean; wishme_payment_id?: string; error?: string };
      if (!verifyData.success) throw new Error(verifyData.error ?? 'Payment verification failed');

      const wmId = verifyData.wishme_payment_id ?? generateWMId();

      await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: profileId,
          transaction_type: 'deposit',
          amount,
          status: 'completed',
          payment_method: 'razorpay',
          description: `Wallet deposit of ₹${amount}`,
          transaction_details: {
            razorpay_order_id: paymentData.razorpay_order_id,
            razorpay_payment_id: paymentData.razorpay_payment_id,
          },
        }),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/payment_transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          wishme_payment_id: wmId,
          user_id: profileId,
          amount,
          payment_method: 'razorpay',
          service_type: 'deposit',
          razorpay_payment_id: paymentData.razorpay_payment_id,
          razorpay_order_id: paymentData.razorpay_order_id,
          description: `Wallet deposit of ₹${amount}`,
          status: 'completed',
          paid_at: new Date().toISOString(),
        }),
      });

      setDepositPaymentId(wmId);
      setDepositStep('success');
      refetch();

    } catch (err: unknown) {
      const msg = (err as { description?: string })?.description;
      if (msg?.toLowerCase().includes('cancel')) {
        setDepositStep('amount');
        setDepositLoading(false);
        return;
      }
      setDepositError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setDepositStep('amount');
    } finally {
      setDepositLoading(false);
    }
  };

  const closeDepositModal = () => {
    setDepositModal(false);
    setDepositAmt('');
    setDepositStep('amount');
    setDepositPaymentId('');
    setDepositError('');
    setDepositLoading(false);
  };

  return {
    depositModal, setDepositModal, depositAmt, setDepositAmt, depositStep, depositPaymentId,
    depositError, setDepositError, depositLoading, handleDeposit, closeDepositModal,
  };
}

export type DepositState = ReturnType<typeof useDeposit>;

export function DepositModal({ deposit, balance, colors }: { deposit: DepositState; balance: number; colors: ColorsType }) {
  const {
    depositModal, depositAmt, setDepositAmt, depositStep, depositPaymentId,
    depositError, setDepositError, depositLoading, handleDeposit, closeDepositModal,
  } = deposit;

  return (
    <Modal
      visible={depositModal}
      animationType="slide"
      transparent
      onRequestClose={() => depositStep !== 'processing' && closeDepositModal()}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          {depositStep === 'amount' && (
            <>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Money to Wallet</Text>

              <View style={styles.modalBalanceRow}>
                <Icon name="wallet" size={14} color={colors.mutedForeground} />
                <Text style={[styles.modalBalanceText, { color: colors.mutedForeground }]}>
                  Current Balance: ₹{balance.toLocaleString('en-IN')}
                </Text>
              </View>

              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Quick Amount</Text>
              <View style={styles.chipsRow}>
                {QUICK_AMOUNTS.map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: depositAmt === String(amt) ? colors.primary : colors.card,
                        borderColor: depositAmt === String(amt) ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => { setDepositAmt(String(amt)); setDepositError(''); }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: depositAmt === String(amt) ? '#fff' : colors.foreground },
                      ]}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Or enter amount</Text>
              <View style={[styles.amtInputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.amtCurrency, { color: colors.foreground }]}>₹</Text>
                <TextInput
                  value={depositAmt}
                  onChangeText={(v) => { setDepositAmt(v.replace(/[^0-9]/g, '')); setDepositError(''); }}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.amtInput, { color: colors.foreground }]}
                />
              </View>

              {depositError ? (
                <Text style={styles.errorText}>{depositError}</Text>
              ) : null}

              <TouchableOpacity
                onPress={handleDeposit}
                disabled={depositLoading}
                style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden' }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#B026FF', '#FF5F1F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payBtn}
                >
                  {depositLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.payBtnText}>Pay Now</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={closeDepositModal} style={styles.cancelLink}>
                <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {depositStep === 'processing' && (
            <View style={styles.centeredSection}>
              <ActivityIndicator size="large" color="#B026FF" />
              <Text style={[styles.processingText, { color: colors.foreground }]}>Processing payment...</Text>
              <Text style={[styles.processingSubText, { color: colors.mutedForeground }]}>
                Please do not close this screen
              </Text>
            </View>
          )}

          {depositStep === 'success' && (
            <View style={styles.centeredSection}>
              <View style={styles.successIconCircle}>
                <Icon name="check" size={36} color="#fff" />
              </View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>Payment Successful!</Text>
              <Text style={[styles.successSubText, { color: colors.mutedForeground }]}>
                WishMe ID: {depositPaymentId}
              </Text>
              <Text style={[styles.successAmt, { color: '#22C55E' }]}>
                ₹{parseInt(depositAmt, 10).toLocaleString('en-IN')} added to wallet
              </Text>
              <TouchableOpacity
                onPress={closeDepositModal}
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
          )}
        </View>
      </View>
    </Modal>
  );
}
