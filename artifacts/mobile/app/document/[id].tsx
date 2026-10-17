import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { ActionButton } from '@/components/documents/ActionButton';
import { KIND_LABELS, extentLabel } from '@/components/documents/DocumentCard';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { ErrorState, LoadingState } from '@/components/documents/StateViews';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { useTheme } from '@/context/ThemeContext';
import type { DocumentContent } from '@/services/documents/generate';
import {
  FORMAT_LABELS,
  canPickFolder,
  saveToPhone,
  shareDocument,
  sizeLabel,
  type DeliveryResult,
} from '@/services/documents/render';
import {
  deleteDocument,
  fileStillThere,
  getDocument,
  readContent,
  type SavedDocument,
} from '@/services/documents/store';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

type Busy = 'share' | 'save' | 'delete' | null;

export default function DocumentDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [document, setDocument] = useState<SavedDocument | null>(null);
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [onDisk, setOnDisk] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('That document could not be found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getDocument(id);
      if (!row) {
        setError('That document is no longer on this phone.');
        return;
      }
      setDocument(row);
      setOnDisk(await fileStillThere(row));
      setContent(await readContent(id));
    } catch {
      setError('That document could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const show = (result: DeliveryResult) =>
    setNotice(result.ok ? { text: result.message, bad: false } : { text: result.error, bad: true });

  const onShare = async () => {
    if (!document) return;
    setNotice(null);
    setBusy('share');
    show(await shareDocument(document));
    setBusy(null);
  };

  const onSave = async () => {
    if (!document) return;
    setNotice(null);
    setBusy('save');
    show(await saveToPhone(document));
    setBusy(null);
  };

  const onDelete = () => {
    if (!document) return;
    Alert.alert(
      'Delete this document?',
      `"${document.title}" and its file will be removed from this phone. This cannot be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy('delete');
              try {
                await deleteDocument(document.id);
                router.back();
              } catch {
                setNotice({ text: 'The document could not be deleted. Please try again.', bad: true });
                setBusy(null);
              }
            })();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <DocumentHeader title="Document" />
        <LoadingState label="Opening this document…" />
      </View></AmbientBackground>
    );
  }

  if (error || !document) {
    return (
      <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
        <DocumentHeader title="Document" />
        <ErrorState message={error ?? 'That document could not be opened.'} onRetry={() => void load()} />
      </View></AmbientBackground>
    );
  }

  // Sharing is how a file leaves an iPhone, so on iOS that button is the save route and says so.
  // The pill only has room for a word, so the longer wording goes to the screen reader instead.
  const saveLabel = canPickFolder ? 'Save' : 'Files';
  const saveHint = canPickFolder ? 'Save to phone' : 'Save to Files';

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <DocumentHeader title={FORMAT_LABELS[document.format]} />
      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 40 : 100) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: colors.foreground }]}>{document.title}</Text>

        <View style={s.chipRow}>
          <View style={[s.chip, { backgroundColor: colors.primary + '1F' }]}>
            <Text style={[s.chipText, { color: colors.primary }]}>{KIND_LABELS[document.kind]}</Text>
          </View>
          <View style={[s.chip, { backgroundColor: colors.muted }]}>
            <Text style={[s.chipText, { color: colors.foreground }]}>{FORMAT_LABELS[document.format]}</Text>
          </View>
        </View>

        <Text style={[s.meta, { color: colors.mutedForeground }]}>
          {extentLabel(document)} · {sizeLabel(document.byteSize)} ·{' '}
          {format(new Date(document.createdAt), 'EEE d MMM yyyy, h:mm a')}
        </Text>
        <Text style={[s.meta, { color: colors.mutedForeground }]}>{document.fileName}</Text>

        {/* A slim toolbar under the title: the two things people do, then delete kept well apart. */}
        <View style={[s.toolbar, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          <ActionButton
            icon="share-2"
            label="Share"
            tone="primary"
            onPress={() => void onShare()}
            busy={busy === 'share'}
            disabled={!onDisk || busy !== null}
          />
          <ActionButton
            icon="download"
            label={saveLabel}
            accessibilityLabel={saveHint}
            onPress={() => void onSave()}
            busy={busy === 'save'}
            disabled={!onDisk || busy !== null}
          />
          <View style={s.spacer} />
          <ActionButton
            icon="trash-2"
            label="Delete"
            tone="quiet"
            iconOnly
            accessibilityLabel="Delete this document"
            onPress={onDelete}
            busy={busy === 'delete'}
            disabled={busy !== null}
          />
        </View>

        {notice ? (
          <View style={[s.notice, { backgroundColor: (notice.bad ? colors.destructive : colors.success) + '18' }]}>
            <Icon
              name={notice.bad ? 'alert-circle' : 'check-circle'}
              size={16}
              color={notice.bad ? colors.destructive : colors.success}
            />
            <Text style={[s.noticeText, { color: colors.foreground }]}>{notice.text}</Text>
          </View>
        ) : null}

        {!onDisk ? (
          <View style={[s.notice, { backgroundColor: colors.destructive + '18' }]}>
            <Icon name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[s.noticeText, { color: colors.foreground }]}>
              The file itself is gone from this phone, so it cannot be shared or saved. The text below is still here.
            </Text>
          </View>
        ) : null}

        <Text style={[s.label, { color: colors.mutedForeground }]}>Preview</Text>
        {content ? (
          <DocumentPreview content={content} />
        ) : (
          <Text style={[s.empty, { color: colors.mutedForeground }]}>
            There is no preview for this document, but the file can still be shared and opened.
          </Text>
        )}

        {document.topic ? (
          <>
            <Text style={[s.label, { color: colors.mutedForeground }]}>What you asked for</Text>
            <Text style={[s.empty, { color: colors.foreground }]}>{document.topic}</Text>
          </>
        ) : null}
      </ScrollView>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 18 },
  title: { fontSize: 21, lineHeight: 28, fontFamily: 'Inter_700Bold' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 11.5, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, padding: 12, marginTop: 14 },
  noticeText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_500Medium' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  spacer: { flex: 1 },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 10,
  },
  empty: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
});
