import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fmtDate, fmtRupee, StatusBadge, SectionEmpty, LoadingBox, Card, SectionTitle, PrimaryBtn, InputRow, styles } from './shared';
import type { ImagePromotion, TabPropsWithUserAndRefresh, WalletTx } from './shared';
import { supabaseFetch } from '@/constants/supabase';

interface BankDetail {
  id: string;
  bank_name: string;
  bank_account_number: string;
  ifsc_code: string;
  account_holder_name: string;
}

interface PayoutRequest {
  id: string;
  requested_amount: number;
  status: string;
  bank_name: string;
  requested_at: string;
}

export function WalletTab({ celebrity, colors, session, user, onRefreshCeleb }: TabPropsWithUserAndRefresh) {
  const [banks, setBanks] = useState<BankDetail[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [txns, setTxns] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState<BankDetail | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', bank_account_number: '', ifsc_code: '', account_holder_name: '' });
  const [addingBank, setAddingBank] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!session?.access_token) { setLoading(false); return; }
    setLoading(true);
    try {
      const [bkRes, prRes, txRes, ipRes] = await Promise.all([
        supabaseFetch(`/rest/v1/bank_details?user_id=eq.${user?.profileId}&order=created_at.desc`, {}, session.access_token),
        supabaseFetch(`/rest/v1/payout_requests?celebrity_id=eq.${celebrity.id}&order=requested_at.desc&limit=20`, {}, session.access_token),
        supabaseFetch(`/rest/v1/celebrity_wallet_transactions?celebrity_id=eq.${celebrity.id}&order=created_at.desc&limit=50`, {}, session.access_token),
        supabaseFetch(`/rest/v1/image_promotions?celebrity_id=eq.${celebrity.id}&status=eq.completed&order=created_at.desc&limit=50`, {}, session.access_token),
      ]);
      if (bkRes.ok) { const r = await bkRes.json() as BankDetail[]; setBanks(r ?? []); if (r?.length > 0) setSelectedBank(r[0]); }
      if (prRes.ok) { const r = await prRes.json() as PayoutRequest[]; setPayouts(r ?? []); }
      const walletTxns: WalletTx[] = txRes.ok ? ((await txRes.json() as WalletTx[]) ?? []) : [];
      const ipRows: ImagePromotion[] = ipRes.ok ? ((await ipRes.json() as ImagePromotion[]) ?? []) : [];
      const virtualTxns: WalletTx[] = ipRows.map(ip => ({
        id: `ip-${ip.id}`,
        transaction_type: 'earning',
        amount: Math.round((ip.price_paid ?? 0) * 0.7),
        status: 'completed',
        description: 'Image promotion commission',
        created_at: ip.created_at,
      }));
      const merged = [...walletTxns, ...virtualTxns].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setTxns(merged);
    } catch {}
    setLoading(false);
  }, [celebrity.id, session?.access_token, user?.profileId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const submitPayout = async () => {
    if (!selectedBank) { Alert.alert('Select a bank account first'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    if (amt > (celebrity.available_balance ?? 0)) { Alert.alert('Insufficient balance'); return; }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setSubmitting(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/payout_requests',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({
            celebrity_id: celebrity.id,
            profile_id: user?.profileId,
            requested_amount: amt,
            bank_name: selectedBank.bank_name,
            bank_account_number: selectedBank.bank_account_number,
            ifsc_code: selectedBank.ifsc_code,
            account_holder_name: selectedBank.account_holder_name,
          }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to submit payout (${res.status})`);
      } else {
        Alert.alert('Success', 'Payout request submitted!');
        setAmount('');
        fetchAll();
        onRefreshCeleb();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit payout request');
    }
    setSubmitting(false);
  };

  const addBank = async () => {
    if (!bankForm.bank_name || !bankForm.bank_account_number || !bankForm.ifsc_code || !bankForm.account_holder_name) {
      Alert.alert('Fill all bank details'); return;
    }
    if (!session?.access_token) { Alert.alert('Not logged in'); return; }
    setAddingBank(true);
    try {
      const res = await supabaseFetch(
        '/rest/v1/bank_details',
        {
          method: 'POST',
          headers: { Prefer: 'return=minimal' } as Record<string, string>,
          body: JSON.stringify({ ...bankForm, user_id: user?.profileId }),
        },
        session.access_token,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, string>;
        Alert.alert('Error', err.message ?? `Failed to add bank (${res.status})`);
      } else {
        Alert.alert('Bank account added!');
        setShowAddBank(false);
        setBankForm({ bank_name: '', bank_account_number: '', ifsc_code: '', account_holder_name: '' });
        fetchAll();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add bank');
    }
    setAddingBank(false);
  };

  if (loading) return <LoadingBox />;

  const pendingClearance = txns.filter(tx => tx.status === 'pending').reduce((s, tx) => s + (tx.amount ?? 0), 0);

  return (
    <View style={styles.tabPad}>
      <LinearGradient colors={['#7B5CFA', '#1F7BFF']} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmt}>{fmtRupee(celebrity.available_balance ?? 0)}</Text>
        {pendingClearance > 0 && (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular' }}>Pending Clearance</Text>
            <Text style={{ color: '#FCD34D', fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 2 }}>{fmtRupee(pendingClearance)}</Text>
          </View>
        )}
      </LinearGradient>

      <SectionTitle text="Request Payout" colors={colors} />
      <Card colors={colors}>
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Select Bank Account</Text>
        {banks.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 8 }}>No bank accounts added</Text>
        ) : (
          banks.map(bk => (
            <TouchableOpacity
              key={bk.id}
              onPress={() => setSelectedBank(bk)}
              style={[styles.bankOption, { borderColor: selectedBank?.id === bk.id ? '#7B5CFA' : colors.border, backgroundColor: selectedBank?.id === bk.id ? '#7B5CFA10' : 'transparent' }]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{bk.bank_name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>****{bk.bank_account_number.slice(-4)} · {bk.account_holder_name}</Text>
            </TouchableOpacity>
          ))
        )}
        <InputRow label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" colors={colors} />
        <PrimaryBtn label="Submit Payout Request" onPress={submitPayout} loading={submitting} colors={colors} />

        <TouchableOpacity onPress={() => setShowAddBank(v => !v)} style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ color: '#7B5CFA', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            {showAddBank ? 'Cancel' : '+ Add Bank Account'}
          </Text>
        </TouchableOpacity>

        {showAddBank && (
          <View style={{ marginTop: 12 }}>
            <InputRow label="Bank Name" value={bankForm.bank_name} onChangeText={(v) => setBankForm(p => ({ ...p, bank_name: v }))} colors={colors} />
            <InputRow label="Account Number" value={bankForm.bank_account_number} onChangeText={(v) => setBankForm(p => ({ ...p, bank_account_number: v }))} keyboardType="number-pad" colors={colors} />
            <InputRow label="IFSC Code" value={bankForm.ifsc_code} onChangeText={(v) => setBankForm(p => ({ ...p, ifsc_code: v.toUpperCase() }))} colors={colors} />
            <InputRow label="Account Holder Name" value={bankForm.account_holder_name} onChangeText={(v) => setBankForm(p => ({ ...p, account_holder_name: v }))} colors={colors} />
            <PrimaryBtn label="Save Bank Account" onPress={addBank} loading={addingBank} colors={colors} />
          </View>
        )}
      </Card>

      <SectionTitle text="Payout History" colors={colors} />
      {payouts.length === 0 ? (
        <SectionEmpty icon="credit-card" text="No payout requests yet" colors={colors} />
      ) : (
        payouts.map(p => (
          <Card key={p.id} colors={colors}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{p.bank_name}</Text>
                <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(p.requested_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.priceText, { color: '#7B5CFA' }]}>{fmtRupee(p.requested_amount)}</Text>
                <StatusBadge status={p.status} />
              </View>
            </View>
          </Card>
        ))
      )}

      <SectionTitle text="Transaction History" colors={colors} />
      {txns.length === 0 ? (
        <SectionEmpty icon="trending-up" text="No transactions yet" colors={colors} />
      ) : (
        txns.map(tx => {
          const isCredit = ['credit', 'booking_payment', 'bonus'].includes(tx.transaction_type);
          return (
            <Card key={tx.id} colors={colors}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {tx.description || tx.transaction_type?.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{fmtDate(tx.created_at)}</Text>
                </View>
                <Text style={[styles.priceText, { color: isCredit ? '#22C55E' : '#EF4444' }]}>
                  {isCredit ? '+' : '-'}{fmtRupee(tx.amount)}
                </Text>
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}
