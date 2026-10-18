import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssistantSettingsPanel } from '@/components/assistant/AssistantSettingsPanel';
import { SectionLabel } from '@/components/assistant/PersonaForm';
import { SettingsHeader } from '@/components/settings/SettingsUI';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { ADDRESS_OPTIONS } from '@/services/assistant/addressModes';
import { useTheme } from '@/context/ThemeContext';

/** How the assistant addresses the user: always sir, always ma'am, or decided from their voice in each conversation. */
function AddressAs() {
  const { colors } = useTheme();
  const { user, setAddressMode } = useAuth();
  return (
    <View style={{ marginBottom: 24 }} accessibilityRole="radiogroup">
      <SectionLabel title="How I address you" subtitle="Applies right away." />
      <View style={{ gap: 10, marginTop: 10 }}>
        {ADDRESS_OPTIONS.map((o) => {
          const on = user?.addressMode === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setAddressMode(o.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[s.row, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '1F' : 'transparent' }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: on ? colors.primary : colors.foreground, fontSize: 15.5, fontFamily: on ? 'Inter_600SemiBold' : 'Inter_500Medium' }}>{o.label}</Text>
                {o.key === 'voice' ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 3, lineHeight: 17 }}>
                    Says just “Hello”, then picks sir or ma’am from your voice. It decides again in every new conversation.
                  </Text>
                ) : null}
              </View>
              {on ? <Icon name="check" size={18} color={colors.primary} /> : null}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.4, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, minHeight: 52 },
});
