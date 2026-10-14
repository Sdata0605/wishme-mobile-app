/**
 * Documents, written by voice.
 *
 * "Make me a full report on solar panels" is one sentence, but writing the thing takes a minute or
 * more. So the tool never waits for the whole job: it gives the model an answer within a few
 * seconds, keeps writing in the background, and the model can ask again with get_document_status.
 * That way the conversation carries on instead of going silent mid-sentence.
 */

import {
  DOC_KINDS,
  generateDocument,
  type DocKind,
  type DocLength,
  type DocumentContent,
  type DocumentRequest,
} from '@/services/documents/generate';
import {
  DOC_FORMATS,
  FORMAT_LABELS,
  defaultFormatFor,
  renderDocument,
  sizeLabel,
  type DocFormat,
} from '@/services/documents/render';
import { newDocumentId, saveContent, saveDocument, type SavedDocument } from '@/services/documents/store';

const str = (description: string) => ({ type: 'STRING', description });

export const DOC_FUNCTION_DECLARATIONS = [
  {
    name: 'create_document',
    description:
      'Write a document for the user and turn it into a real file they can read, share and save: a report, a letter, notes, a plan or a spreadsheet. Use it for "make me a full report on…", "write me a letter to…", "put together a plan for…", "make a spreadsheet of…". Only the topic is needed — work the rest out yourself from what they said and do not interrogate them. Writing takes up to a minute or two, so this answers straight away: tell the user it is being written, carry on talking, and use get_document_status when they ask or after a little while.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: str('What the document should be about, in the user\'s own words, e.g. "the benefits of rooftop solar in Mumbai"'),
        kind: {
          type: 'STRING',
          enum: [...DOC_KINDS],
          description:
            'report = a researched piece with sections. letter = something addressed to a person. notes = short, skimmable points. plan = goal, steps, risks. spreadsheet = a grid of rows and columns. Defaults to report.',
        },
        format: {
          type: 'STRING',
          enum: [...DOC_FORMATS],
          description:
            'The file to make. Leave empty unless the user asked for one: a report becomes a pdf and a spreadsheet becomes an xlsx on their own. docx means a Word file, md means Markdown.',
        },
        title: str('A title, if the user gave one. Otherwise leave empty and one is written.'),
        audience: str('Who it is for, if they said, e.g. "my landlord", "the school principal"'),
        length: {
          type: 'STRING',
          enum: ['short', 'medium', 'long'],
          description: 'short is about one page, medium two to three, long six or more. "Full", "detailed" or "proper" means long.',
        },
        language: str('The language to write in. Leave empty to write in the language the user is speaking.'),
      },
      required: ['topic'],
    },
  },
  {
    name: 'get_document_status',
    description:
      'Check whether a document you asked for is finished, and get its details so you can tell the user. Without document_id it reports on the most recent one. Use it when the user asks "is it ready?", and once on your own a little after starting a long document.',
    parameters: {
      type: 'OBJECT',
      properties: { document_id: str('Id returned by create_document (optional)') },
    },
  },
];

export interface DocToolContext {
  getAccessToken?: () => Promise<string | null | undefined>;
  onAction?: (label: string) => void;
  /**
   * Open one document on screen. Wired from `tools.ts`, which has the router.
   */
  openDocument?: (id: string) => void;
  /**
   * Called when a document finishes being written, so the assistant can say so unprompted. Not
   * wired up yet: for now the model finds out by calling get_document_status.
   */
  onDocumentReady?: (summary: DocumentSummary) => void;
}

/** What the assistant is told about a finished document. */
export interface DocumentSummary {
  document_id: string;
  title: string;
  kind: DocKind;
  format: string;
  pages: number | null;
  words: number;
  size: string;
}

type JobState =
  | { status: 'writing' }
  | { status: 'ready'; document: SavedDocument }
  | { status: 'failed'; error: string };

