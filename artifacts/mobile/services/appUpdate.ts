/**
 * In-app updates from GitHub releases.
 *
 * WishMe is installed from APKs attached to GitHub releases, not from a store. A release counts as an app update
 * when its tag is `app-v<major>.<minor>.<patch>` (e.g. `app-v1.0.1`) and it has an `.apk` asset; other releases
 * (older `app-<date>-<what>` builds, drafts) are ignored. The newest such release is offered when its version is
 * higher than the installed one (`expo.version` in app.json).
 *
 * Pure code (no React Native): see scripts/appUpdate.selfcheck.ts.
 */

/** The repository whose releases carry the APKs. */
export const UPDATE_REPO = 'Sdata0605/wishme-mobile-app';

const TAG = /^app-v(\d+)\.(\d+)\.(\d+)$/;
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

export type Version = [number, number, number];

export function parseVersion(v: string | null | undefined): Version | null {
  const m = VERSION.exec((v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Version from a release tag (`app-v1.2.3`), or null when the tag is not an app release. */
export function versionFromTag(tag: string | null | undefined): Version | null {
  const m = TAG.exec((tag ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Negative, zero or positive, like a sort comparator. */
export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export const formatVersion = (v: Version) => v.join('.');

/**
 * Android versionCode for a version: major*10000 + minor*100 + patch (1.2.3 -> 10203), so every higher version
 * installs as an upgrade. Minor and patch must stay below 100.
 */
export function versionCodeFor(v: Version): number {
  return v[0] * 10_000 + v[1] * 100 + v[2];
}

/** The fields of a GitHub release this module reads. */
export interface GithubRelease {
  tag_name: string;
  name?: string | null;
  body?: string | null;
  draft?: boolean;
  html_url?: string;
  assets?: { name: string; browser_download_url: string; size?: number; content_type?: string }[];
}

export interface AvailableUpdate {
  version: Version;
  tag: string;
  notes: string;
  apkUrl: string;
  apkName: string;
  sizeBytes: number | null;
  pageUrl: string | null;
}

/**
 * The newest app release that is newer than `installed`, or null. When a release has several APKs, one whose name
 * mentions an ABI the phone supports (e.g. `arm64-v8a`) wins, then a `universal` one, then the first.
 */
export function pickUpdate(releases: GithubRelease[], installed: Version, abis: string[] = []): AvailableUpdate | null {
  let best: AvailableUpdate | null = null;
  for (const r of releases) {
    if (r.draft) continue;
    const version = versionFromTag(r.tag_name);
    if (!version || compareVersions(version, installed) <= 0) continue;
    if (best && compareVersions(version, best.version) <= 0) continue;
    const apks = (r.assets ?? []).filter((a) => a.name.toLowerCase().endsWith('.apk'));
    if (apks.length === 0) continue;
    const lower = (s: string) => s.toLowerCase();
    const apk =
      apks.find((a) => abis.some((abi) => lower(a.name).includes(lower(abi)))) ??
      apks.find((a) => lower(a.name).includes('universal')) ??
      apks[0]!;
    best = {
      version,
      tag: r.tag_name,
      notes: (r.body ?? '').trim(),
      apkUrl: apk.browser_download_url,
      apkName: apk.name,
      sizeBytes: typeof apk.size === 'number' ? apk.size : null,
      pageUrl: r.html_url ?? null,
    };
  }
  return best;
}
