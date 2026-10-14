/**
 * Turns the written content into a real file on the phone, and gets that file out again.
 *
 * A document is only useful if it can be opened in the apps people already have, so each format is
 * produced the way those apps expect: a true PDF through the system print engine, a real .xlsx
 * through SheetJS, and Word-compatible HTML for the Word format rather than a heavy docx library.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { gradients, lightColors } from '@/constants/colors';
import type { DocKind, DocSheet, DocumentContent } from './generate';

export type DocFormat = 'pdf' | 'xlsx' | 'docx' | 'csv' | 'txt' | 'md';

export const DOC_FORMATS: DocFormat[] = ['pdf', 'xlsx', 'docx', 'csv', 'txt', 'md'];

/** What each format is called on screen and out loud. "Word" is clearer to people than "docx". */
export const FORMAT_LABELS: Record<DocFormat, string> = {
  pdf: 'PDF',
  xlsx: 'Excel',
  docx: 'Word',
  csv: 'CSV',
  txt: 'Text',
  md: 'Markdown',
};

const EXTENSIONS: Record<DocFormat, string> = {
  pdf: 'pdf',
  xlsx: 'xlsx',
  // Word, Google Docs and WPS all open Word-flavoured HTML correctly under a .doc extension.
  docx: 'doc',
  csv: 'csv',
  txt: 'txt',
  md: 'md',
};

const MIME_TYPES: Record<DocFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/msword',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
};

/** A grid belongs in a spreadsheet; everything else reads best as a PDF. */
export function defaultFormatFor(kind: DocKind): DocFormat {
  return kind === 'spreadsheet' ? 'xlsx' : 'pdf';
}

export interface RenderedFile {
  uri: string;
  fileName: string;
  byteSize: number;
  /** Only a PDF knows how many pages it came to. */
  pageCount: number | null;
}

/** Everything a file needs to leave the app: where it is, what it is called, and what it is. */
export interface DeliverableFile {
  uri: string;
  fileName: string;
  format: DocFormat;
}

/** Where every document the user has made is kept. */
export const DOCUMENTS_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}wishme-documents/`
  : null;

// ─── Markdown ────────────────────────────────────────────────────────────────

export interface MarkdownSpan {
  text: string;
  bold: boolean;
}

export interface MarkdownBlock {
  type: 'paragraph' | 'bullet';
  spans: MarkdownSpan[];
}

/**
 * The server writes bodies in a deliberately small subset of markdown. Parsing it here, once, is
 * what keeps the PDF and the on-screen preview showing the same thing.
 */
export function parseMarkdown(body: string): MarkdownBlock[] {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const bullet = /^([-*•]|\d+[.)])\s+/.exec(line);
      return {
        type: bullet ? ('bullet' as const) : ('paragraph' as const),
        spans: parseSpans(bullet ? line.slice(bullet[0].length) : line),
      };
    });
}

/** Splits on `**bold**`, keeping the surrounding text. Nothing else is marked up. */
function parseSpans(line: string): MarkdownSpan[] {
  const spans: MarkdownSpan[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match = pattern.exec(line);
  while (match) {
    if (match.index > cursor) spans.push({ text: line.slice(cursor, match.index), bold: false });
    spans.push({ text: match[1], bold: true });
    cursor = match.index + match[0].length;
    match = pattern.exec(line);
  }
  if (cursor < line.length) spans.push({ text: line.slice(cursor), bold: false });
  return spans.length > 0 ? spans : [{ text: line, bold: false }];
}

// ─── Plain text, markdown and CSV ────────────────────────────────────────────

const asPlainText = (content: DocumentContent): string => {
  const lines: string[] = [content.title];
  if (content.subtitle) lines.push(content.subtitle);
  lines.push('');

  if (content.sheet) {
    const widths = content.sheet.columns.map((name, index) =>
      Math.max(name.length, ...content.sheet!.rows.map((row) => row[index]?.length ?? 0)),
    );
    const line = (cells: string[]) => cells.map((value, index) => value.padEnd(widths[index])).join('  ');
    lines.push(line(content.sheet.columns));
    lines.push(widths.map((width) => '-'.repeat(width)).join('  '));
    content.sheet.rows.forEach((row) => lines.push(line(row)));
    if (content.sheet.notes) lines.push('', content.sheet.notes);
    return lines.join('\n');
  }

  (content.sections ?? []).forEach((section) => {
    if (section.heading) lines.push(section.heading.toUpperCase(), '');
    parseMarkdown(section.body).forEach((block) => {
      const plain = block.spans.map((span) => span.text).join('');
      lines.push(block.type === 'bullet' ? `  • ${plain}` : plain);
    });
    lines.push('');
  });
  return lines.join('\n').trimEnd();
};

const asMarkdown = (content: DocumentContent): string => {
  const lines: string[] = [`# ${content.title}`];
  if (content.subtitle) lines.push('', `*${content.subtitle}*`);

  if (content.sheet) {
    lines.push('', `| ${content.sheet.columns.join(' | ')} |`);
    lines.push(`| ${content.sheet.columns.map(() => '---').join(' | ')} |`);
    content.sheet.rows.forEach((row) => lines.push(`| ${row.map((v) => v.replace(/\|/g, '\\|')).join(' | ')} |`));
    if (content.sheet.notes) lines.push('', content.sheet.notes);
    return lines.join('\n');
  }

  (content.sections ?? []).forEach((section) => {
    lines.push('');
    if (section.heading) lines.push(`## ${section.heading}`, '');
    lines.push(section.body.trim());
  });
  return lines.join('\n').trimEnd();
};