interface Job {
  id: string;
  topic: string;
  kind: DocKind;
  format: DocFormat;
  startedAt: number;
  state: JobState;
  /** Set once the finished document has been put on screen, so checking again does not reopen it. */
  opened: boolean;
}

/**
 * Documents being written, newest last. Kept in the module rather than in React state because the
 * work outlives whichever screen the user happens to be on.
 */
const jobs: Job[] = [];

/** Two requests this close together are one request the model phrased twice. */
const DUPLICATE_WINDOW_MS = 90_000;

/** Grammar words only. Anything that could distinguish two topics is kept. */
const STOPWORDS = /\b(a|an|the|of|on|in|to|for|about|please|my|me)\b/g;

/**
 * Whether two topics are really the same request. The model rephrases freely, so "how this app
 * works" and "how the WishMe app works" are one document — but the comparison is over the union of
 * both word sets, not the smaller one, so "sales for Q3" and "sales for Q4" stay separate.
 */
function sameRequest(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(STOPWORDS, ' ').split(/\s+/).filter(Boolean));
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size) return false;

  const union = new Set([...left, ...right]);
  let shared = 0;
  for (const w of left) if (right.has(w)) shared++;
  return shared / union.size >= 0.6;
}
const MAX_TRACKED_JOBS = 12;

/** How long the model is made to wait before being told the document is still being written. */
const QUICK_REPLY_MS = 6_000;

const summarize = (document: SavedDocument): DocumentSummary => ({
  document_id: document.id,
  title: document.title,
  kind: document.kind,
  format: FORMAT_LABELS[document.format],
  pages: document.pageCount,
  words: document.wordCount,
  size: sizeLabel(document.byteSize),
});

/**
 * Writes the document, renders the file and files it away. It never rejects: the job carries on
 * after the tool has already answered, so a rejection here would have nobody left to catch it.
 */
async function runJob(job: Job, token: string, request: DocumentRequest, ctx: DocToolContext): Promise<void> {
  try {
    const written = await generateDocument(token, request);
    if (!written.ok) {
      job.state = { status: 'failed', error: written.error };
      return;
    }

    const content: DocumentContent = written.content;
    const file = await renderDocument(content, job.format, job.id);
    const document: SavedDocument = {
      id: job.id,
      title: content.title,
      kind: content.kind,
      format: job.format,
      fileName: file.fileName,
      uri: file.uri,
      byteSize: file.byteSize,
      pageCount: file.pageCount,
      wordCount: content.wordCount,
      topic: job.topic,
      createdAt: new Date().toISOString(),
    };
    await saveDocument(document);
    await saveContent(job.id, content);

    job.state = { status: 'ready', document };
    ctx.onAction?.(`Document ready: ${document.title}`);
    ctx.onDocumentReady?.(summarize(document));
  } catch (ex) {
    job.state = {
      status: 'failed',
      error: ex instanceof Error ? ex.message : 'The file could not be made. Please try again.',
    };
  }
}

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  allowed.includes(value as T) ? (value as T) : null;

/** The reply for a job in whatever state it is in, worded so the model can read it out. */
function report(job: Job, ctx: DocToolContext): Record<string, unknown> {
  if (job.state.status === 'writing') {
    const seconds = Math.round((Date.now() - job.startedAt) / 1000);
    return {
      ok: true,
      document_id: job.id,
      still_writing: true,
      seconds_so_far: seconds,
      note: 'It is not finished yet. Tell the user it is still being written and keep the conversation going. Check again in a little while rather than straight away.',
    };
  }
  if (job.state.status === 'failed') {
    return { ok: false, document_id: job.id, error: job.state.error };
  }

  const document = job.state.document;
  const firstTime = !job.opened;
  if (firstTime) {
    job.opened = true;
    ctx.openDocument?.(document.id);
  }
  const summary = summarize(document);
  return {
    ok: true,
    ...summary,
    note: `It is ready${firstTime ? ' and now open on screen' : ''}. Tell the user in one short sentence, naming the title and ${
      summary.pages ? `how many pages it came to (${summary.pages})` : 'how long it is'
    }, and that they can share it or save it to their phone from the document screen. This document is FINISHED — do not check its status again, and do not write it a second time unless the user asks for something different.`,
  };
}

