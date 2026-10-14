import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssistantSettingsPanel } from '@/components/assistant/AssistantSettingsPanel';
import { SectionLabel } from '@/components/assistant/PersonaForm';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { useAuth, type Gender } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const OPTIONS: { key: Gender; label: string }[] = [
  { key: 'male', label: 'Sir' },
  { key: 'female', label: "Ma'am" },
  { key: 'other', label: 'No title' },
];

/** How the assistant addresses the user: "Hello sir", "Hello ma'am" or just "Hello". */
function AddressAs() {
  const { colors } = useTheme();
  const { user, setGender } = useAuth();
  return (
    <View style={{ marginBottom: 24 }}>
      <SectionLabel title="How I address you" subtitle="The assistant greets you with this." />
      <View style={s.row}>
        {OPTIONS.map((o) => {
          const on = user?.gender === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setGender(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[s.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '1F' : 'transparent' }]}
            >
              <Text style={{ color: on ? colors.primary : colors.foreground, fontSize: 15, fontFamily: on ? 'Inter_600SemiBold' : 'Inter_500Medium' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AssistantSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SettingsHeader title="AI Assistant" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AddressAs />
        <AssistantSettingsPanel />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  chip: { borderWidth: 1.4, borderRadius: 22, paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center' },
});
