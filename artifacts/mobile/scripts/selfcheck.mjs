/**
 * Runs every `scripts/*.selfcheck.ts` in turn and stops at the first failure.
 *
 *   pnpm --filter @workspace/mobile run selfcheck
 *
 * The checks need Node 22.6 or newer (they rely on `--experimental-strip-types`, which Node 24 has on by default).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.selfcheck.ts'))
  .sort();

if (files.length === 0) {
  console.error('No self-check scripts found.');
  process.exit(1);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', path.join(dir, file)], {
    stdio: 'inherit',
    cwd: path.dirname(dir),
  });
  if (result.status !== 0) {
    console.error(`\nFAILED  ${file}`);
    process.exit(result.status ?? 1);
  }
  console.log(`ok      ${file}`);
}
console.log(`\n${files.length} self-check script(s) passed.`);
