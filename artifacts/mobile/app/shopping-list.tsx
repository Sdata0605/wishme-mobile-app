import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { listText, parseItems } from '@/services/assistant/everyday';
import { addItems, clearItems, listItems, removeItems, setDone, type ShoppingItem } from '@/services/hub/shopping';

/** THE SHOPPING LIST: the same list the assistant adds to by voice ("add milk and eggs to my list"). */
export default function ShoppingListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();

  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const token = useCallback(async () => (await getValidSession())?.access_token ?? null, [getValidSession]);

  const load = useCallback(async () => {
    setError(null);
    const t = await token();
    if (!t) {
      setError('Please sign in again to see your shopping list.');
      setItems(null);
      return;
    }
    try {
      setItems(await listItems(t));
    } catch {
      setError('Your shopping list could not be loaded.');
      setItems(null);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Runs a change, then reloads; a failure is said once and the list is left as the server has it. */
  const change = async (fn: (t: string) => Promise<unknown>) => {
    const t = await token();
    if (!t || busy) return;
    setBusy(true);
    try {
      await fn(t);
    } catch {
      Alert.alert('Not saved', 'That change could not be saved. Please try again.');
    } finally {
      setBusy(false);
      await load();
    }
  };

  const add = () => {
    const drafts = parseItems(draft);
    if (!drafts.length) return;
    setDraft('');
    void change((t) => addItems(t, drafts));
  };

  const share = () => {
    const text = listText(items ?? []);
    if (text) void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  const open = (items ?? []).filter((i) => !i.done);
  const bought = (items ?? []).filter((i) => i.done);

  const row = (i: ShoppingItem) => (
    <View key={i.id} style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => void change((t) => setDone(t, [i.id], !i.done))}
        style={s.tick}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: i.done }}
        accessibilityLabel={i.name}
      >
        <Icon name={i.done ? 'check-circle' : 'circle'} size={22} color={i.done ? colors.success : colors.mutedForeground} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[s.name, { color: colors.foreground, textDecorationLine: i.done ? 'line-through' : 'none', opacity: i.done ? 0.6 : 1 }]}>{i.name}</Text>
        {i.quantity ? <Text style={[s.qty, { color: colors.mutedForeground }]}>{i.quantity}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => void change((t) => removeItems(t, [i.id]))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${i.name}`}>
        <Icon name="trash-2" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );

  return (
    <AmbientBackground>
      <View style={s.container}>
        <HubHeader
          title="Shopping list"
          right={
            open.length ? (
              <TouchableOpacity onPress={share} hitSlop={12} accessibilityRole="button" accessibilityLabel="Send the list on WhatsApp">
                <Icon name="share-2" size={18} color={colors.foreground} />
              </TouchableOpacity>
            ) : undefined
          }
        />

        <View style={[s.addRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Add items, e.g. milk, 2 kg rice"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            style={[s.input, { color: colors.foreground }]}
            accessibilityLabel="Add items"
          />
          <TouchableOpacity onPress={add} disabled={!draft.trim() || busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add">
            <Icon name="plus" size={22} color={draft.trim() ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {items === null && error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : items === null ? (
          <LoadingState label="Loading your list…" />
        ) : (
          <ScrollView
            contentContainerStyle={[s.body, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 40 : 100) }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
              />
            }
          >
            {!items.length ? (
              <EmptyState icon="shopping-cart" title="Your list is empty" message={'Type above, or ask the assistant: "add milk, eggs and bread to my list".'} />
            ) : (
              <>
                {open.map(row)}
                {bought.length ? (
                  <>
                    <View style={s.boughtHead}>
                      <Text style={[s.section, { color: colors.mutedForeground }]}>Bought ({bought.length})</Text>
                      <TouchableOpacity onPress={() => void change((t) => clearItems(t, false))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear bought items">
                        <Text style={[s.clear, { color: colors.primary }]}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                    {bought.map(row)}
                  </>
                ) : null}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 6, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 12 },
  body: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  tick: { width: 26, alignItems: 'center' },
  name: { fontSize: 15.5, fontFamily: 'Inter_500Medium' },
  qty: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 2 },
  boughtHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  section: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  clear: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});
