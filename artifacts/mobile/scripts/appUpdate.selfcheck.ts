/**
 * Self-check for picking an in-app update from GitHub releases:
 *
 *   node --experimental-strip-types scripts/appUpdate.selfcheck.ts
 */

await import('./register-ts.mjs');
const m = await import(new URL('../services/appUpdate.ts', import.meta.url).href);

let checks = 0;
function check(name: string, ok: boolean): void {
  checks++;
  if (!ok) throw new Error(`FAILED: ${name}`);
}

const apk = (name: string) => ({ name, browser_download_url: `https://example.com/${name}`, size: 100 });
const rel = (tag: string, assets = [apk('app-release.apk')], extra = {}) => ({ tag_name: tag, assets, ...extra });

check('parses a version', JSON.stringify(m.parseVersion('1.2.3')) === '[1,2,3]');
check('rejects a bad version', m.parseVersion('1.2') === null && m.parseVersion(undefined) === null);
check('reads an app tag', JSON.stringify(m.versionFromTag('app-v2.0.10')) === '[2,0,10]');
check('ignores date tags', m.versionFromTag('app-2026-10-16-splash') === null);
check('compares numerically, not as text', m.compareVersions([1, 10, 0], [1, 9, 0]) > 0);
check('versionCode', m.versionCodeFor([1, 2, 3]) === 10203 && m.versionCodeFor([1, 0, 0]) === 10000);

const installed = [1, 0, 0];
check('nothing newer -> null', m.pickUpdate([rel('app-v1.0.0'), rel('app-v0.9.9')], installed) === null);
check('newer release is offered', m.pickUpdate([rel('app-v1.0.1')], installed)?.tag === 'app-v1.0.1');
check(
  'the newest wins whatever the order',
  m.pickUpdate([rel('app-v1.0.1'), rel('app-v1.2.0'), rel('app-v1.1.5')], installed)?.tag === 'app-v1.2.0',
);
check('drafts are ignored', m.pickUpdate([rel('app-v2.0.0', undefined, { draft: true })], installed) === null);
check('releases without an APK are ignored', m.pickUpdate([rel('app-v2.0.0', [apk('notes.txt')])], installed) === null);
check('old date-tagged builds are ignored', m.pickUpdate([rel('app-2026-10-16-splash')], installed) === null);
check(
  'the APK for the phone ABI wins',
  m.pickUpdate([rel('app-v1.1.0', [apk('wishme-universal.apk'), apk('wishme-arm64-v8a.apk')])], installed, ['arm64-v8a'])
    ?.apkName === 'wishme-arm64-v8a.apk',
);
check(
  'then a universal APK',
  m.pickUpdate([rel('app-v1.1.0', [apk('wishme-x86.apk'), apk('wishme-universal.apk')])], installed, ['arm64-v8a'])
    ?.apkName === 'wishme-universal.apk',
);

console.log(`appUpdate: all ${checks} checks passed`);