export async function runDocTool(
  name: string,
  a: Record<string, unknown>,
  ctx: DocToolContext,
): Promise<Record<string, unknown> | null> {
  if (!DOC_FUNCTION_DECLARATIONS.some((d) => d.name === name)) return null;

  if (name === 'get_document_status') {
    const id = String(a.document_id ?? '').trim();
    const job = id ? jobs.find((item) => item.id === id) : jobs[jobs.length - 1];
    if (!job) {
      return {
        ok: false,
        error: id
          ? 'That document is not being tracked any more. Tell the user to look under Documents, where everything already written is kept.'
          : 'No document has been asked for yet. Ask the user what they would like written.',
      };
    }
    return report(job, ctx);
  }

  const topic = String(a.topic ?? '').trim();
  if (topic.length < 3) {
    return { ok: false, error: 'Ask the user what the document should be about. Do not guess a topic.' };
  }

  const token = await ctx.getAccessToken?.();
  if (!token) return { ok: false, error: 'The user needs to log in again.' };

  const kind = oneOf(a.kind, DOC_KINDS) ?? 'report';
  const format = oneOf(a.format, DOC_FORMATS) ?? defaultFormatFor(kind);
  // Notes are meant to be skimmed, so they stay short unless the user asked for more.
  const length: DocLength = oneOf(a.length, ['short', 'medium', 'long'] as const) ?? (kind === 'notes' ? 'short' : 'medium');

  // The model sometimes asks twice in one turn — "how this app works" and "how the WishMe app
  // works" arrived a moment apart and produced two near-identical documents. One request from the
  // user should make one document, so an equivalent job already under way is handed back instead.
  const duplicate = jobs.find(
    (item) =>
      item.state.status === 'writing' &&
      item.format === format &&
      Date.now() - item.startedAt < DUPLICATE_WINDOW_MS &&
      sameRequest(item.topic, topic),
  );
  if (duplicate) {
    return {
      ok: true,
      document_id: duplicate.id,
      still_writing: true,
      kind: duplicate.kind,
      file_format: FORMAT_LABELS[duplicate.format],
      note: `This is already being written — do NOT ask for it again. Say in one short sentence that you are writing it, then carry on. Check later with get_document_status using document_id "${duplicate.id}".`,
    };
  }

  const job: Job = {
    id: newDocumentId(),
    topic: topic.slice(0, 1000),
    kind,
    format,
    startedAt: Date.now(),
    state: { status: 'writing' },
    opened: false,
  };
  jobs.push(job);
  if (jobs.length > MAX_TRACKED_JOBS) jobs.splice(0, jobs.length - MAX_TRACKED_JOBS);

  const request: DocumentRequest = {
    topic: job.topic,
    kind,
    title: String(a.title ?? '').trim() || undefined,
    audience: String(a.audience ?? '').trim() || undefined,
    length,
    language: String(a.language ?? '').trim() || undefined,
  };

  ctx.onAction?.(`Writing your ${kind}…`);

  // Short documents often finish inside the pause after the user stops speaking, and answering
  // with the finished thing is much better than making them ask again.
  const work = runJob(job, token, request, ctx);
  const quick = new Promise<void>((resolve) => setTimeout(resolve, QUICK_REPLY_MS));
  await Promise.race([work, quick]);

  if (job.state.status !== 'writing') return report(job, ctx);

  return {
    ok: true,
    document_id: job.id,
    still_writing: true,
    kind,
    file_format: FORMAT_LABELS[format],
    note: `Say in one short sentence that you are writing the ${kind} now and that it usually takes a minute or two, then carry on normally. Do not stop the conversation and do not ask the user to wait in silence. When they ask, or after a little while, use get_document_status with document_id "${job.id}".`,
  };
}
