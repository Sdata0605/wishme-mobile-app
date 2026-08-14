import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  Flashlight,
  Keyboard,
  QrCode,
  Wallet,
  X,
  Zap,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { supabaseFetch } from '@/constants/supabase';
import { useTheme } from '@/context/ThemeContext';

type Step = 'scan' | 'confirm' | 'success';

export interface ScanPayPayload {
  raw: string;
  payeeId: string;
  payeeName: string;
  amount: number | null;
  note: string;
}

function parseScanPayload(raw: string): ScanPayPayload {
  const trimmed = raw.trim();
  const empty: ScanPayPayload = {
    raw: trimmed,
    payeeId: trimmed,
    payeeName: 'Merchant',
    amount: null,
    note: '',
  };

  try {
    if (/^upi:\/\//i.test(trimmed)) {
      const qIndex = trimmed.indexOf('?');
      const query = qIndex >= 0 ? trimmed.slice(qIndex + 1) : '';
      const params = new URLSearchParams(query);
      const pa = params.get('pa') || params.get('PA') || '';
      const pn = params.get('pn') || params.get('PN') || 'Merchant';
      const amRaw = params.get('am') || params.get('AM') || '';
      const tn = params.get('tn') || params.get('TN') || '';
      const am = amRaw ? Number(amRaw) : NaN;
      return {
        raw: trimmed,
        payeeId: pa || trimmed,
        payeeName: decodeURIComponent(pn.replace(/\+/g, ' ')),
        amount: Number.isFinite(am) && am > 0 ? Math.round(am) : null,
        note: tn ? decodeURIComponent(tn.replace(/\+/g, ' ')) : '',
      };
    }

    // Plain UPI id
    if (/^[\w.\-]+@[\w.\-]+$/.test(trimmed)) {
      return {
        ...empty,
        payeeId: trimmed,
        payeeName: trimmed.split('@')[0] || 'Merchant',
      };
    }

    // JSON-ish merchant payload
    if (trimmed.startsWith('{')) {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const amount = Number(obj.amount ?? obj.am ?? 0);
      return {
        raw: trimmed,
        payeeId: String(obj.upi ?? obj.pa ?? obj.payee ?? obj.id ?? 'merchant'),
        payeeName: String(obj.name ?? obj.pn ?? obj.payeeName ?? 'Merchant'),
        amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
        note: String(obj.note ?? obj.tn ?? ''),
      };
    }
  } catch {
    // fall through
  }

  return empty;
}