/** A cell is quoted whenever it contains anything a reader would otherwise treat as structure. */
const csvCell = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const asCsv = (content: DocumentContent): string => {
  const rows: string[][] = content.sheet
    ? [content.sheet.columns, ...content.sheet.rows]
    : // Prose has no columns of its own, so each section becomes a row that is still readable.
      [['Section', 'Content'], ...(content.sections ?? []).map((s) => [s.heading, flatten(s.body)])];
  if (content.sheet?.notes) rows.push([], ['Notes', content.sheet.notes]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
};

/** Markdown collapsed to one line, for the formats that cannot show structure. */
const flatten = (body: string): string =>
  parseMarkdown(body)
    .map((block) => (block.type === 'bullet' ? `• ${block.spans.map((s) => s.text).join('')}` : block.spans.map((s) => s.text).join('')))
    .join('\n');

// ─── HTML (used by both the PDF and the Word file) ───────────────────────────

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const spansToHtml = (spans: MarkdownSpan[]): string =>
  spans.map((span) => (span.bold ? `<strong>${escapeHtml(span.text)}</strong>` : escapeHtml(span.text))).join('');

function bodyToHtml(body: string): string {
  const blocks = parseMarkdown(body);
  const html: string[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    html.push(`<ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    bullets = [];
  };

  blocks.forEach((block) => {
    if (block.type === 'bullet') {
      bullets.push(spansToHtml(block.spans));
      return;
    }
    flushBullets();
    html.push(`<p>${spansToHtml(block.spans)}</p>`);
  });
  flushBullets();
  return html.join('');
}

/** A figure, a currency amount or a percentage — the cells that belong flush right in a column. */
const NUMERIC_CELL = /^[([]?[-+]?[£$€¥₹]?\s?\d+(?:[,\s]\d{3})*(?:\.\d+)?\s?%?[)\]]?$/;

/**
 * A column is treated as figures only when every filled cell in it is one. Guessing from the
 * majority would right-align a column of mixed notes, which reads worse than leaving it alone.
 */
function numericColumns(sheet: DocSheet): boolean[] {
  return sheet.columns.map((_, index) => {
    const filled = sheet.rows.map((row) => (row[index] ?? '').trim()).filter((value) => value.length > 0);
    return filled.length > 0 && filled.every((value) => NUMERIC_CELL.test(value));
  });
}

function sheetToHtml(content: DocumentContent): string {
  const sheet = content.sheet;
  if (!sheet) return '';
  const numeric = numericColumns(sheet);
  const head = sheet.columns
    .map((name, index) => `<th${numeric[index] ? ' class="fig"' : ''}>${escapeHtml(name)}</th>`)
    .join('');
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, index) => `<td${numeric[index] ? ' class="fig"' : ''}>${escapeHtml(value)}</td>`)
        .join('');
      // Striping is marked in the markup rather than with `:nth-child`, which Word ignores.
      return `<tr${rowIndex % 2 === 1 ? ' class="zebra"' : ''}>${cells}</tr>`;
    })
    .join('');
  const notes = sheet.notes ? `<p class="notes">${escapeHtml(sheet.notes)}</p>` : '';
  return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>${notes}`;
}

function sectionsToHtml(content: DocumentContent): string {
  let numbered = 0;
  return (content.sections ?? [])
    .map((section) => {
      // Section numbers are written into the markup rather than left to CSS counters, because Word
      // supports neither counters nor `::before` when it imports a page.
      if (!section.heading) return `<section>${bodyToHtml(section.body)}</section>`;
      numbered += 1;
      const number = String(numbered).padStart(2, '0');
      return `<section class="ruled"><h2><span class="secno">${number}</span>${escapeHtml(section.heading)}</h2>${bodyToHtml(section.body)}</section>`;
    })
    .join('');
}

/** The word that heads the cover. Kept here because it is a print concern, not a screen one. */
const KIND_EYEBROW: Record<DocKind, string> = {
  report: 'Report',
  letter: 'Letter',
  notes: 'Notes',
  plan: 'Plan',
  spreadsheet: 'Spreadsheet',
};

const madeOn = (): string =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The palette a printed WishMe document uses, taken from the app's own colours so a page that has
 * left the phone still looks like it came from here.
 *
 * `accent` is the app's primary orange, used for fills and rules. Headings use `accentDeep` — the
 * same hue darkened — because #7B5CFA as text on white paper is too pale to read comfortably. Body
 * text stays near-black throughout: colour marks structure, never paragraphs.
 */
const PRINT = {
  ink: lightColors.foreground,
  accent: lightColors.primary,
  accentDeep: '#B8410E',
  wash: '#FFF4EF',
  washRule: '#F2CDBC',
  zebra: '#FBF7F5',
  quiet: '#5A6072',
  faint: '#9AA0B0',
  hair: '#E7E9EE',
} as const;

/**
 * Font stacks that resolve on a real phone rather than on a designer's laptop. iOS has Helvetica
 * Neue and Georgia and no Roboto; Android has Roboto and Noto Serif and neither of the first two.
 * Listing both sides means each platform lands on an installed face, so nothing has to be
 * downloaded or embedded and nothing silently falls back to the wrong shape.
 */
const DISPLAY_FONT = `'Helvetica Neue', Helvetica, Roboto, 'Noto Sans', Arial, sans-serif`;
const BODY_FONT = `Georgia, 'Times New Roman', 'Noto Serif', 'Droid Serif', serif`;

/** The WishMe gradient, as the bar across the top of the first page. */
const BAND_STOPS = gradients.primary.join(', ');

/**
 * Print styling worth keeping: generous page margins, a serif body at a readable measure, and
 * headings that are never left stranded at the foot of a page.
 *
 * `print-color-adjust: exact` is what makes the engine keep the tints and the table header instead
 * of dropping them as "background decoration" the way it does by default.
 *
 * There is deliberately no per-page footer: a page number needs the Paged Media `@bottom-center`
 * margin box, which neither WebView implements, and faking one with a fixed-position element lands
 * it on the first page only. The document closes with a colophon instead.
 */
const PDF_CSS = `
@page { margin: 18mm 16mm 20mm 16mm; }
* { box-sizing: border-box; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  font-family: ${BODY_FONT};
  font-size: 11.5pt;
  line-height: 1.66;
  color: ${PRINT.ink};
  -webkit-text-size-adjust: 100%;
}
.band {
  height: 6px;
  margin: 0 0 20px;
  border-radius: 3px;
  background-color: ${PRINT.accent};
  background-image: linear-gradient(90deg, ${BAND_STOPS});
}
.cover {
  background: ${PRINT.wash};
  border-left: 4mm solid ${PRINT.accent};
  padding: 16px 20px 15px;
  margin: 0 0 30px;
  page-break-inside: avoid;
}
.eyebrow {
  font-family: ${DISPLAY_FONT};
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.17em;
  text-transform: uppercase;
  color: ${PRINT.accentDeep};
  margin: 0 0 9px;
}
h1 {
  font-family: ${DISPLAY_FONT};
  font-size: 25pt;
  line-height: 1.14;
  font-weight: 700;
  letter-spacing: -0.016em;
  color: ${PRINT.ink};
  margin: 0;
}
.subtitle { font-size: 12pt; line-height: 1.48; font-style: italic; color: ${PRINT.quiet}; margin: 10px 0 0; }
.stamp {
  font-family: ${DISPLAY_FONT};
  font-size: 8.5pt;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${PRINT.quiet};
  border-top: 1px solid ${PRINT.washRule};
  padding: 11px 0 0;
  margin: 14px 0 0;
}
section { margin: 0 0 20px; }
section.ruled + section.ruled { border-top: 1px solid ${PRINT.hair}; padding-top: 18px; }
h2 {
  font-family: ${DISPLAY_FONT};
  font-size: 13.5pt;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.005em;
  color: ${PRINT.accentDeep};
  margin: 0 0 10px;
  page-break-after: avoid;
  break-after: avoid;
  page-break-inside: avoid;
}
.secno {
  font-size: 11pt;
  font-weight: 700;
  color: ${PRINT.accent};
  margin-right: 0.6em;
}
p { margin: 0 0 11px; orphans: 2; widows: 2; }
strong { font-weight: 700; color: ${PRINT.ink}; }
ul { margin: 0 0 13px; padding-left: 20px; }
li { margin-bottom: 6px; padding-left: 2px; }
li::marker { color: ${PRINT.accent}; }
table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 2px 0 14px; }
thead { display: table-header-group; }
th {
  font-family: ${DISPLAY_FONT};
  text-align: left;
  background: ${PRINT.accentDeep};
  color: #FFFFFF;
  padding: 8px 9px;
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
td { border-bottom: 1px solid ${PRINT.hair}; padding: 7px 9px; vertical-align: top; }
tr.zebra { background: ${PRINT.zebra}; }
tr.zebra td { background: ${PRINT.zebra}; }
tbody tr:last-child td { border-bottom: 2px solid ${PRINT.accentDeep}; }
th.fig, td.fig { text-align: right; }
tr { page-break-inside: avoid; }
.notes {
  font-size: 10pt;
  line-height: 1.5;
  font-style: italic;
  color: ${PRINT.quiet};
  background: ${PRINT.wash};
  border-left: 3px solid ${PRINT.accent};
  padding: 10px 13px;
  margin: 0;
}
.colophon {
  font-family: ${DISPLAY_FONT};
  font-size: 8pt;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${PRINT.faint};
  text-align: center;
  border-top: 1px solid ${PRINT.hair};
  padding: 11px 0 0;
  margin: 28px 0 0;
}
`;

/** The cover and the document itself. The PDF and the Word file differ only in their wrapper. */
function buildBodyHtml(content: DocumentContent): string {
  const subtitle = content.subtitle ? `<p class="subtitle">${escapeHtml(content.subtitle)}</p>` : '';
  const main = content.sheet ? sheetToHtml(content) : sectionsToHtml(content);
  return `<div class="band"></div>
<header class="cover">
<p class="eyebrow">${escapeHtml(KIND_EYEBROW[content.kind])}</p>
<h1>${escapeHtml(content.title)}</h1>
${subtitle}
<p class="stamp">Written by WishMe &middot; ${escapeHtml(madeOn())}</p>
</header>
${main}
<p class="colophon">End of document &middot; Written by WishMe</p>`;
}

function buildPdfHtml(content: DocumentContent): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(content.title)}</title>
<style>${PDF_CSS}</style>
</head><body>${buildBodyHtml(content)}</body></html>`;
}

/**
 * Word reads HTML, but only lays it out properly when the document declares Word's own namespace
 * and sets the page up through `@page`. With those two things it opens as an editable document.
 *
 * The styling is the same design as the PDF, reduced to what Word's HTML importer actually honours:
 * class selectors, colours, borders and backgrounds. Gradients, `::marker`, `:nth-child` and page
 * breaks are left out, so the file degrades to a clean, correctly coloured document instead of a
 * broken one. Word has no Helvetica Neue or Noto Serif, hence its own pair of stacks.
 */
const WORD_DISPLAY_FONT = `Arial, Helvetica, sans-serif`;
const WORD_BODY_FONT = `Georgia, 'Times New Roman', serif`;

const WORD_CSS = `
@page WordSection1 { size: 21cm 29.7cm; margin: 2.2cm 2cm; }
div.WordSection1 { page: WordSection1; }
body { font-family: ${WORD_BODY_FONT}; font-size: 11.5pt; line-height: 1.5; color: ${PRINT.ink}; }
/* Word collapses an empty div, so the cover carries its own rules rather than a gradient bar. */
.band { display: none; }
.cover {
  background: ${PRINT.wash};
  border-top: 3pt solid ${PRINT.accent};
  border-left: 6pt solid ${PRINT.accent};
  padding: 10pt 12pt;
  margin: 0 0 18pt;
}
.eyebrow {
  font-family: ${WORD_DISPLAY_FONT};
  font-size: 8pt;
  font-weight: bold;
  letter-spacing: 1.5pt;
  text-transform: uppercase;
  color: ${PRINT.accentDeep};
  margin: 0 0 6pt;
}
h1 { font-family: ${WORD_DISPLAY_FONT}; font-size: 22pt; color: ${PRINT.ink}; margin: 0 0 6pt; }
.subtitle { font-size: 12pt; font-style: italic; color: ${PRINT.quiet}; margin: 0 0 6pt; }
.stamp {
  font-family: ${WORD_DISPLAY_FONT};
  font-size: 8.5pt;
  letter-spacing: 0.8pt;
  text-transform: uppercase;
  color: ${PRINT.quiet};
  border-top: 0.75pt solid ${PRINT.washRule};
  padding: 6pt 0 0;
  margin: 0;
}
h2 { font-family: ${WORD_DISPLAY_FONT}; font-size: 13pt; color: ${PRINT.accentDeep}; margin: 16pt 0 6pt; }
.secno { font-size: 11pt; color: ${PRINT.accent}; }
p { margin: 0 0 8pt; }
strong { color: ${PRINT.ink}; }
ul { margin: 0 0 8pt; }
li { margin-bottom: 4pt; }
table { border-collapse: collapse; width: 100%; font-size: 10pt; }
th {
  font-family: ${WORD_DISPLAY_FONT};
  background: ${PRINT.accentDeep};
  color: #FFFFFF;
  border: 0.75pt solid ${PRINT.accentDeep};
  padding: 5pt;
  text-align: left;
}
td { border: 0.75pt solid ${PRINT.hair}; padding: 5pt; vertical-align: top; }
tr.zebra { background: ${PRINT.zebra}; }
tr.zebra td { background: ${PRINT.zebra}; }
th.fig, td.fig { text-align: right; }
.notes {
  font-size: 10pt;
  font-style: italic;
  color: ${PRINT.quiet};
  background: ${PRINT.wash};
  border-left: 2.25pt solid ${PRINT.accent};
  padding: 6pt 8pt;
}
.colophon {
  font-family: ${WORD_DISPLAY_FONT};
  font-size: 8pt;
  letter-spacing: 1pt;
  text-transform: uppercase;
  color: ${PRINT.faint};
  text-align: center;
  border-top: 0.75pt solid ${PRINT.hair};
  padding: 6pt 0 0;
  margin: 20pt 0 0;
}
`;

function buildWordHtml(content: DocumentContent): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"><head>
<meta charset="utf-8" />
<title>${escapeHtml(content.title)}</title>
<style>${WORD_CSS}</style>
</head><body><div class="WordSection1">${buildBodyHtml(content)}</div></body></html>`;
}

// ─── Writing the file ────────────────────────────────────────────────────────

/** A file name a person can recognise in their downloads folder. */
function fileNameFor(title: string, format: DocFormat): string {
  const stem =
    title
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '') || 'document';
  return `${stem}.${EXTENSIONS[format]}`;
}

