/**
 * Asks the server to write a document.
 *
 * The split is deliberate: `generate-document` writes the words and hands back structure, and the
 * phone turns that structure into a real file (see `render.ts`). Nothing here knows about PDFs.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';

/** Prose and grids need different writing, so the server is told which of the two is wanted. */
export type DocKind = 'report' | 'letter' | 'notes' | 'plan' | 'spreadsheet';

export const DOC_KINDS: DocKind[] = ['report', 'letter', 'notes', 'plan', 'spreadsheet'];

export type DocLength = 'short' | 'medium' | 'long';

/** One part of a prose document. `heading` is empty for a letter's paragraphs. */
export interface DocSection {
  heading: string;
  /** Markdown, limited to paragraphs, `- bullets` and `**bold**`. */
  body: string;
}

/** A spreadsheet is a header row, data rows, and at most one line explaining the figures. */
export interface DocSheet {
  columns: string[];
  rows: string[][];
  notes: string | null;
}

/** Everything the server wrote. Exactly one of `sections` and `sheet` is filled in. */
export interface DocumentContent {
  kind: DocKind;
  title: string;
  subtitle: string | null;
  sections: DocSection[] | null;
  sheet: DocSheet | null;
  wordCount: number;
}

export interface DocumentRequest {
  topic: string;
  kind: DocKind;
  title?: string;
  audience?: string;
  length?: DocLength;
  language?: string;
}

export type GenerateResult = { ok: true; content: DocumentContent } | { ok: false; error: string };

/**
 * A long document can take the model well over a minute, so this does not reuse `supabaseFetch`:
 * that helper gives up after twenty seconds, which would abandon work the user is waiting for.
 */
const WRITE_TIMEOUT_MS = 150_000;

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Cells and bodies arrive as strings, but a model can still slip a number or null into a row. */
const cell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return typeof value === 'string' ? value.trim() : '';
};

interface RawResponse {
  ok?: boolean;
  kind?: string;
  title?: string;
  subtitle?: string | null;
  sections?: { heading?: unknown; body?: unknown }[] | null;
  sheet?: { columns?: unknown[]; rows?: unknown[]; notes?: unknown } | null;
  wordCount?: number;
  error?: string;
}

function readSections(raw: RawResponse['sections']): DocSection[] | null {
  if (!Array.isArray(raw)) return null;
  const sections = raw
    .map((item) => ({ heading: text(item?.heading, 160), body: typeof item?.body === 'string' ? item.body : '' }))
    .filter((section) => section.heading.length > 0 || section.body.trim().length > 0);
  return sections.length > 0 ? sections : null;
}

function readSheet(raw: RawResponse['sheet']): DocSheet | null {
  if (!raw || !Array.isArray(raw.columns) || !Array.isArray(raw.rows)) return null;
  const columns = raw.columns.map(cell).filter((name) => name.length > 0);
  if (columns.length === 0) return null;
  // Every row is padded or trimmed to the header, so the grid is always rectangular.
  const rows = raw.rows
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => columns.map((_, index) => cell(row[index])))
    .filter((row) => row.some((value) => value.length > 0));
  return { columns, rows, notes: text(raw.notes, 400) || null };
}

/**
 * Writes one document. Every failure comes back as a sentence the assistant can read aloud —
 * including the one case only the account owner can fix, which the server reports as a 503.
 */
export async function generateDocument(
  accessToken: string,
  request: DocumentRequest,
): Promise<GenerateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-document`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: request.topic,
        kind: request.kind,
        title: request.title,
        audience: request.audience,
        length: request.length ?? 'medium',
        language: request.language,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as RawResponse;

    if (!res.ok || body.ok !== true) {
      if (res.status === 401) return { ok: false, error: 'Please sign in again to write documents.' };
      return {
        ok: false,
        error: text(body.error, 300) || 'The document could not be written. Please try again.',
      };
    }

    const kind = DOC_KINDS.includes(body.kind as DocKind) ? (body.kind as DocKind) : request.kind;
    const sections = readSections(body.sections);
    const sheet = readSheet(body.sheet);
    if (!sections && !sheet) {
      return { ok: false, error: 'The document came back empty. Please try again.' };
    }

    return {
      ok: true,
      content: {
        kind,
        title: text(body.title, 150) || text(request.title, 150) || request.topic.slice(0, 80),
        subtitle: text(body.subtitle, 200) || null,
        sections,
        sheet,
        wordCount: Number.isFinite(body.wordCount) ? Number(body.wordCount) : 0,
      },
    };
  } catch (ex) {
    if (ex instanceof Error && ex.name === 'AbortError') {
      return { ok: false, error: 'Writing the document took too long. Please try a shorter one.' };
    }
    return { ok: false, error: 'Could not reach the server. Check the connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}
