import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { NeonHeader } from '@/components/neon/NeonHeader';
import { Reveal } from '@/components/neon/Motion';
import { withAlpha } from '@/constants/neon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { addItem, deleteItem, loadItems, planPrompt, rupees, sortedEmis, summarize, type FinItem, type FinKind } from '@/services/finance/store';

const KINDS: { key: FinKind; label: string }[] = [
  { key: 'emi', label: 'EMI' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expense' },
];

/**
 * FINANCE: the user's money map. Incomes, EMIs (with interest and what is still owed) and recurring expenses, kept on
 * the phone. "Plan with the assistant" hands the ledger over for a highest-interest-first plan.
 */
export default function FinanceScreen() {
  const { neon } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { ask } = useVoiceAssistant();
  const uid = user?.id ?? '';
  const [items, setItems] = useState<FinItem[] | null>(null);
  const [adding, setAdding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (uid) void loadItems(uid).then(setItems);
    }, [uid]),
  );

  const s = summarize(items ?? []);
  const emis = sortedEmis(items ?? []);
  const incomes = (items ?? []).filter(i => i.kind === 'income');
  const expenses = (items ?? []).filter(i => i.kind === 'expense');

  const remove = (i: FinItem) => {
    Alert.alert(`Remove ${i.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void deleteItem(uid, i.id).then(setItems) },
    ]);
  };

  const plan = () => {
    router.replace('/(tabs)/assistant' as never);
    void ask(planPrompt(items ?? []));
  };

  const row = (i: FinItem, last: boolean) => {
    const chips = [
      i.kind === 'emi' && i.interestRate ? `${i.interestRate}% interest` : null,
      i.dueDay ? `day ${i.dueDay}` : null,
      i.kind === 'emi' && i.outstanding ? `${rupees(i.outstanding)} left` : null,
    ].filter(Boolean);
    const colour = i.kind === 'income' ? neon.success : i.kind === 'emi' ? neon.error : neon.textLo;
    return (
      <Pressable
        key={i.id}
        onLongPress={() => remove(i)}
        style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: neon.line }]}
        accessibilityHint="Long press to remove"
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: neon.textHi }]} numberOfLines={1}>{i.name}</Text>
          {chips.length ? <Text style={[styles.rowSub, { color: neon.textLo }]}>{chips.join(' · ')}</Text> : null}
        </View>
        <Text style={[styles.amount, { color: colour }]}>{i.kind === 'income' ? '+' : '−'}{rupees(i.amount)}/mo</Text>
        <Pressable onPress={() => remove(i)} hitSlop={10} accessibilityLabel={`Remove ${i.name}`}>
          <Icon name="trash-2" size={16} color={neon.textDim} />
        </Pressable>
      </Pressable>
    );
  };

  const group = (title: string, list: FinItem[]) =>
    list.length === 0 ? null : (
      <View style={{ marginTop: 24 }}>
        <Text style={[styles.groupLabel, { color: neon.textDim }]}>{title.toUpperCase()}</Text>
        <View style={[styles.group, { backgroundColor: neon.surface, borderColor: neon.line }]}>
          {list.map((i, n) => row(i, n === list.length - 1))}
        </View>
      </View>
    );

  return (
    <AmbientBackground>
      <NeonHeader
        title="Finance"
        right={
          items && items.length > 0 ? (
            <Pressable onPress={plan} style={styles.planBtn} accessibilityRole="button">
              <Icon name="sparkles" size={15} color={neon.cyan} />
              <Text style={[styles.planText, { color: neon.cyan }]}>Plan with assistant</Text>
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {items === null ? null : items.length === 0 ? (
          <Reveal>
            <View style={styles.empty}>
              <View style={[styles.emptyTile, { backgroundColor: withAlpha(neon.violet, 0.14) }]}>
                <Icon name="wallet" size={26} color={neon.violet} />
              </View>
              <Text style={[styles.emptyTitle, { color: neon.textHi }]}>Nothing here yet</Text>
              <Text style={[styles.emptyBody, { color: neon.textLo }]}>
                Add your EMIs, incomes and expenses with the + button. They stay on this phone.
              </Text>
            </View>
          </Reveal>
        ) : (
          <Reveal>
            <View style={[styles.summary, { backgroundColor: neon.surface, borderColor: neon.line }]}>
              <View style={styles.cells}>
                <Cell label="In / month" value={rupees(s.monthlyIncome)} />
                <Cell label="Out / month" value={rupees(s.monthlyEmi + s.monthlyExpense)} />
                <Cell label="Surplus" value={rupees(s.surplus)} color={s.surplus >= 0 ? neon.success : neon.error} />
              </View>
              {s.totalDebt > 0 ? <Text style={[styles.debt, { color: neon.textLo }]}>Total debt outstanding: {rupees(s.totalDebt)}</Text> : null}
            </View>
            {group('EMIs — highest interest first', emis)}
            {group('Incoming', incomes)}
            {group('Recurring expenses', expenses)}
          </Reveal>
        )}
      </ScrollView>

      <Pressable
        onPress={() => setAdding(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a finance item"
        style={[styles.fab, { backgroundColor: neon.textHi, bottom: insets.bottom + 24 }]}
      >
        <Icon name="plus" size={26} color={neon.onInk} />
      </Pressable>

      <AddSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={async (it) => { setItems(await addItem(uid, it)); setAdding(false); }}
      />
    </AmbientBackground>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  const { neon } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: neon.textDim, fontSize: 11, fontFamily: 'Inter_500Medium' }}>{label}</Text>
      <Text style={{ color: color ?? neon.textHi, fontSize: 15, fontFamily: 'Inter_700Bold', marginTop: 3 }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function SheetField({ label, value, onChangeText, numeric }: { label: string; value: string; onChangeText: (t: string) => void; numeric?: boolean }) {
  const { neon } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={label}
      placeholderTextColor={neon.textLo}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.sheetInput,
        { backgroundColor: neon.surfaceHigh, color: neon.textHi, borderColor: focused ? neon.cyan : neon.line, borderWidth: focused ? 1.6 : 1 },
      ]}
    />
  );
}

function AddSheet({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (i: Omit<FinItem, 'id' | 'createdAt'>) => void | Promise<void> }) {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<FinKind>('emi');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [day, setDay] = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [err, setErr] = useState('');

  const reset = () => { setName(''); setAmount(''); setRate(''); setDay(''); setOutstanding(''); setErr(''); };

  const save = () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !(amt > 0)) { setErr('Give it a name and a monthly amount.'); return; }
    const d = parseInt(day, 10);
    if (day.trim() && !(d >= 1 && d <= 31)) { setErr('The day of the month is 1 to 31.'); return; }
    void onSave({
      kind,
      name: name.trim(),
      amount: amt,
      interestRate: kind === 'emi' && rate.trim() ? parseFloat(rate) || null : null,
      dueDay: day.trim() ? d : null,
      outstanding: kind === 'emi' && outstanding.trim() ? parseFloat(outstanding) || null : null,
    });
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: neon.surface, borderColor: neon.lineBright, paddingBottom: insets.bottom + 20 }]}>
          <Text style={[styles.sheetTitle, { color: neon.textHi }]}>Add finance item</Text>
          <View style={styles.chips}>
            {KINDS.map(k => {
              const on = kind === k.key;
              return (
                <Pressable
                  key={k.key}
                  onPress={() => setKind(k.key)}
                  style={[styles.chip, { backgroundColor: on ? withAlpha(neon.violet, 0.15) : neon.surface, borderColor: neon.line }]}
                >
                  <Text style={{ fontSize: 13, fontFamily: on ? 'Inter_600SemiBold' : 'Inter_500Medium', color: on ? neon.violet : neon.textLo }}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <SheetField label="Name (Bike EMI, Salary…)" value={name} onChangeText={setName} />
          <SheetField label="Monthly amount (₹)" value={amount} onChangeText={setAmount} numeric />
          {kind === 'emi' ? <SheetField label="Interest rate (% per year)" value={rate} onChangeText={setRate} numeric /> : null}
          <SheetField label="Day of month it hits (1-31)" value={day} onChangeText={setDay} numeric />
          {kind === 'emi' ? <SheetField label="Outstanding principal (₹)" value={outstanding} onChangeText={setOutstanding} numeric /> : null}
          {err ? <Text style={{ color: neon.error, fontSize: 12.5, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>{err}</Text> : null}
          <Pressable onPress={save} style={[styles.save, { backgroundColor: neon.violet }]} accessibilityRole="button">
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  planText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summary: { borderWidth: 1, borderRadius: 14, padding: 16 },
  cells: { flexDirection: 'row', gap: 8 },
  debt: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 10 },
  groupLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  amount: { fontSize: 14.5, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTile: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontFamily: 'PlayfairDisplay_700Bold', marginTop: 18 },
  emptyBody: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21, textAlign: 'center', marginTop: 8 },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20 },
  sheetTitle: { fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 14 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  sheetInput: { height: 48, borderRadius: 14, paddingHorizontal: 16, fontSize: 14.5, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  save: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  saveText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
