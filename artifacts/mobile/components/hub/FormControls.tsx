import React from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

/** A heading for a block of settings, with an optional line explaining the block. */
export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {hint ? <Text style={[s.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

/** A labelled text box. `hint` is the one line that saves the user guessing. */
export function FormField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  maxLength?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
      {hint ? <Text style={[s.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        accessibilityLabel={label}
        style={[
          s.input,
          multiline && s.inputMultiline,
          { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground },
        ]}
      />
    </View>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** One short line, shown under the row when this choice is the selected one. */
  help?: string;
}

/** A row of pills, one of which is chosen, plus the chosen one's explanation underneath. */
export function ChoiceRow<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Choice<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { colors } = useTheme();
  const chosen = options.find((option) => option.value === value);
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
      {hint ? <Text style={[s.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      <View style={s.pills}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                s.pill,
                { borderColor: active ? colors.primary : colors.border },
                active && { backgroundColor: colors.primary },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.help ? `${option.label}. ${option.help}` : option.label}
            >
              <Text
                style={[
                  s.pillText,
                  { color: active ? '#fff' : colors.foreground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {chosen?.help ? <Text style={[s.help, { color: colors.mutedForeground }]}>{chosen.help}</Text> : null}
    </View>
  );
}

/** An on/off setting with the single line that says what turning it on does. */
export function ToggleRow({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[s.toggleRow, { borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.label, { color: colors.foreground, marginBottom: 2 }]}>{label}</Text>
        <Text style={[s.help, { color: colors.mutedForeground, marginTop: 0 }]}>{help}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  sectionBody: { marginTop: 4 },
  field: { marginTop: 14 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 },
  help: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 6 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { fontSize: 13 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
});
