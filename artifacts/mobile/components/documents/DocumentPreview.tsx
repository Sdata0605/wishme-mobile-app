import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { DocumentContent } from '@/services/documents/generate';
import { parseMarkdown, type MarkdownBlock } from '@/services/documents/render';

/** One line of body text, with the bold runs kept. */
function Line({ block, colour }: { block: MarkdownBlock; colour: string }) {
  return (
    <Text style={[s.body, { color: colour }]}>
      {block.spans.map((span, index) => (
        <Text
          key={`${index}-${span.text.slice(0, 8)}`}
          style={span.bold ? { fontFamily: 'Inter_700Bold' } : undefined}
        >
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

function Prose({ content }: { content: DocumentContent }) {
  const { colors } = useTheme();
  return (
    <View>
      {(content.sections ?? []).map((section, sectionIndex) => (
        <View key={`${sectionIndex}-${section.heading}`} style={s.section}>
          {section.heading ? (
            <Text style={[s.heading, { color: colors.foreground }]}>{section.heading}</Text>
          ) : null}
          {parseMarkdown(section.body).map((block, blockIndex) =>
            block.type === 'bullet' ? (
              <View key={blockIndex} style={s.bulletRow}>
                <Text style={[s.bulletDot, { color: colors.primary }]}>•</Text>
                <View style={{ flex: 1 }}>
                  <Line block={block} colour={colors.foreground} />
                </View>
              </View>
            ) : (
              <View key={blockIndex} style={s.paragraph}>
                <Line block={block} colour={colors.foreground} />
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * The grid, scrolled sideways rather than squeezed: a spreadsheet with six columns is unreadable
 * once each one is forty pixels wide.
 */
function Sheet({ content }: { content: DocumentContent }) {
  const { colors } = useTheme();
  const sheet = content.sheet;
  if (!sheet) return null;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[s.table, { borderColor: colors.border }]}>
          <View style={[s.row, { backgroundColor: colors.muted }]}>
            {sheet.columns.map((name, index) => (
              <Text key={`head-${index}`} style={[s.cell, s.headCell, { color: colors.foreground, borderColor: colors.border }]}>
                {name}
              </Text>
            ))}
          </View>
          {sheet.rows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[s.row, rowIndex % 2 === 1 ? { backgroundColor: colors.backgroundSecondary } : null]}
            >
              {row.map((value, cellIndex) => (
                <Text
                  key={`cell-${rowIndex}-${cellIndex}`}
                  style={[s.cell, { color: colors.foreground, borderColor: colors.border }]}
                >
                  {value}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {sheet.notes ? <Text style={[s.notes, { color: colors.mutedForeground }]}>{sheet.notes}</Text> : null}
    </View>
  );
}

/** What the document says, shown the way its shape deserves. */
export function DocumentPreview({ content }: { content: DocumentContent }) {
  const { colors } = useTheme();
  return (
    <View>
      {content.subtitle ? (
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{content.subtitle}</Text>
      ) : null}
      {content.sheet ? <Sheet content={content} /> : <Prose content={content} />}
    </View>
  );
}

const s = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', fontStyle: 'italic', marginBottom: 16 },
  section: { marginBottom: 18 },
  heading: { fontSize: 15.5, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  paragraph: { marginBottom: 9 },
  body: { fontSize: 14.5, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 7, paddingLeft: 2 },
  bulletDot: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  table: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: {
    minWidth: 110,
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headCell: { fontFamily: 'Inter_700Bold', fontSize: 12.5 },
  notes: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 12 },
});
