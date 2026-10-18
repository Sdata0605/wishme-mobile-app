import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { deleteMemory, listMemories, type Memory } from '@/services/assistant/memory';

/** Everything the assistant remembers about the user, readable and removable (Settings > AI Assistant > What I remember). */
export default function MemoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { getValidSession } = useAuth();
  const [rows, setRows] = useState<Memory[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const token = (await getValidSession())?.access_token;
      if (!token) return setError('Please log in again.');
      setRows(await listMemories(token));
      setError('');
    } catch {
      setError('Could not load what I remember. Please try again.');
      setRows((r) => r ?? []);
    }
  }, [getValidSession]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (m: Memory) => {
    try {
      const token = (await getValidSession())?.access_token;
      if (!token) return;
      await deleteMemory(token, m.id);
      setRows((r) => (r ?? []).filter((x) => x.id !== m.id));
    } catch {
      Alert.alert('Not removed', 'That could not be removed. Please try again.');
    }
  };

  const removeAll = () =>
    Alert.alert('Forget everything?', 'The assistant will forget everything it remembers about you. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget all',
        style: 'destructive',
        onPress: async () => {
          for (const m of rows ?? []) await remove(m);
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SettingsHeader title="What I remember" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={[s.lead, { color: colors.mutedForeground }]}>
          Things you told the assistant to remember, or that it noted about you and the people in your life. Remove any of them whenever you like.
          You can also say “forget …” out loud.
        </Text>
        {rows === null ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
        {error ? <Text style={[s.empty, { color: colors.destructive }]}>{error}</Text> : null}
        {rows && rows.length === 0 && !error ? (
          <Text style={[s.empty, { color: colors.mutedForeground }]}>Nothing yet. Try saying: “Remember that my sister is Anita.”</Text>
        ) : null}
        {(rows ?? []).map((m) => (
          <View key={m.id} style={[s.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>{m.subject}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13.5, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 19 }}>{m.fact}</Text>
            </View>
            <Pressable onPress={() => void remove(m)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Forget: ${m.subject}`}>
              <Icon name="trash-2" size={18} color={colors.destructive} />
            </Pressable>
          </View>
        ))}
        {rows && rows.length > 1 ? (
          <Pressable onPress={removeAll} style={[s.all, { borderColor: colors.destructive }]} accessibilityRole="button">
            <Text style={{ color: colors.destructive, fontSize: 14.5, fontFamily: 'Inter_600SemiBold' }}>Forget everything</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  lead: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 36, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  all: { borderWidth: 1.2, borderRadius: 24, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
});
