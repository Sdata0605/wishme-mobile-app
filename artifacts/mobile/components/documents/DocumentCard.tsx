import { format, formatDistanceToNow, isToday } from 'date-fns';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { FORMAT_LABELS, sizeLabel } from '@/services/documents/render';
import type { SavedDocument } from '@/services/documents/store';

/** Plain words for each kind, as the user would say them. */
export const KIND_LABELS: Record<SavedDocument['kind'], string> = {
  report: 'Report',
  letter: 'Letter',
  notes: 'Notes',
  plan: 'Plan',
  spreadsheet: 'Spreadsheet',
};

/** The size line reads as the document's shape: pages for a PDF, words for everything else. */
export function extentLabel(document: SavedDocument): string {
  if (document.pageCount && document.pageCount > 0) {
    return `${document.pageCount} ${document.pageCount === 1 ? 'page' : 'pages'}`;
  }
  return document.wordCount > 0 ? `${document.wordCount} words` : sizeLabel(document.byteSize);
}

function madeLabel(createdAt: string): string {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return 'Just now';
  return isToday(at) ? formatDistanceToNow(at, { addSuffix: true }) : format(at, 'd MMM yyyy, h:mm a');
}

export function DocumentCard({ document, onPress }: { document: SavedDocument; onPress: () => void }) {
  const { colors } = useTheme();
  const formatLabel = FORMAT_LABELS[document.format];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${document.title}, ${KIND_LABELS[document.kind]} as ${formatLabel}, ${extentLabel(document)}, made ${madeLabel(document.createdAt)}`}
    >
      <View style={[s.badge, { backgroundColor: colors.primary + '1F' }]}>
        <Text style={[s.badgeText, { color: colors.primary }]}>{formatLabel}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: colors.foreground }]} numberOfLines={2}>
          {document.title}
        </Text>
        <Text style={[s.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {KIND_LABELS[document.kind]} · {extentLabel(document)} · {sizeLabel(document.byteSize)}
        </Text>
        <Text style={[s.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {madeLabel(document.createdAt)}
        </Text>
      </View>

      <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  badge: { minWidth: 54, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  badgeText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  title: { fontSize: 15.5, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 },
});
