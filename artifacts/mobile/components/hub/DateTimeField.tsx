import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format, isValid, parse } from 'date-fns';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

type Mode = 'date' | 'time';

interface Props {
  label: string;
  mode: Mode;
  value: Date;
  onChange: (next: Date) => void;
  minimumDate?: Date;
}

const PATTERN: Record<Mode, string> = { date: 'd MMM yyyy', time: 'h:mm a' };
const TYPED_PATTERN: Record<Mode, string> = { date: 'yyyy-MM-dd', time: 'HH:mm' };

/**
 * One date or time, picked with the platform's own picker.
 *
 * Android drops its picker straight in, iOS needs it inside a sheet with a Done button, and the
 * web build has no native picker at all — there it falls back to typing the value.
 */
export function DateTimeField({ label, mode, value, onChange, minimumDate }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value);
  const [typed, setTyped] = useState(() => format(value, TYPED_PATTERN[mode]));

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1 }}>
        <Text style={[s.label, { color: colors.mutedForeground }]}>{label}</Text>
        <TextInput
          value={typed}
          onChangeText={(next) => {
            setTyped(next);
            const parsed = parse(next, TYPED_PATTERN[mode], value);
            if (isValid(parsed)) onChange(parsed);
          }}
          placeholder={TYPED_PATTERN[mode]}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={label}
          style={[s.box, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        style={[s.box, s.boxRow, { backgroundColor: colors.input, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${format(value, PATTERN[mode])}`}
      >
        <Icon name={mode === 'date' ? 'calendar' : 'clock'} size={15} color={colors.mutedForeground} />
        <Text style={[s.boxText, { color: colors.foreground }]}>{format(value, PATTERN[mode])}</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          onChange={(event: DateTimePickerEvent, picked?: Date) => {
            setOpen(false);
            if (event.type === 'set' && picked) onChange(picked);
          }}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={s.overlay} onPress={() => setOpen(false)}>
            <Pressable style={[s.sheet, { backgroundColor: colors.card }]}>
              <View style={[s.sheetBar, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button">
                  <Text style={[s.sheetAction, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[s.sheetTitle, { color: colors.foreground }]}>{label}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[s.sheetAction, { color: colors.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={draft}
                mode={mode}
                display="spinner"
                minimumDate={minimumDate}
                onChange={(_event: DateTimePickerEvent, picked?: Date) => {
                  if (picked) setDraft(picked);
                }}
                style={s.picker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 5 },
  box: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boxText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sheetAction: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  picker: { alignSelf: 'stretch' },
});