async function ensureDirectory(): Promise<string> {
  if (!DOCUMENTS_DIR) {
    throw new Error('Documents can only be made in the WishMe app on your phone.');
  }
  const info = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
  return DOCUMENTS_DIR;
}

function buildWorkbook(content: DocumentContent): string {
  const grid: string[][] = content.sheet
    ? [content.sheet.columns, ...content.sheet.rows]
    : [['Section', 'Content'], ...(content.sections ?? []).map((s) => [s.heading, flatten(s.body)])];
  if (content.sheet?.notes) grid.push([], ['Notes', content.sheet.notes]);

  const sheet = XLSX.utils.aoa_to_sheet(grid);
  // Columns sized to their widest cell, because an .xlsx of ### is worse than no file at all.
  sheet['!cols'] = grid[0].map((_, index) => ({
    wch: Math.min(60, Math.max(12, ...grid.map((row) => (row[index] ?? '').length + 2))),
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  return XLSX.write(book, { type: 'base64', bookType: 'xlsx' }) as string;
}

/**
 * Writes the document to the app's own storage and reports what landed there. The file is named
 * after its title, with the document's id as a folder so two reports on the same topic never
 * overwrite each other.
 */
/** Roughly how much body text fits on one printed page at this layout. */
const WORDS_PER_PAGE = 380;

/**
 * How many pages the PDF really came to.
 *
 * `printToFileAsync` reports a page count that cannot be trusted — a 226-word note came back as
 * nine pages. Rather than show the user a number that is plainly wrong, the reported value is only
 * believed when the amount of text could actually fill that many pages; otherwise it is estimated
 * from the writing itself, which never disagrees with what they can see.
 */
function plausiblePageCount(reported: number, words: number): number | null {
  const estimate = Math.max(1, Math.round(words / WORDS_PER_PAGE));
  if (!words) return reported > 0 ? reported : null;
  // Headings, tables and page breaks legitimately spread text out, so allow generous room before
  // calling the reported figure nonsense.
  const ceiling = Math.ceil(words / 120) + 1;
  return reported > 0 && reported <= ceiling ? reported : estimate;
}

export async function renderDocument(
  content: DocumentContent,
  format: DocFormat,
  documentId: string,
): Promise<RenderedFile> {
  const directory = `${await ensureDirectory()}${documentId}/`;
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const fileName = fileNameFor(content.title, format);
  const target = `${directory}${fileName}`;
  let pageCount: number | null = null;

  if (format === 'pdf') {
    const printed = await Print.printToFileAsync({ html: buildPdfHtml(content) });
    // printToFileAsync names the file after a random id, so it is moved to the readable name.
    await FileSystem.moveAsync({ from: printed.uri, to: target });
    pageCount = plausiblePageCount(printed.numberOfPages, content.wordCount);
  } else if (format === 'xlsx') {
    await FileSystem.writeAsStringAsync(target, buildWorkbook(content), {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    const plain =
      format === 'docx'
        ? buildWordHtml(content)
        : format === 'csv'
          ? asCsv(content)
          : format === 'md'
            ? asMarkdown(content)
            : asPlainText(content);
    await FileSystem.writeAsStringAsync(target, plain, { encoding: FileSystem.EncodingType.UTF8 });
  }

  const written = await FileSystem.getInfoAsync(target);
  return { uri: target, fileName, byteSize: written.exists ? written.size : 0, pageCount };
}

// ─── Getting the file out of the app ─────────────────────────────────────────

export type DeliveryResult = { ok: true; message: string } | { ok: false; error: string };

/** Hands the file to the system share sheet, which is also how it reaches iCloud and Files. */
export async function shareDocument(file: DeliverableFile): Promise<DeliveryResult> {
  if (!(await Sharing.isAvailableAsync())) {
    return { ok: false, error: 'Sharing is not available on this device.' };
  }
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: MIME_TYPES[file.format],
      UTI: file.format === 'pdf' ? 'com.adobe.pdf' : undefined,
      dialogTitle: file.fileName,
    });
    return { ok: true, message: 'Shared.' };
  } catch {
    return { ok: false, error: 'The file could not be shared. Please try again.' };
  }
}

/** `Intent.FLAG_GRANT_READ_URI_PERMISSION` — the reader app may read this one file and nothing else. */
const GRANT_READ_URI_PERMISSION = 1;

/**
 * Opens the file in whichever app on the phone already reads that format, rather than inside WishMe.
 *
 * Android gets a real "view" intent: a `file://` path cannot cross an app boundary there, so the
 * file is handed over as a `content://` URI through the app's own provider. If nothing is installed
 * that claims the format the intent throws, and that is reported in plain words rather than left as
 * a silent no-op.
 *
 * iOS has no equivalent intent — the share sheet is where "Open in…" and Quick Look live, so that
 * is the correct route there and not a fallback.
 */
export async function openInDeviceReader(file: DeliverableFile): Promise<DeliveryResult> {
  if (Platform.OS !== 'android') return shareDocument(file);
  try {
    const contentUri = await FileSystem.getContentUriAsync(file.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: MIME_TYPES[file.format],
      flags: GRANT_READ_URI_PERMISSION,
    });
    return { ok: true, message: 'Opened outside WishMe.' };
  } catch {
    return {
      ok: false,
      error: `No app on this phone can open a ${FORMAT_LABELS[file.format]} file. Read it in WishMe, or use Share to send it somewhere that can.`,
    };
  }
}

/** Whether "Save to phone" can put the file somewhere the user chooses themselves. */
export const canPickFolder = Platform.OS === 'android';

/**
 * Copies the file out to a folder the user picks, so they can find it again in their own file
 * manager. Android is the only platform that offers such a picker; on iOS the share sheet is the
 * save route, and the screen says so rather than writing somewhere invisible.
 */
export async function saveToPhone(file: DeliverableFile): Promise<DeliveryResult> {
  if (!canPickFolder) {
    return shareDocument(file);
  }
  try {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return { ok: false, error: 'No folder was chosen, so nothing was saved.' };

    const dot = file.fileName.lastIndexOf('.');
    const stem = dot > 0 ? file.fileName.slice(0, dot) : file.fileName;
    const created = await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      stem,
      MIME_TYPES[file.format],
    );
    // Even text formats are copied as base64, because that is byte-exact for every format.
    const bytes = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.StorageAccessFramework.writeAsStringAsync(created, bytes, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { ok: true, message: `Saved as ${file.fileName} in the folder you chose.` };
  } catch {
    return { ok: false, error: 'The file could not be saved to that folder. Please try another one.' };
  }
}

/** File sizes as people read them, not as bytes. */
export function sizeLabel(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