export function ScanPayScreen({
  onClose,
  walletBalance = 0,
  onBalanceChange,
}: {
  onClose: () => void;
  walletBalance?: number;
  onBalanceChange?: (next: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { colors: T } = useTheme();
  const { user, getValidSession, updateUser } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [scannedLock, setScannedLock] = useState(false);
  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [toast, setToast] = useState('');

  const [step, setStep] = useState<Step>('scan');
  const [payload, setPayload] = useState<ScanPayPayload | null>(null);
  const [amountText, setAmountText] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [txnId, setTxnId] = useState('');

  const balance = walletBalance;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const openConfirm = useCallback((raw: string) => {
    const parsed = parseScanPayload(raw);
    setPayload(parsed);
    setAmountText(parsed.amount != null ? String(parsed.amount) : '');
    setPayError('');
    setStep('confirm');
  }, []);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (scannedLock || step !== 'scan') return;
      setScannedLock(true);
      openConfirm(data);
      setTimeout(() => setScannedLock(false), 1500);
    },
    [scannedLock, step, openConfirm],
  );

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) {
      showToast('Enter a UPI ID or code');
      return;
    }
    setManualOpen(false);
    setManualCode('');
    openConfirm(code);
  };

  const amount = useMemo(() => {
    const n = Number(amountText.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }, [amountText]);

  const payFromWallet = async () => {
    if (!payload) return;
    if (!amount || amount <= 0) {
      setPayError('Enter a valid amount');
      return;
    }
    if (amount > balance) {
      setPayError('Insufficient wallet balance');
      return;
    }
    const profileId = user?.profileId;
    if (!profileId) {
      setPayError('Please sign in again');
      return;
    }

    setPaying(true);
    setPayError('');
    try {
      const session = await getValidSession();
      if (!session?.access_token) {
        setPayError('Session expired. Please sign in again.');
        return;
      }

      const res = await supabaseFetch(
        '/rest/v1/wallet_transactions',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' } as Record<string, string>,
          body: JSON.stringify({
            user_id: profileId,
            amount,
            transaction_type: 'service_payment',
            status: 'completed',
            payment_method: 'wallet',
            description: `Scan & Pay · ${payload.payeeName}`,
            transaction_details: {
              channel: 'scan_pay',
              payee_id: payload.payeeId,
              payee_name: payload.payeeName,
              note: payload.note || undefined,
              raw: payload.raw.slice(0, 500),
            },
          }),
        },
        session.access_token,
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        setPayError(errText || `Payment failed (${res.status})`);
        return;
      }

      const rows = (await res.json()) as Array<{ id?: string }>;
      const id = Array.isArray(rows) ? rows[0]?.id : undefined;

      // Refresh balance from profile (trigger deducts on completed debit types)
      const balRes = await supabaseFetch(
        `/rest/v1/profiles?select=wallet_balance&id=eq.${profileId}&limit=1`,
        {},
        session.access_token,
      );
      let nextBal = Math.max(0, balance - amount);
      if (balRes.ok) {
        const prow = (await balRes.json()) as Array<{ wallet_balance: number }>;
        if (prow?.[0]?.wallet_balance != null) {
          nextBal = Number(prow[0].wallet_balance);
        }
      }
      updateUser({ walletBalance: nextBal });
      onBalanceChange?.(nextBal);
      setPaidAmount(amount);
      setTxnId(id ? String(id).slice(0, 8).toUpperCase() : `SP${Date.now().toString().slice(-6)}`);
      setStep('success');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPaying(false);
    }
  };

  const cameraReady = permission?.granted && Platform.OS !== 'web';

  if (step === 'success' && payload) {
    return (
      <View style={[st.root, { backgroundColor: '#0A0920', paddingTop: topPad + 40 }]}>
        <View style={st.successWrap}>
          <CheckCircle2 size={56} color="#22C55E" />
          <Text style={st.successTitle}>Payment Successful</Text>
          <Text style={st.successSub}>
            Paid ₹{paidAmount.toLocaleString('en-IN')} to {payload.payeeName}
          </Text>
          <View style={st.successCard}>
            <Text style={st.successMeta}>To · {payload.payeeId}</Text>
            <Text style={st.successMeta}>Txn · {txnId}</Text>
            <Text style={st.successBal}>
              Wallet left · ₹{balance.toLocaleString('en-IN')}
            </Text>
          </View>
          <TouchableOpacity
            style={[st.primaryBtn, { backgroundColor: T.orange }]}
            onPress={() => {
              setPayload(null);
              setAmountText('');
              setStep('scan');
            }}
          >
            <Text style={st.primaryBtnText}>Scan Another</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.ghostBtn} onPress={onClose}>
            <Text style={st.ghostBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'confirm' && payload) {
    return (
      <View style={[st.root, { backgroundColor: '#0A0920', paddingTop: topPad + 12 }]}>
        <View style={st.confirmTop}>
          <TouchableOpacity
            style={st.roundBtn}
            onPress={() => {
              setStep('scan');
              setPayload(null);
              setPayError('');
            }}
          >
            <X size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.topTitle}>Confirm Payment</Text>
          <View style={{ width: 42 }} />
        </View>

        <View style={st.confirmBody}>
          <View style={st.payeeCard}>
            <QrCode size={28} color={T.orange} />
            <Text style={st.payeeName}>{payload.payeeName}</Text>
            <Text style={st.payeeId}>{payload.payeeId}</Text>
            {!!payload.note && <Text style={st.payeeNote}>{payload.note}</Text>}
          </View>

          <Text style={st.amountLabel}>Amount (₹)</Text>
          <TextInput
            style={st.amountInput}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.35)"
            editable={payload.amount == null}
          />
          {payload.amount != null && (
            <Text style={st.amountHint}>Amount fixed from QR</Text>
          )}

          <View style={st.walletRow}>
            <Wallet size={16} color={balance >= amount && amount > 0 ? '#22C55E' : '#EF4444'} />
            <Text
              style={[
                st.walletText,
                { color: balance >= amount && amount > 0 ? '#22C55E' : '#EF4444' },
              ]}
            >
              Wallet · ₹{balance.toLocaleString('en-IN')}
            </Text>
          </View>

          {!!payError && <Text style={st.errorText}>{payError}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={paying}
            onPress={() => void payFromWallet()}
          >
            <LinearGradient
              colors={['#FF6B33', '#B44CFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[st.payBtn, paying && { opacity: 0.7 }]}
            >
              {paying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Zap size={18} color="#fff" />
                  <Text style={st.payBtnText}>
                    Pay ₹{amount > 0 ? amount.toLocaleString('en-IN') : '0'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: '#0A0920' }]}>
      {cameraReady ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scannedLock || step !== 'scan' ? undefined : handleBarcode}
        />
      ) : (
        <View style={[st.fallback, { paddingTop: topPad + 80 }]} pointerEvents="box-none">
          <QrCode size={72} color={T.orange} />
          <Text style={st.fallbackTitle}>QR Scanner</Text>
          <Text style={st.fallbackSub}>
            {!permission
              ? 'Checking camera permission…'
              : !permission.granted
                ? 'Camera access is needed to scan QR codes.'
                : 'Live camera works in Expo Go on a phone. You can also enter a UPI ID below.'}
          </Text>
          {permission && !permission.granted && (
            <TouchableOpacity
              style={[st.permBtn, { backgroundColor: T.orange }]}
              onPress={requestPermission}
            >
              <Text style={st.permBtnText}>Allow Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={st.overlay} pointerEvents="box-none">
        <View style={[st.topBar, { paddingTop: topPad + 8 }]} pointerEvents="box-none">
          <TouchableOpacity style={st.roundBtn} onPress={onClose}>
            <X size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.topTitle}>Scan & Pay</Text>
          <TouchableOpacity
            style={st.roundBtn}
            onPress={() => setTorch((v) => !v)}
            disabled={!cameraReady}
          >
            <Flashlight size={20} color={torch ? T.orange : '#fff'} />
          </TouchableOpacity>
        </View>

        <View style={st.frameWrap} pointerEvents="none">
          <View style={st.frame}>
            <View style={[st.corner, st.tl]} />
            <View style={[st.corner, st.tr]} />
            <View style={[st.corner, st.bl]} />
            <View style={[st.corner, st.br]} />
          </View>
          <Text style={st.hint}>Align QR code · pay from wallet</Text>
        </View>

        <View style={[st.bottom, { paddingBottom: insets.bottom + 24 }]}>
          <View style={st.balanceChip}>
            <Wallet size={14} color="#fff" />
            <Text style={st.balanceChipText}>
              Wallet ₹{balance.toLocaleString('en-IN')}
            </Text>
          </View>

          {manualOpen ? (
            <View style={st.manualBox}>
              <Text style={st.manualLabel}>Enter UPI ID or payment code</Text>
              <TextInput
                style={st.manualInput}
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="name@upi"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={st.manualActions}>
                <TouchableOpacity
                  style={st.manualCancel}
                  onPress={() => setManualOpen(false)}
                >
                  <Text style={st.manualCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.manualPay, { backgroundColor: T.orange }]}
                  onPress={submitManual}
                >
                  <Zap size={16} color="#fff" />
                  <Text style={st.manualPayText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={st.manualBtn}
              onPress={() => setManualOpen(true)}
              activeOpacity={0.85}
            >
              <Keyboard size={18} color="#fff" />
              <Text style={st.manualBtnText}>Enter code manually</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!!toast && (
        <View style={st.toast} pointerEvents="none">
          <Text style={st.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const FRAME = 240;

const st = StyleSheet.create({
  root: { flex: 1 },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: '#0A0920',
  },
  fallbackTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 8 },
  fallbackSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  permBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  confirmTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  frameWrap: { alignItems: 'center', gap: 16 },
  frame: { width: FRAME, height: FRAME, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#F97316' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  hint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  bottom: { paddingHorizontal: 20, gap: 12 },
  balanceChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  balanceChipText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  manualBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  manualBox: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  manualLabel: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  manualInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  manualActions: { flexDirection: 'row', gap: 10 },
  manualCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  manualCancelText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
  manualPay: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  manualPayText: { color: '#fff', fontFamily: 'Inter_700Bold' },
  toast: {
    position: 'absolute',
    bottom: 120,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  confirmBody: { paddingHorizontal: 20, gap: 12 },
  payeeCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  payeeName: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 8 },
  payeeId: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  payeeNote: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  amountLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Inter_500Medium' },
  amountInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    color: '#fff',
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  amountHint: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  walletText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  errorText: { color: '#F87171', fontSize: 13, fontFamily: 'Inter_500Medium' },
  payBtn: {
    height: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  payBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  successWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 40 },
  successTitle: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 16 },
  successSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  successCard: {
    width: '100%',
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  successMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  successBal: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 6 },
  primaryBtn: {
    marginTop: 28,
    width: '100%',
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  ghostBtn: { marginTop: 12, padding: 12 },
  ghostBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
