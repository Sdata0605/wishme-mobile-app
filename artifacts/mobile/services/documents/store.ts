/**
 * The user's own library of documents.
 *
 * Documents live on the phone, not on the server: the file has to be on the device to be shared or
 * opened anyway, and nobody's report needs to be uploaded for that to work. A small index in
 * AsyncStorage records what exists, and the written content is kept beside each file so the
 * preview can be redrawn without asking the model for it again.
 *
 * This means documents survive restarts but not reinstalling the app, and they do not follow the
 * user to a new phone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { DocKind, DocumentContent } from './generate';
import { DOCUMENTS_DIR, type DocFormat } from './render';

const INDEX_KEY = 'documents.index.v1';
const CONTENT_FILE = 'content.json';

export interface SavedDocument {
  id: string;
  title: string;
  kind: DocKind;
  format: DocFormat;
  fileName: string;
  uri: string;
  byteSize: number;
  pageCount: number | null;
  wordCount: number;
  /** What the user asked for, kept so the list can say why a document exists. */
  topic: string;
  createdAt: string;
}

/** Sortable and unique without a uuid dependency: the clock, plus a little randomness. */
export function newDocumentId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readIndex(): Promise<SavedDocument[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedDocument[]).filter((row) => typeof row?.id === 'string') : [];
  } catch {
    // A corrupt index is not worth failing over: the user sees an empty library and can make more.
    return [];
  }
}

const writeIndex = (rows: SavedDocument[]) => AsyncStorage.setItem(INDEX_KEY, JSON.stringify(rows));

/** Newest first, which is the order people look for a document they just made. */
export async function listDocuments(): Promise<SavedDocument[]> {
  const rows = await readIndex();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDocument(id: string): Promise<SavedDocument | null> {
  return (await readIndex()).find((row) => row.id === id) ?? null;
}

export async function saveDocument(document: SavedDocument): Promise<void> {
  const rows = (await readIndex()).filter((row) => row.id !== document.id);
  await writeIndex([document, ...rows]);
}

/** Removes the row, the file and the saved content together, so nothing is left behind. */
export async function deleteDocument(id: string): Promise<void> {
  const rows = await readIndex();
  await writeIndex(rows.filter((row) => row.id !== id));
  if (!DOCUMENTS_DIR) return;
  await FileSystem.deleteAsync(`${DOCUMENTS_DIR}${id}`, { idempotent: true });
}

const contentPath = (id: string) => (DOCUMENTS_DIR ? `${DOCUMENTS_DIR}${id}/${CONTENT_FILE}` : null);

export async function saveContent(id: string, content: DocumentContent): Promise<void> {
  const path = contentPath(id);
  if (!path) return;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(content), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/**
 * The content behind one document, for the preview. Null when it cannot be read — a document made
 * before this was stored, or a file the system has cleared — and the screen says so.
 */
export async function readContent(id: string): Promise<DocumentContent | null> {
  const path = contentPath(id);
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
    const parsed = JSON.parse(raw) as DocumentContent;
    return typeof parsed?.title === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether the file is still on disk. Checked before offering to share or save it. */
export async function fileStillThere(document: SavedDocument): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(document.uri);
  return info.exists;
}
