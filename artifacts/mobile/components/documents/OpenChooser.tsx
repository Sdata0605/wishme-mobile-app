import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { FORMAT_LABELS } from '@/services/documents/render';
import type { SavedDocument } from '@/services/documents/store';

interface Props {
  /** The document being opened, or `null` when the sheet is closed. */
  document: SavedDocument | null;
  /** Handing a file to another app can take a moment, and the sheet has to show that. */
  busy: boolean;
  onOpenInApp: () => void;
  onOpenInPhone: () => void;
  onCancel: () => void;
}

interface ChoiceProps {
  icon: IconName;
  title: string;
  detail: string;
  accent: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function Choice({ icon, title, detail, accent, busy, disabled, onPress }: ChoiceProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.choice,
        { backgroundColor: pressed ? colors.muted : colors.card, borderColor: colors.border },
        disabled ? s.inactive : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
    >
      <View style={[s.tile, { backgroundColor: accent + '1F' }]}>
        {busy ? <ActivityIndicator size="small" color={accent} /> : <Icon name={icon} size={18} color={accent} />}
      </View>
      <View style={s.choiceText}>
        <Text style={[s.choiceTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[s.choiceDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

/**
 * Asks how a document should be opened, because the two answers are genuinely different things:
 * reading it in WishMe, or handing the file to whatever app the person already uses for PDFs.
 *
 * It is a sheet rather than an `Alert`, so the difference can be spelled out in a line of text under
 * each choice instead of being guessed at from a button name.
 */
export function OpenChooser({ document, busy, onOpenInApp, onOpenInPhone, onCancel }: Props) {
  const { colors } = useTheme();
  const formatLabel = document ? FORMAT_LABELS[document.format] : '';

  return (
    <Modal visible={document !== null} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={s.overlay} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close">
        {/* Swallows the tap so touching the sheet itself never dismisses it. */}
        <Pressable style={[s.sheet, { backgroundColor: colors.background }]} accessibilityViewIsModal>
          <View style={[s.grip, { backgroundColor: colors.border }]} />

          <Text style={[s.title, { color: colors.foreground }]} numberOfLines={2}>
            {document?.title ?? ''}
          </Text>
          <Text style={[s.sub, { color: colors.mutedForeground }]}>How would you like to open this {formatLabel}?</Text>

          <Choice
            icon="eye"
            title="Open in WishMe"
            detail="Read it here, laid out on screen."
            accent={colors.primary}
            disabled={busy}
            onPress={onOpenInApp}
          />
          <Choice
            icon="arrow-up-right"
            title="Open in phone"
            detail={
              Platform.OS === 'ios'
                ? 'Hand the file to another app from the share sheet.'
                : `Open the file in whichever app reads ${formatLabel} files.`
            }
            accent={colors.secondary}
            busy={busy}
            disabled={busy}
            onPress={onOpenInPhone}
          />

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [s.cancel, { backgroundColor: pressed ? colors.muted : 'transparent' }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[s.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26, gap: 10 },
  grip: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 8 },
  title: { fontSize: 16.5, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  inactive: { opacity: 0.5 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold' },
  choiceDetail: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  cancel: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
