# Hand-over — read this first

Last updated: 17 Oct 2026, by Claude on the owner's Linux PC.

## Current state

**Whose branches are whose.** The repo belongs to `Sdata0605`; Prashnat works directly on `master`. The owner's
branch is **`dhanush/mobile-app`**: all new work goes there.

- `chore/structure-and-tooling` was the owner's earlier work (repo hygiene, CI, typed Supabase helper, the
  celebrity dashboard split, the music/wallet/bookings splits, the first animated splash). It was merged into
  `master` as pull request [#1](https://github.com/Sdata0605/wishme-mobile-app/pull/1). Leave it alone.
- `dhanush/mobile-app` = that branch plus the splash work below, with **`master` merged in on 17 Oct 2026**
  (one conflict, `app/_layout.tsx`: both sides kept — master's themed status bar and session-ended gate inside the
  branch's navy `AppRoot`). Merge `origin/master` again before proposing it, if Prashnat has pushed since.

**On `dhanush/mobile-app`:**

- **Launch splash = the client's brand video.** `artifacts/mobile/components/splash/AnimatedSplash.tsx` plays
  `assets/videos/splash.mp4` full screen, lays the tagline **"All business in one app"** over the last shot, holds,
  then fades into the first screen (login or home). The onboarding intro video was removed (the splash replaces it).
  - The client sent the clip over WhatsApp (464×832, compressed). `splash.mp4` is that clip with its first 0.57 s
    cut (they showed the AI generator's typo "Wishshe me"), upscaled 4× with Real-ESRGAN `realesr-animevideov3`
    and re-encoded at 1080×1936 (H.264, CRF 15, 4.8 s, ~4 MB).
  - If the client sends the original export, replace `splash.mp4` and update `CLIP_W`, `CLIP_H`, `TAGLINE_AT` and
    `TAGLINE_Y` at the top of `AnimatedSplash.tsx`.
  - Waiting on the client's feedback on the recording `WishMe-splash-video-hd.mp4`.
- No white flash between screens: the navigators paint the app's navy (`app/_layout.tsx`, `app/(auth)/_layout.tsx`,
  `expo-system-ui`), and the splash-to-app screens fade in.
- **Release builds work from a clean `pnpm install`** (Linux, 17 Oct): `babel-preset-expo` is now a declared
  devDependency of the app. It was used by `babel.config.js` but never declared, so pnpm's strict layout hid it
  and the release bundle failed with "Cannot find module 'babel-preset-expo'". The Windows-only items under
  "Known build problem" were not re-tested on Windows.
- **Realtime and the Sarvam relay work against any backend URL**: `SUPABASE_WS_URL` in `constants/supabase.ts`
  (http→ws, https→wss) replaces six copies of `SUPABASE_URL.replace('https://', 'wss://')`, which left an
  `http://` URL for a local backend, so live updates never connected.
- **WishMe is not MyAssistant** (owner's decision, 17 Oct): the centre mic used to open the "AI home", a copy
  of the separate MyAssistant app's home (Prashnat's `1ecee2c`), and the app opened there. On this branch the mic
  now starts/stops the voice assistant in place, the app opens on WishMe Home, the AI home and its
  `components/home` + `services/home/{dailyQuote,dayStreak,weather}` are removed, and the mic is a flat WishMe
  pink→purple disc. **Talk to Prashnat before proposing this branch for `master`**: it removes his AI home. The rest
  of the MyAssistant look (aurora theme, glass cards, Manrope/Space Grotesk, Hub tools) is still in the app; ask the
  owner before rebranding it.
- **Celebrity list empty state**: `hooks/useCelebrities.ts` treated "no celebrities yet" as loading, so an empty
  catalogue spun forever; it now tracks whether the fetch finished and shows "No celebrities found".
- **Open: one intermittent native crash on launch** (17 Oct, WishMe Local on the Samsung, once in about 10 cold
  starts, not reproduced in 6 more): SIGBUS in `expo-font`'s `FontLoaderModule.loadAsync` →
  `Typeface.createFromFile`, i.e. the cached font file changed while it was being read. Worth watching on the
  store build; a durable fix is to embed the fonts at build time with the `expo-font` config plugin (no cache file),
  but `_layout.tsx` registers Manrope/Space Grotesk under the Inter/Playfair names, which that would need reworking.

**Running against the local WishMeBackend** (no Supabase, nothing in production touched):

- Backend: in the WishMeBackend checkout, `./scripts/dev-local.sh` (Postgres + Redis in Docker, schema, API on
  :3000, `adb reverse tcp:3000 tcp:3000`). Sign-up OTP codes are printed in its log.
- App: `artifacts/mobile/.env` (git-ignored) with `EXPO_PUBLIC_SUPABASE_URL=http://localhost:3000` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=` the backend's `SUPABASE_ANON_KEY`. `app.config.js` sees the `http://` URL and
  builds a separate **"WishMe Local"** app (`com.prashantuser1.wishme.local`, cleartext allowed) that installs next
  to the store build. Without that `.env`, builds are exactly as before.
- The phone reaches the PC over USB (`adb reverse`), so keep it plugged in while using WishMe Local.
- Locally, features that need vendor keys answer "not configured": payments (Razorpay), file uploads (B2), AI
  generation and voice (Gemini, ElevenLabs, Sarvam, Vapi, HeyGen, Suno), travel (TBO).

**Branch `claude/backend-migration-plan-f28c94`** (the owner's; pushed, no PR; it sits on top of the merged PR #1):
`docs/BACKEND_MIGRATION_PLAN.md`, `docs/BACKEND_CONTRACT_INVENTORY.md`, `scripts/supabase-audit/`. The audit
itself was run on PC 1; its output is local only (see the working rules in `CLAUDE.md`). A prepared database
hotfix also lives only on PC 1 and has not been applied; ask the owner before touching production.

**New backend:** separate repo https://github.com/dhanuvagman006/WishMeBackend (public), replacing Supabase on the
owner's VPS. Work there happens in its own checkout; read that repo's own docs first.

**Builds:** release APKs are attached to GitHub releases of this repo (pre-releases, tagged `app-<date>-<what>`).
The latest is the splash-video build from 16 Oct 2026.

## Next steps

1. Client feedback on the splash video, then any changes. Get the original video file if they have it.
2. Only when the owner says so, open a pull request from `dhanush/mobile-app` into `master` (and one for the
   backend plan branch). Merge `origin/master` in again first if it has moved.
3. Check the Windows build after the `babel-preset-expo` fix; drop the "Known build problem" items that no longer
   apply.
4. Continue the backend migration in WishMeBackend, following `docs/BACKEND_MIGRATION_PLAN.md`.

## Setting up a PC (Windows)

1. Install Git, Node 22 or newer (Node 24 matches `engines`), and pnpm 10 (`npm i -g pnpm@10`; the lockfile is
   v9 and the workspace uses `minimumReleaseAge`, so pnpm 9/10 rather than newer majors).
2. `git clone https://github.com/Sdata0605/wishme-mobile-app.git`, then `git switch dhanush/mobile-app`.
   Set your git name and email in this clone (`git config user.name` / `user.email`) to match earlier commits.
3. `pnpm install --frozen-lockfile` at the repo root.
4. Checks: `cd artifacts/mobile`, then `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm run selfcheck`.
5. For phone builds: JDK 17, Android SDK (platform-tools, platforms;android-36, build-tools;36.0.0,
   ndk;27.1.12297006, cmake;3.22.1), USB debugging on the phone. Then in `artifacts/mobile`:
   `pnpm exec expo prebuild --platform android` (the `android/` folder is git-ignored), and build with
   `android\gradlew.bat assembleRelease` (JAVA_HOME pointing at JDK 17) or `pnpm exec expo run:android`.
   Install: `adb install -r android/app/build/outputs/apk/release/app-release.apk`.
   Or skip building and install the APK from the latest GitHub release.

### Known build problem (pnpm hoisting on Windows)

A release build from a fresh install crashes at launch until these local fixes are applied. They live outside
git, so redo them on each PC (or do step 3 of "Next steps" for good):

- Two copies of React → `TypeError: Cannot read property 'useRef' of null`. Fix: make the root
  `node_modules/react` and `react-dom` junctions to `artifacts/mobile/node_modules/react` and `react-dom`.
- `babel-preset-expo` sits in the root `node_modules` but cannot see `react-native-worklets`, so the worklets
  Babel plugin is skipped → `[Worklets] Only worklets can be executed synchronously on UI runtime`. Fix: root
  junctions for `react-native-worklets` and `react-native-reanimated` (and `expo`, `expo-router`) to the app's
  copies, then delete `%TEMP%\metro-cache`.
- The RN Gradle plugin passes a relative `--entry-file` that Expo resolves against the workspace root. Fix used on
  PC 1: in `node_modules/@expo/cli/build/src/export/embed/resolveOptions.js`, resolve a relative entry file
  against the project root.
- In `android/app/build.gradle` set `root = file("../../")`; put `sdk.dir=` in `android/local.properties`.
- If Gradle says BUILD SUCCESSFUL but the app did not change, delete
  `android/app/build/generated/{assets,res}/createBundleReleaseJsAndAssets` and `android/app/build/outputs/apk`
  and build again.

## Where things are

- `PROJECT_REPORT.md` — full end-to-end report of the app (architecture, screens, services, risks).
- `artifacts/mobile/` — the app (Expo SDK 54, React Native 0.81, expo-router 6, Reanimated 4).
- `docs/` (on the backend-plan branch) — backend migration plan and API inventory.
