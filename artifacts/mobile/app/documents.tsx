import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { OpenChooser } from '@/components/documents/OpenChooser';
import { EmptyState, ErrorState, LoadingState } from '@/components/hub/StateViews';
import { HubHeader } from '@/components/hub/HubHeader';
import { useTheme } from '@/context/ThemeContext';
import { openInDeviceReader, type DeliveryResult } from '@/services/documents/render';
import { fileStillThere, listDocuments, type SavedDocument } from '@/services/documents/store';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [documents, setDocuments] = useState<SavedDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chooser, setChooser] = useState<SavedDocument | null>(null);
  const [handingOver, setHandingOver] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDocuments(await listDocuments());
    } catch {
      setError('Your documents could not be read from this phone.');
      setDocuments(null);
    }
  }, []);

  // A document started by voice can finish while this screen is open, so it is reloaded on focus.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openInApp = useCallback((document: SavedDocument) => {
    setChooser(null);
    router.push(`/document/${document.id}` as never);
  }, []);

  const openInPhone = useCallback(async (document: SavedDocument) => {
    setHandingOver(true);
    // The index can outlive the file, and "nothing happened" is a worse answer than saying so.
    const result: DeliveryResult = (await fileStillThere(document))
      ? await openInDeviceReader(document)
      : { ok: false, error: 'That file is no longer on this phone. Open it in WishMe to read the text.' };
    setHandingOver(false);
    setChooser(null);
    if (!result.ok) Alert.alert('That document could not be opened', result.error);
  }, []);

  /**
   * A browser has no document reader to hand a file to, so the web build keeps the old behaviour and
   * goes straight to the reading screen rather than offering a choice that cannot be honoured.
   */
  const onCardPress = useCallback(
    (document: SavedDocument) => {
      if (Platform.OS === 'web') openInApp(document);
      else setChooser(document);
    },
    [openInApp],
  );

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      <HubHeader
        title="Documents"
        right={
          <TouchableOpacity
            onPress={() => void load()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <Icon name="refresh-cw" size={18} color={colors.foreground} />
          </TouchableOpacity>
        }
      />

      {documents === null && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : documents === null ? (
        <LoadingState label="Opening your documents…" />
      ) : (
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 40 : 100) }]}
          showsVerticalScrollIndicator={false}
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
          {documents.length === 0 ? (
            <EmptyState
              icon="copy"
              title="No documents yet"
              message={'Ask the assistant something like "make me a full report on rooftop solar" — it writes it and turns it into a PDF you can share.'}
            />
          ) : (
            <>
              <Text style={[s.intro, { color: colors.mutedForeground }]}>
                Reports, letters, notes, plans and spreadsheets the assistant has written for you. They are kept on
                this phone.
              </Text>
              {documents.map((document) => (
                <DocumentCard key={document.id} document={document} onPress={() => onCardPress(document)} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <OpenChooser
        document={chooser}
        busy={handingOver}
        onOpenInApp={() => {
          if (chooser) openInApp(chooser);
        }}
        onOpenInPhone={() => {
          if (chooser) void openInPhone(chooser);
        }}
        onCancel={() => {
          if (!handingOver) setChooser(null);
        }}
      />
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 14, gap: 12 },
  intro: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular', marginBottom: 2 },
});
