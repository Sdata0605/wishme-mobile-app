#!/usr/bin/env node
/**
 * Summarises one audit run (the folder run-all.ps1 / run-all.sh wrote) into SUMMARY.md.
 *
 *   node summarize.mjs out/20261015-120000
 *
 * Plain Node >= 18, no dependencies, never contacts the network. It reads the SQL dumps with regular
 * expressions (good enough for pg_dump output, which is very regular) and reports:
 *   - tables, their column counts, RLS enabled or not, and the policies on each
 *   - SQL / plpgsql functions and triggers (the 6 RPCs, the profiles-on-signup trigger, wallet triggers...)
 *   - views, extensions, pg_cron jobs, realtime publication members
 *   - storage buckets and their public flag (from data-storage.sql)
 *   - edge functions downloaded, and the env vars (Deno.env.get) each one reads = the third-party keys
 *   - cross-checks against tables.txt / functions.txt: app references missing from the project, and
 *     project objects the app never touches (candidates for admin tooling, cron or dead code)
 * Nothing secret is copied into the summary: secret VALUES never appear in any file the CLI writes, and
 * the data dump is only counted (rows per table), never quoted.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2];
if (!outDir || !existsSync(outDir)) {
  console.error('usage: node summarize.mjs <out/<stamp> folder written by run-all>');
  process.exit(2);
}

const read = (name) => (existsSync(join(outDir, name)) ? readFileSync(join(outDir, name), 'utf8') : '');
const listFile = (name) =>
  readFileSync(join(here, name), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

const appTables = listFile('tables.txt').filter((l) => !l.includes(':'));
const appRpcs = listFile('tables.txt').filter((l) => l.startsWith('rpc:')).map((l) => l.slice(4));
const appBuckets = listFile('tables.txt').filter((l) => l.startsWith('bucket:')).map((l) => l.slice(7));
const appFunctions = listFile('functions.txt');

const schema = read('schema.sql');
const authStorageSchema = read('schema-auth-storage.sql');
const data = read('data.sql');
const storageData = read('data-storage.sql');

// ------------------------------------------------------------------ schema.sql
const tables = new Map(); // name -> { columns, rls, policies: [] }
for (const m of schema.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?public"?\."?(\w+)"? \(([\s\S]*?)\n\);/g)) {
  const cols = m[2]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)/i.test(l));
  tables.set(m[1], { columns: cols.length, rls: false, policies: [] });
}
for (const m of schema.matchAll(/ALTER TABLE "?public"?\."?(\w+)"? ENABLE ROW LEVEL SECURITY/g)) {
  if (tables.has(m[1])) tables.get(m[1]).rls = true;
}
for (const m of schema.matchAll(/CREATE POLICY "([^"]+)" ON "?public"?\."?(\w+)"?([\s\S]*?);\n/g)) {
  const body = m[3].replace(/\s+/g, ' ').trim();
  const cmd = /FOR (ALL|SELECT|INSERT|UPDATE|DELETE)/i.exec(body)?.[1] ?? 'ALL';
  const roles = /TO ([\w", ]+?)(?= USING| WITH CHECK|$)/i.exec(body)?.[1]?.replace(/"/g, '').trim() ?? 'public';
  if (tables.has(m[2])) tables.get(m[2]).policies.push({ name: m[1], cmd, roles, body });
}
const functions = [...schema.matchAll(/CREATE (?:OR REPLACE )?FUNCTION "?public"?\."?(\w+)"?\(([^)]*)\)[\s\S]*?LANGUAGE "?(\w+)"?/g)].map(
  (m) => ({ name: m[1], args: m[2].replace(/\s+/g, ' ').trim(), lang: m[3] }),
);
const triggers = [...schema.matchAll(/CREATE (?:OR REPLACE )?TRIGGER "?(\w+)"? ([\s\S]*?) ON "?(\w+)"?\."?(\w+)"?[\s\S]*?EXECUTE (?:FUNCTION|PROCEDURE) "?(\w+)"?\."?(\w+)"?/g)].map(
  (m) => ({ name: m[1], when: m[2].replace(/\s+/g, ' ').trim(), table: `${m[3]}.${m[4]}`, fn: `${m[5]}.${m[6]}` }),
);
const views = [...schema.matchAll(/CREATE (?:OR REPLACE )?VIEW "?public"?\."?(\w+)"?/g)].map((m) => m[1]);
const extensions = [...schema.matchAll(/CREATE EXTENSION (?:IF NOT EXISTS )?"?([\w-]+)"?/g)].map((m) => m[1]);
const cronJobs = [...(schema + data).matchAll(/cron\.schedule\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*\$\$?([\s\S]*?)\$\$?\s*\)/g)].map(
  (m) => ({ name: m[1], schedule: m[2], command: m[3].replace(/\s+/g, ' ').trim().slice(0, 160) }),
);
const publication = [...schema.matchAll(/ALTER PUBLICATION "?supabase_realtime"? ADD TABLE ONLY "?public"?\."?(\w+)"?/g)].map((m) => m[1]);
const webhookTriggers = triggers.filter((t) => /supabase_functions\.http_request|net\.http_post|http_request/i.test(t.fn));

// ------------------------------------------------------------------ data.sql (row counts only)
const rowCounts = new Map();
for (const m of data.matchAll(/^COPY "?public"?\."?(\w+)"? \([^)]*\) FROM stdin;\n([\s\S]*?)^\\\.$/gm)) {
  rowCounts.set(m[1], m[2] ? m[2].split('\n').filter((l) => l.length).length : 0);
}
for (const m of data.matchAll(/^INSERT INTO "?public"?\."?(\w+)"?/gm)) {
  rowCounts.set(m[1], (rowCounts.get(m[1]) ?? 0) + 1);
}

// ------------------------------------------------------------------ storage
const buckets = [];
const bucketCopy = /^COPY "?storage"?\."?buckets"? \(([^)]*)\) FROM stdin;\n([\s\S]*?)^\\\.$/m.exec(storageData);
if (bucketCopy) {
  const cols = bucketCopy[1].split(',').map((c) => c.trim().replace(/"/g, ''));
  for (const line of bucketCopy[2].split('\n').filter(Boolean)) {
    const cells = line.split('\t');
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
    buckets.push({ id: row.id ?? row.name, public: row.public === 't', fileSizeLimit: row.file_size_limit, allowed: row.allowed_mime_types });
  }
}
const storagePolicies = [...authStorageSchema.matchAll(/CREATE POLICY "([^"]+)" ON "?storage"?\."?objects"?([\s\S]*?);\n/g)].map((m) => ({
  name: m[1],
  body: m[2].replace(/\s+/g, ' ').trim(),
}));
const bucketListing = existsSync(join(outDir, 'storage', 'buckets.txt'))
  ? read(join('storage', 'buckets.txt')).split(/\r?\n/).map((l) => l.trim().replace(/^ss:\/\/\//, '').replace(/\/+$/, '')).filter(Boolean)
  : [];

// ------------------------------------------------------------------ edge functions
const fnDir = join(outDir, 'functions');
const downloaded = existsSync(fnDir) ? readdirSync(fnDir).filter((d) => statSync(join(fnDir, d)).isDirectory()) : [];
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const fnInfo = downloaded.map((slug) => {
  const files = walk(join(fnDir, slug)).filter((f) => /\.(ts|js|tsx|mjs)$/.test(f));
  const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const env = [...new Set([...src.matchAll(/Deno\.env\.get\(\s*['"`]([A-Z0-9_]+)['"`]/g)].map((m) => m[1]))].sort();
  const hosts = [...new Set([...src.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase()))]
    .filter((h) => !/supabase\.co$|deno\.land$|esm\.sh$|jsr\.io$|npmjs\.com$|unpkg\.com$|skypack\.dev$/.test(h))
    .sort();
  const tablesTouched = [...new Set([...src.matchAll(/\.from\(\s*['"`](\w+)['"`]\s*\)/g)].map((m) => m[1]))].sort();
  const rpcs = [...new Set([...src.matchAll(/\.rpc\(\s*['"`](\w+)['"`]/g)].map((m) => m[1]))].sort();
  const usesServiceRole = /SERVICE_ROLE/.test(src);
  const lines = src.split('\n').length;
  return { slug, files: files.length, lines, env, hosts, tablesTouched, rpcs, usesServiceRole };
});
const allEnv = [...new Set(fnInfo.flatMap((f) => f.env))].sort();
const secretsNames = read('secrets-names.txt')
  .split(/\r?\n/)
  .map((l) => l.split('|')[0]?.trim())
  .filter((n) => n && n !== 'NAME' && /^[A-Z][A-Z0-9_]+$/.test(n));

// ------------------------------------------------------------------ cross-checks
const dumpedTables = [...tables.keys()];
const appTablesMissing = appTables.filter((t) => !tables.has(t));
const tablesNotUsedByApp = dumpedTables.filter((t) => !appTables.includes(t));
const dumpedFnNames = functions.map((f) => f.name);
const appRpcsMissing = appRpcs.filter((r) => !dumpedFnNames.includes(r));
const edgeMissing = appFunctions.filter((f) => !downloaded.includes(f));
const edgeExtra = downloaded.filter((f) => !appFunctions.includes(f));
const bucketsKnown = buckets.length ? buckets.map((b) => b.id) : bucketListing;
const appBucketsMissing = appBuckets.filter((b) => !bucketsKnown.includes(b));
const bucketsNotUsedByApp = bucketsKnown.filter((b) => !appBuckets.includes(b));
const tablesWithoutRls = dumpedTables.filter((t) => !tables.get(t).rls);
const tablesWithoutPolicies = dumpedTables.filter((t) => tables.get(t).rls && tables.get(t).policies.length === 0);

// ------------------------------------------------------------------ render
const md = [];
const h = (level, text) => md.push('', `${'#'.repeat(level)} ${text}`, '');
const table = (headers, rows) => {
  md.push(`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`);
  for (const r of rows) md.push(`| ${r.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
};
const list = (items, empty = '_none_') => (items.length ? items.forEach((i) => md.push(`- ${i}`)) : md.push(empty));

md.push(`# Supabase audit summary — ${basename(outDir)}`);
md.push('', `Generated by scripts/supabase-audit/summarize.mjs. Inputs present: ${['schema.sql', 'roles.sql', 'schema-auth-storage.sql', 'data.sql', 'data-auth.sql', 'data-storage.sql', 'functions-list.txt', 'secrets-names.txt'].filter((f) => existsSync(join(outDir, f))).join(', ') || 'none'}.`);

h(2, 'Headline numbers');
table(
  ['What', 'Count'],
  [
    ['Tables in public schema', tables.size],
    ['…with RLS enabled', dumpedTables.length - tablesWithoutRls.length],
    ['…with RLS enabled but NO policies (locked to service role)', tablesWithoutPolicies.length],
    ['…WITHOUT RLS (anon/authenticated can read and write everything the grants allow)', tablesWithoutRls.length],
    ['SQL functions', functions.length],
    ['Triggers', triggers.length],
    ['Database webhooks (triggers that call http)', webhookTriggers.length],
    ['Views', views.length],
    ['pg_cron jobs', cronJobs.length],
    ['Realtime publication members', publication.length],
    ['Storage buckets', bucketsKnown.length],
    ['Edge functions downloaded', downloaded.length],
    ['Distinct env vars read by edge functions', allEnv.length],
  ],
);

h(2, 'Cross-check against the mobile app');
md.push(`The app references ${appTables.length} tables, ${appRpcs.length} RPCs, ${appFunctions.length} edge functions and ${appBuckets.length} buckets (tables.txt, functions.txt).`);
h(3, 'Referenced by the app but missing in the project (would 404 today)');
list([...appTablesMissing.map((t) => `table \`${t}\``), ...appRpcsMissing.map((r) => `rpc \`${r}\``), ...edgeMissing.map((f) => `edge function \`${f}\``), ...appBucketsMissing.map((b) => `bucket \`${b}\``)]);
h(3, 'In the project but never called by the app (admin tooling, cron, webhooks, or dead)');
list([...tablesNotUsedByApp.map((t) => `table \`${t}\` (${rowCounts.get(t) ?? '?'} rows)`), ...edgeExtra.map((f) => `edge function \`${f}\``), ...bucketsNotUsedByApp.map((b) => `bucket \`${b}\``)]);

h(2, 'Tables');
table(
  ['Table', 'Columns', 'Rows (dump)', 'RLS', 'Policies', 'Used by app'],
  dumpedTables.sort().map((t) => {
    const info = tables.get(t);
    return [t, info.columns, rowCounts.get(t) ?? '', info.rls ? 'on' : '**OFF**', info.policies.length, appTables.includes(t) ? 'yes' : ''];
  }),
);

h(2, 'RLS policies');
for (const t of dumpedTables.sort()) {
  const info = tables.get(t);
  if (!info.policies.length) continue;
  md.push('', `**${t}**`, '');
  table(['Policy', 'Command', 'Roles', 'Definition'], info.policies.map((p) => [p.name, p.cmd, p.roles, `\`${p.body.slice(0, 220)}\``]));
}

h(2, 'SQL functions');
table(['Function', 'Arguments', 'Language', 'App RPC?'], functions.map((f) => [f.name, f.args, f.lang, appRpcs.includes(f.name) ? 'yes' : '']));

h(2, 'Triggers');
table(['Trigger', 'Table', 'When', 'Calls'], triggers.map((t) => [t.name, t.table, t.when, t.fn]));
if (webhookTriggers.length) {
  md.push('', 'Database webhooks (http-calling triggers) — these fire edge functions or external URLs on row changes and must be re-created as queue jobs:', '');
  list(webhookTriggers.map((t) => `${t.table}: ${t.name} → ${t.fn}`));
}

h(2, 'Views, extensions, cron, realtime');
md.push(`Views: ${views.join(', ') || '_none_'}`, '', `Extensions: ${extensions.join(', ') || '_none_'}`, '');
md.push('pg_cron jobs:', '');
table(['Job', 'Schedule', 'Command (truncated)'], cronJobs.map((c) => [c.name, c.schedule, `\`${c.command}\``]));
md.push('', `Realtime publication (tables the app can subscribe to): ${publication.join(', ') || '_none found in dump_'}`);

h(2, 'Storage');
table(['Bucket', 'Public', 'Size limit', 'Allowed MIME', 'Used by app'], (buckets.length ? buckets : bucketListing.map((id) => ({ id }))).map((b) => [b.id, b.public === undefined ? '?' : b.public ? 'yes' : 'no', b.fileSizeLimit ?? '', b.allowed ?? '', appBuckets.includes(b.id) ? 'yes' : '']));
md.push('', 'Policies on storage.objects:', '');
list(storagePolicies.map((p) => `**${p.name}**: \`${p.body.slice(0, 220)}\``));

h(2, 'Edge functions');
table(
  ['Function', 'Files', 'Lines', 'Service role?', 'Tables touched', 'RPCs', 'External hosts', 'Env vars'],
  fnInfo
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((f) => [f.slug, f.files, f.lines, f.usesServiceRole ? 'yes' : '', f.tablesTouched.join(', '), f.rpcs.join(', '), f.hosts.join(', '), f.env.join(', ')]),
);
h(3, 'Environment variables / secrets the functions depend on');
md.push('Names only. Compare with secrets-names.txt (what is set in the project) — anything read but not set is a latent failure, anything set but never read can be dropped.', '');
table(['Env var', 'Read by', 'Set in project?'], allEnv.map((e) => [e, fnInfo.filter((f) => f.env.includes(e)).map((f) => f.slug).join(', '), /^SUPABASE_/.test(e) ? 'injected by Supabase' : secretsNames.length ? (secretsNames.includes(e) ? 'yes' : '**no**') : '?']));
const setButUnread = secretsNames.filter((s) => !allEnv.includes(s) && !/^SUPABASE_/.test(s));
if (setButUnread.length) md.push('', `Set in the project but not read by any downloaded function: ${setButUnread.join(', ')}`);

h(2, 'Next steps');
list([
  'Open every function listed under "Service role?" first: they bypass RLS and hold the real business rules (wallet debits, order creation, payouts).',
  'Diff the policies above against docs/BACKEND_CONTRACT_INVENTORY.md: each policy is an authorisation rule the new API must enforce in code.',
  'Everything under "In the project but never called by the app" needs an owner decision: port, replace, or drop.',
  'Keep this folder private; data.sql and data-auth.sql contain personal data and password hashes.',
]);

writeFileSync(join(outDir, 'SUMMARY.md'), md.join('\n') + '\n', 'utf8');
console.log(`wrote ${join(outDir, 'SUMMARY.md')}`);
console.log(`tables ${tables.size}, functions ${functions.length}, triggers ${triggers.length}, policies ${dumpedTables.reduce((n, t) => n + tables.get(t).policies.length, 0)}, edge functions ${downloaded.length}`);
if (appTablesMissing.length || appRpcsMissing.length || edgeMissing.length) {
  console.log(`MISSING in project: tables ${appTablesMissing.join(',') || '-'}; rpcs ${appRpcsMissing.join(',') || '-'}; edge ${edgeMissing.join(',') || '-'}`);
}
