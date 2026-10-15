import React, { useEffect, useMemo, useState } from 'react';
import { useAgentPrefill } from '@/context/AgentStateContext';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Search,
  X,
} from 'lucide-react-native';
import {
  providersFor,
  serviceMeta,
  type BillKind,
  type BillProvider,
} from './billData';

import { serviceColors as C } from './serviceColors';
import { T, useThemedStyles, glass, dockBar } from './themed';
import { BrandFill } from './BrandFill';

function ProviderPicker({
  visible,
  title,
  providers,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  providers: BillProvider[];
  selected?: BillProvider | null;
  onSelect: (p: BillProvider) => void;
  onClose: () => void;
}) {
  const md = use_md();
  const [q, setQ] = useState('');
  const filtered = providers.filter((p) =>
    `${p.name} ${p.state ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={md.backdrop}>
        <View style={md.sheet}>
          <View style={md.head}>
            <Text style={md.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color={T(C.text, 'fg')} />
            </TouchableOpacity>
          </View>
          <View style={md.search}>
            <Search size={14} color={T(C.gray, 'fg')} />
            <TextInput
              style={md.searchInput}
              placeholder="Search provider..."
              placeholderTextColor={T(C.gray, 'fg')}
              value={q}
              onChangeText={setQ}
            />
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {filtered.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={md.row}
                onPress={() => {
                  onSelect(p);
                  onClose();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={md.name}>{p.name}</Text>
                  {!!p.state && <Text style={md.state}>{p.state}</Text>}
                </View>
                {selected?.id === p.id && <Check size={18} color={T(C.green, 'fg')} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const make_md = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T(C.white, 'bg'),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'border'),
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 14,
    backgroundColor: T(C.lightGray, 'bg'),
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: T(C.text, 'fg'), padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: T(C.lightGray, 'border'),
  },
  name: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  state: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
});
const use_md = () => useThemedStyles(make_md);

export function BillPayScreen({
  kind,
  initialProviderId,
  onBack,
}: {
  kind: BillKind;
  /** A provider id from billData to pre-select (from a saved shortcut); an id that is not in this kind's list is ignored. */
  initialProviderId?: string;
  onBack: () => void;
}) {
  const st = use_st();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const meta = serviceMeta(kind);
  const agentPrefill = useAgentPrefill();

  const [mode, setMode] = useState<'boards' | 'apartments'>('boards');
  const [gasMode, setGasMode] = useState<'piped' | 'cylinder'>('piped');
  const [prepaid, setPrepaid] = useState(true);
  const [provider, setProvider] = useState<BillProvider | null>(
    () => providersFor(kind).find((p) => p.id === initialProviderId) ?? null,
  );
  const [consumerId, setConsumerId] = useState('');
  const [amount, setAmount] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'bill' | 'success'>('form');
  const [txnId] = useState(() => `WMB${Math.floor(100000 + Math.random() * 899999)}`);

  // Auto-fill from agent prefill
  useEffect(() => {
    if (agentPrefill.billConsumerNumber) setConsumerId(agentPrefill.billConsumerNumber);
  }, [agentPrefill.billConsumerNumber]);

  const isMobile = kind === 'mobile';
  const isElectricity = kind === 'electricity';
  const isGas = kind === 'gas';
  const needsAmount =
    (isMobile && prepaid) ||
    kind === 'dth' ||
    kind === 'fastag' ||
    (isGas && gasMode === 'cylinder');
  const isRechargeFlow = needsAmount;

  const providers = useMemo(
    () => providersFor(kind, isGas ? { gasMode } : undefined),
    [kind, isGas, gasMode],
  );

  const fetchedAmount = useMemo(() => {
    if (amount.trim()) return Number(amount.replace(/[^\d]/g, '')) || 0;
    // mock fetched bill
    const base = consumerId.length * 37 + (provider?.name.length ?? 10) * 19;
    return isGas && gasMode === 'cylinder' ? 1103 : 400 + (base % 2600);
  }, [amount, consumerId, provider, isGas, gasMode]);

  const canProceed =
    !!provider &&
    consumerId.trim().length >= (isMobile ? 10 : 5) &&
    (needsAmount ? Number(amount) > 0 || consumerId.length >= 10 : true);

  const onFetch = () => {
    if (!canProceed) return;
    if (needsAmount && !amount.trim()) {
      setAmount(
        String(
          isGas && gasMode === 'cylinder'
            ? 1103
            : 199 + (consumerId.length % 5) * 100,
        ),
      );
    }
    setStep('bill');
  };

  if (step === 'success') {
    return (
      <View style={[st.root, st.successWrap, { paddingTop: topPad + 40 }]}>
        <View style={st.successIcon}>
          <CheckCircle2 size={42} color={T(C.green, 'fg')} />
        </View>
        <Text style={st.successTitle}>Payment Successful</Text>
        <Text style={st.successSub}>
          Your {meta.title.toLowerCase()} payment was completed instantly.
        </Text>
        <View style={st.successCard}>
          <Text style={st.successLabel}>Transaction ID</Text>
          <Text style={st.successPnr}>{txnId}</Text>
          <View style={st.sep} />
          <Text style={st.successMeta}>{provider?.name}</Text>
          <Text style={st.successMeta}>{consumerId}</Text>
          <Text style={st.successAmount}>₹{fetchedAmount.toLocaleString('en-IN')}</Text>
        </View>
        <TouchableOpacity style={st.doneBtn} onPress={onBack}><BrandFill />
          <Text style={st.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'bill') {
    return (
      <View style={st.root}>
        <View style={[st.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => setStep('form')}>
            <ArrowLeft size={24} color={T(C.text, 'fg')} />
          </TouchableOpacity>
          <View>
            <Text style={st.headerTitle}>Confirm Payment</Text>
            <Text style={st.headerSub}>{meta.title}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <View style={st.billCard}>
            <View style={[st.billIcon, { backgroundColor: T(meta.bg, 'bg') }]}>
              <meta.Icon size={26} color={T(meta.color, 'fg')} />
            </View>
            <Text style={st.billProvider}>{provider?.name}</Text>
            <Text style={st.billId}>{consumerId}</Text>
            <View style={st.sep} />
            <Text style={st.billLabel}>Amount payable</Text>
            <Text style={st.billAmount}>₹{fetchedAmount.toLocaleString('en-IN')}</Text>
            <Text style={st.billDue}>Due by 12 Aug 2026 · No late fee if paid today</Text>
          </View>

          <View style={st.offerCard}>
            <Text style={st.offerTitle}>Apply WISH75</Text>
            <Text style={st.offerSub}>Get ₹75 cashback on this payment</Text>
          </View>
        </ScrollView>

        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View>
            <Text style={st.footerLabel}>Paying</Text>
            <Text style={st.footerPrice}>₹{fetchedAmount.toLocaleString('en-IN')}</Text>
          </View>
          <TouchableOpacity style={st.payBtn} onPress={() => setStep('success')}><BrandFill />
            <Text style={st.payText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <View style={[st.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color={T(C.text, 'fg')} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>{meta.title}</Text>
          <Text style={st.headerSub}>{meta.desc}</Text>
        </View>
        <View style={[st.headerIcon, { backgroundColor: T(meta.bg, 'bg') }]}>
          <meta.Icon size={18} color={T(meta.color, 'fg')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {isElectricity && (
          <View style={st.toggleRow}>
            {(['boards', 'apartments'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[st.toggle, mode === m && st.toggleOn]}
                onPress={() => setMode(m)}
              >
                <Text style={[st.toggleText, mode === m && st.toggleTextOn]}>
                  {m === 'boards' ? 'Electricity Boards' : 'Apartments'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isGas && (
          <View style={st.toggleRow}>
            <TouchableOpacity
              style={[st.toggle, gasMode === 'piped' && st.toggleOn]}
              onPress={() => {
                setGasMode('piped');
                setProvider(null);
                setAmount('');
              }}
            >
              <Text style={[st.toggleText, gasMode === 'piped' && st.toggleTextOn]}>
                Piped Gas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.toggle, gasMode === 'cylinder' && st.toggleOn]}
              onPress={() => {
                setGasMode('cylinder');
                setProvider(null);
                setAmount('');
              }}
            >
              <Text style={[st.toggleText, gasMode === 'cylinder' && st.toggleTextOn]}>
                Book Cylinder
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isMobile && (
          <View style={st.toggleRow}>
            <TouchableOpacity
              style={[st.toggle, prepaid && st.toggleOn]}
              onPress={() => setPrepaid(true)}
            >
              <Text style={[st.toggleText, prepaid && st.toggleTextOn]}>Prepaid</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.toggle, !prepaid && st.toggleOn]}
              onPress={() => setPrepaid(false)}
            >
              <Text style={[st.toggleText, !prepaid && st.toggleTextOn]}>Postpaid</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={st.formCard}>
          <Text style={st.formTitle}>
            {isGas && gasMode === 'cylinder'
              ? 'Book LPG Cylinder'
              : isRechargeFlow
                // Several titles already end in "Recharge" ("Mobile Recharge"), which read as
                // "Recharge Mobile Recharge" (QA audit L-06).
                ? (/recharge/i.test(meta.title) ? meta.title : `Recharge ${meta.title}`)
                : `Pay ${meta.title}`}
          </Text>

          <Text style={st.fieldLabel}>
            {isElectricity
              ? mode === 'boards'
                ? 'Electricity Board'
                : 'Apartment / Society'
              : isGas
                ? gasMode === 'piped'
                  ? 'Piped Gas Provider'
                  : 'LPG Distributor'
                : 'Operator / Provider'}
          </Text>
          <TouchableOpacity style={st.select} onPress={() => setPickerOpen(true)}>
            <Text style={[st.selectText, !provider && { color: T(C.gray, 'fg') }]}>
              {provider?.name ?? 'Select provider'}
            </Text>
            <ChevronRight size={16} color={T(C.gray, 'fg')} />
          </TouchableOpacity>

          <Text style={st.fieldLabel}>{provider?.hint ?? 'Consumer / Account ID'}</Text>
          <TextInput
            style={st.input}
            placeholder={provider?.hint ?? 'Enter details'}
            placeholderTextColor={T(C.gray, 'fg')}
            value={consumerId}
            onChangeText={setConsumerId}
            keyboardType={isMobile || kind === 'landline' ? 'phone-pad' : 'default'}
            maxLength={isMobile ? 10 : 30}
          />

          {needsAmount && (
            <>
              <Text style={st.fieldLabel}>Amount</Text>
              <TextInput
                style={st.input}
                placeholder="Enter amount"
                placeholderTextColor={T(C.gray, 'fg')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              {isMobile && prepaid && (
                <View style={st.quickAmounts}>
                  {[149, 199, 299, 599, 999].map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[st.amountChip, amount === String(a) && st.amountChipOn]}
                      onPress={() => setAmount(String(a))}
                    >
                      <Text style={[st.amountText, amount === String(a) && st.amountTextOn]}>
                        ₹{a}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {isGas && gasMode === 'cylinder' && (
                <View style={st.quickAmounts}>
                  {[903, 1103, 1303].map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[st.amountChip, amount === String(a) && st.amountChipOn]}
                      onPress={() => setAmount(String(a))}
                    >
                      <Text style={[st.amountText, amount === String(a) && st.amountTextOn]}>
                        ₹{a}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={[st.proceed, !canProceed && st.proceedDisabled]}
            disabled={!canProceed}
            onPress={onFetch}
          >
            <Text style={st.proceedText}>
              {isGas && gasMode === 'cylinder'
                ? 'Book Cylinder'
                : isRechargeFlow
                  ? 'Proceed to Recharge'
                  : 'Fetch Bill'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={st.popularTitle}>Popular providers</Text>
        <View style={st.popularRow}>
          {providers.slice(0, 4).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[st.popularChip, provider?.id === p.id && st.popularChipOn]}
              onPress={() => setProvider(p)}
            >
              <Text style={[st.popularText, provider?.id === p.id && st.popularTextOn]} numberOfLines={2}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ProviderPicker
        visible={pickerOpen}
        title={isElectricity ? 'Select Board' : 'Select Provider'}
        providers={providers}
        selected={provider}
        onSelect={setProvider}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const make_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: T(C.pageBg, 'page') },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: T(C.white, 'page'),
    borderBottomWidth: 1,
    borderBottomColor: T(C.border, 'page'),
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  headerSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 1 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 4,
    marginBottom: 12,
   ...glass(18), },
  toggle: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  toggleOn: { backgroundColor: T('#F5F0FF', 'bg') },
  toggleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  toggleTextOn: { color: T(C.orange, 'fg') },
  formCard: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 16,
   ...glass(22), },
  formTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: T(C.textLight, 'fg'),
    marginBottom: 6,
    marginTop: 8,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: T(C.white, 'bg'),
  },
  selectText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: T(C.text, 'fg') },
  input: {
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: T(C.text, 'fg'),
    backgroundColor: T(C.white, 'bg'),
  },
  quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  amountChip: {
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: T(C.lightGray, 'bg'),
  },
  amountChipOn: { backgroundColor: T('#F5F0FF', 'bg'), borderColor: T(C.orange, 'border') },
  amountText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.textLight, 'fg') },
  amountTextOn: { color: T(C.orange, 'fg') },
  proceed: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  proceedDisabled: { opacity: 0.45 },
  proceedText: { color: T(C.white, 'fg'), fontSize: 15, fontFamily: 'Inter_700Bold' },
  popularTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: T(C.text, 'fg'),
    marginTop: 18,
    marginBottom: 10,
  },
  popularRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  popularChip: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: T(C.white, 'bg'),
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    borderRadius: 12,
    padding: 12,
    minHeight: 56,
    justifyContent: 'center',
  },
  popularChipOn: { borderColor: T(C.orange, 'border'), backgroundColor: T('#F5F0FF', 'bg') },
  popularText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T(C.text, 'fg') },
  popularTextOn: { color: T(C.orange, 'fg') },
  billCard: {
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 18,
    alignItems: 'center',
   ...glass(22), },
  billIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  billProvider: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  billId: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 4 },
  sep: { height: 1, backgroundColor: T(C.border, 'bg'), alignSelf: 'stretch', marginVertical: 14 },
  billLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  billAmount: { fontSize: 28, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg'), marginTop: 4 },
  billDue: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T(C.green, 'fg'),
    marginTop: 8,
    textAlign: 'center',
  },
  offerCard: {
    marginTop: 12,
    backgroundColor: T('#F5F3FF', 'bg'),
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: T('#DDD6FE', 'border'),
  },
  offerTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: T(C.purple, 'fg') },
  offerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T(C.white, 'bg'),
    borderTopWidth: 1,
    borderTopColor: T(C.border, 'border'),
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
   ...dockBar(), },
  footerLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  footerPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  payBtn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
   overflow: 'hidden', },
  payText: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
  successWrap: { alignItems: 'center', paddingHorizontal: 24 },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: T('#ECFDF5', 'bg'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: T(C.text, 'fg') },
  successSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: T(C.textLight, 'fg'),
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 19,
  },
  successCard: {
    width: '100%',
    backgroundColor: T(C.white, 'bg'),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T(C.border, 'border'),
    padding: 16,
    marginBottom: 20,
   ...glass(22), },
  successLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg') },
  successPnr: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T(C.purple, 'fg'), marginTop: 2 },
  successMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: T(C.textLight, 'fg'), marginTop: 4 },
  successAmount: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T(C.green, 'fg'), marginTop: 10 },
  doneBtn: {
    backgroundColor: T(C.orange, 'bg'),
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
   overflow: 'hidden', },
  doneText: { color: T(C.white, 'fg'), fontSize: 14, fontFamily: 'Inter_700Bold' },
});
const use_st = () => useThemedStyles(make_st);
