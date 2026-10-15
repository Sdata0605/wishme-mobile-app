# WishMe Mobile App — End-to-End Project Report

Generated 15 Oct 2026 from a read-through of the whole repository at commit `1ecee2c`, then updated after
pulling `e840075` and applying the improvements listed in section 11.
Verification: with a standalone pnpm and a bundled Node 20 found on the machine, `pnpm install --frozen-lockfile`
succeeded, the mobile typecheck passes, and all seven self-check scripts pass (293 checks). No native build or
device run was attempted. See "Build and verification status".

---

## 1. What this project is

**WishMe** is an Expo / React Native app for Indian consumers. It started as a "celebrity video wish"
marketplace (Cameo-style) and has grown into a super-app with three pillars:

1. **Celebrity services** — personalised video wishes, live voice calls, chat, greeting cards, photo wishes,
   image promotions, UGC videos and ads, occasion bookings, subscriptions, and a celebrity-side dashboard.
2. **Everyday services** — flights, hotels, bus tickets (via TBO), bill payments, recharges, UPI scan-and-pay,
   a Razorpay-funded wallet, referrals and membership plans.
3. **"MyAssistant"** — a live voice assistant (Gemini Live or Sarvam) that can operate any screen hands-free,
   place AI phone calls on the user's behalf, write documents, manage reminders and calendar, and open other
   apps on the phone. The app now *opens* on this AI home screen.

The backend is **Supabase** (Postgres via PostgREST, Auth, Edge Functions). The mobile app talks to it
directly with `fetch`; there is no custom API server in the critical path.

---

## 2. Repository layout

```
wishme-mobile-app/                 pnpm workspace monorepo (Replit scaffold)
├── artifacts/
│   ├── mobile/                    ★ THE APP (≈79k lines TS/TSX) — everything that matters is here
│   ├── api-server/                Express 5 scaffold: one /api/healthz route. Not used by the app.
│   └── mockup-sandbox/            Vite + Radix UI playground for Replit's mockup tool. Not used by the app.
├── lib/
│   ├── db/                        Drizzle + pg scaffold. Schema is EMPTY. Not used by the app.
│   ├── api-spec/                  OpenAPI yaml (only /healthz) + Orval config.
│   ├── api-zod/                   Generated zod schemas (only HealthStatus).
│   └── api-client-react/          Generated React Query hooks (only useHealthCheck). Referenced by
│                                  mobile/tsconfig.json but not imported by any screen.
├── scripts/                       Root utility package: one hello.ts.
├── patches/                       pnpm patch for @speechmatics/expo-two-way-audio (24 kHz playback + flush)
├── replit.md                      Short description of the stack and packages (rewritten 15 Oct)
├── pnpm-workspace.yaml            Workspace + catalog + platform-binary overrides + patchedDependencies
├── .github/workflows/ci.yml       Typecheck + self-checks on push/PR (added 15 Oct)
└── .replit                        Replit run config (Node 24, Postgres 16)
```

**Practical takeaway:** treat `artifacts/mobile` as the project. The api-server, lib/db, lib/api-*, and
mockup-sandbox are Replit template leftovers. The app never calls the Express server; it calls Supabase.

---

## 3. Mobile app at a glance

| Item | Value |
|---|---|
| Framework | Expo SDK 54, React Native 0.81.5, React 19.1, New Architecture on, React Compiler on |
| Router | Expo Router v6 (file-based, typed routes) |
| Language | TypeScript 5.9, `strict: true`, `@/*` path alias |
| State | React Context only (no Redux/Zustand). React Query is installed and provided but barely used. |
| Styling | `StyleSheet` + a ported "Daylight/Neon" design-token system (`constants/neon.ts`) |
| Fonts | Manrope (body) + Space Grotesk (headings), registered under legacy `Inter_*` / `PlayfairDisplay_*` names |
| Backend | Supabase project `eqikeuqwbphwongtfzhe` (hard-coded URL + anon key in `constants/supabase.ts`) |
| Payments | Razorpay (`react-native-razorpay`) → Supabase edge fns for order + verification |
| Voice | `@speechmatics/expo-two-way-audio` (patched) → Gemini Live WebSocket or Sarvam relay |
| Native code | One custom Expo module (`modules/installed-apps`, Kotlin, Android only) + a config plugin |
| Screens | 74 route files under `app/` |
| Builds | EAS (`eas.json`: development / preview APK / production AAB), package `com.prashantuser1.wishme` |
| Tests | No Jest/Vitest. Six Node "selfcheck" scripts for pure assistant helpers. No CI. No ESLint config. |

### Line-count distribution

| Directory | Lines | Notes |
|---|---|---|
| `app/` | ~34,000 | Screens. Several are 1–2k lines (music 1,793; wallet 1,451; bookings 1,383). The celebrity dashboard is now a 235-line shell. |
| `components/` | ~28,500 | `all-services/` (travel + bills flows) alone is ~15k; `celebrity-dashboard/` holds the ten dashboard tabs |
| `services/` | ~11,300 | Assistant, voice engines, documents, hub, home widgets, TBO, `supabaseRest.ts` helpers |
| `context/` | 2,248 | 8 providers |
| `scripts/` | ~1,600 | Replit static build, self-checks and their runner |
| `constants/` | ~960 | Supabase, colours/neon tokens, celebrity categories, agent knowledge base |
| `hooks/` | 774 | Data hooks (celebrities, wallet, plan, voices…) |

---

## 4. Boot sequence and navigation

```
index.js
  └─ import './assistant-hook'      ← MUST be first: wraps React DevTools hook to capture fiber root
  └─ import 'expo-router/entry'

app/_layout.tsx  (RootLayout)
  loads fonts → hides splash → provider tree:
  SafeAreaProvider › ErrorBoundary › QueryClientProvider › GestureHandlerRootView › KeyboardProvider
   › ThemeProvider › AuthProvider › AgentStateProvider › AssistantPersonaProvider › VoiceAssistantProvider
   › DrawerProvider › OrderConfirmProvider › <Stack> + AssistantOverlay + AssistantSetupGate
                                               + ReminderNotifications + OccasionInApp

app/index.tsx  (route "/")
  reads AsyncStorage:
    user.role === 'celebrity' → /celebrity-dashboard
    user.role === 'user'      → /(tabs)/assistant      ← app opens on the AI home
    onboarding seen           → /(auth)
    else                      → /onboarding
```

### Tab bar (`app/(tabs)/_layout.tsx`, custom `NeonTabBar`)

Visible: **Home** (`index`) · **Services** (`all-services`) · **[Mic orb]** (`assistant`) · **Hub** · **You** (`profile`).
Hidden but routable tabs: `scan-pay`, `wallet`, `celebrities`, `music`, `voice-call`.
The centre orb is the voice assistant toggle. A `DrawerMenu` (slide-and-scale sidebar, 24 items) wraps the tabs.
A one-time `TourOverlay` highlights the menu, scan button and tabs.

### Stack routes (all `headerShown: false`, declared in `_layout.tsx`)

Grouped by domain:

- **Auth:** `(auth)/index` (Sign In / Sign Up / Celebrity tabs), `(auth)/verify-otp`, `onboarding`, `permissions`, `celebrity-signup`, `select-plan`, `assistant-setup`
- **Celebrity:** `celebrity/[id]`, `booking/[id]`, `booking-summary`, `bookings`, `chat/[id]`, `messages`, `favorites`, `following`, `wish-celebrity`, `wish-celebrity-occasion/[id]`, `wish-booking/[id]`, `wish-confirmation/[id]`, `wish-congratulations`, `wish-orders`, `occasions`, `occasion-book/[id]`, `occasion-wishes`, `occasion-alerts`, `loved-ones`, `celebrity-dashboard` (10 internal tabs)
- **Creative/AI content:** `(tabs)/music` (7 tabs), `greeting-cards`, `photo-wish`, `image-promotions`, `ugc-videos`, `ugc-ads`, `wish-friend`, `voice-call-wish`, `library`
- **Services/money:** `services/index` (→ `ServicesFlow` state machine), `(tabs)/all-services`, `(tabs)/scan-pay`, `(tabs)/wallet`, `referrals`, `commission`, `for-business`
- **Assistant/Hub:** `(tabs)/assistant` (AI home), `(tabs)/hub`, `calendar`, `event-edit`, `reminders`, `reminder-edit`, `call-logs`, `call-log/[id]`, `ai-calls`, `documents`, `document/[id]`, `finance`, `news`, `features`
- **Account:** `(tabs)/profile`, `edit-profile`, `settings/*` (index, appearance, assistant, security), `support`, `dashboard`

---

## 5. Core subsystems

### 5.1 Auth (`context/AuthContext.tsx`, 884 lines)

- Talks to Supabase Auth REST directly (`/auth/v1/token`, `/signup`, `/recover`, `/user`) — **no `@supabase/supabase-js`**.
- Session + user cached in AsyncStorage (`@wishme/session`, `@wishme/user`, `@wishme/pending_signup`).
- `getValidSession()` decodes the JWT `exp` (pure-JS base64 fallback), refreshes if within 5 min of expiry, single-flight to avoid refresh-token rotation races. Being offline never logs the user out; only a 4xx refusal does.
- Signup is a two-step OTP flow via edge functions `send-email-otp` / `verify-email-otp`.
- Celebrity onboarding: `applyCelebrity`, `applyCelebrityWithAuth` (OTP + signup + `celebrity_applications` insert), `checkCelebrityStatus`.
- `User` carries `profileId` (row in `profiles`), `walletBalance`, `referralCode`, optional `gender` (used for "sir/ma'am").

### 5.2 Supabase access (`constants/supabase.ts`)

`supabaseFetch(path, options, accessToken?)` — adds `apikey`, `Bearer`, JSON headers, 20 s timeout.
Every screen builds PostgREST query strings by hand (e.g. `/rest/v1/profiles?user_id=eq.${id}&select=...`).
`warmUpBackend()` pre-opens TLS and pings the OTP functions when the sign-in screen appears.
The URL and anon key can be overridden per build with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(see `artifacts/mobile/.env.example`).

`services/supabaseRest.ts` (added 15 Oct) wraps the common cases with typed results and a `SupabaseRestError` on
non-2xx: `fetchRows`, `fetchOne`, `insertRows`, `updateRows`, `deleteRows`, `callRpc`. The small data hooks
(`useWallet`, `usePlan`, `useCelebrity`, `useCelebrityFavorites`) use it; prefer it for new code and migrate
screens opportunistically.

**Surface the app depends on (inventoried from source):**

- 45 tables via `/rest/v1/…` — e.g. `profiles, celebrities, bookings, wish_celebrity_orders, wish_friend_orders, wallet_transactions, payment_transactions, plans, platform_settings, conversations, messages, reminders, calendar_events, ai_calls, ai_call_lines, assistant_settings, loved_ones, occasion_alerts, greeting_card_generations, tts_generations, library_items, celebrity_* (applications, events, media, reviews, settings, favorites, wallet_transactions), payout_requests, bank_details, push_tokens`
- 6 RPCs — `create_ugc_ad_order, create_wish_friend_order, get_my_referrals, get_my_referral_history, purchase_celebrity_subscription, validate_referral_code`
- 43 edge functions — auth OTP, Razorpay (`create-razorpay-order`, `verify-razorpay-payment`), TBO (`tbo-flights`, `tbo-hotels`), ElevenLabs ×7, `generate-music/lyrics/check-music-status`, `generate-document`, `generate-greeting-card-ai`, `generate-photo-wish`, `generate-image-promotion`, `vapi-*` (celebrity calls), `ai-call-start/-recording`, `voice-token`, `sarvam-voice`, `b2-get-signed-url`, messaging/email/WhatsApp helpers.
- Media is served from Backblaze B2 (`f005.backblazeb2.com/file/wishmetoday/…`).

**None of these server-side pieces (SQL schema, RLS, edge function code) live in this repo.** You will need
access to the Supabase project (or a separate backend repo) to change backend behaviour.

### 5.3 Voice assistant (the most complex part)

```
NeonTabBar orb / AssistantOverlay
   └─ VoiceAssistantContext (472 lines)        owns ONE AssistantEngine, warms it on login + foreground
        └─ services/voice/engine.ts            picks Gemini or Sarvam from `voice-token {probe:true}`,
             ├─ geminiLive/client.ts (814)     WebSocket to generativelanguage.googleapis.com, ephemeral
             │                                 token minted by `voice-token`; 16 kHz mic in / 24 kHz out;
             │                                 resume handles, reconnects, barge-in, idle timeout 45 s
             └─ sarvamLive/client.ts (624)     WebSocket to a Supabase relay (`sarvam-voice`): STT → chat → TTS
        └─ services/assistant/tools.ts (940)   FUNCTION_DECLARATIONS + runAssistantTool() dispatcher
             ├─ app tools: open_screen (50 screens), go_back, search_flights/hotels/buses, list/choose_option,
             │             choose_fare, open_bill, start_wish, make_music, add_wallet_money, add_occasion,
             │             open_website, open_app, call_contact, ai_call, open_app_settings, set_language,
             │             get_call_result
             ├─ uiTools.ts:  read_screen, tap, fill_field, scroll_screen   ← generic screen control
             ├─ hubTools.ts: add_reminder, add_event, list_upcoming
             └─ docTools.ts: create_document, get_document_status
```

Key mechanisms to understand before touching it:

- **`assistant-hook.ts` + `screenControl.ts`** — captures React's fiber root through the DevTools global hook
  (installed before the renderer loads) and walks `memoizedProps` to find `onPress`/`onChangeText` handlers,
  measures them with `measureInWindow`, and invokes them. This is how "tap the Search button" works on *any*
  screen without per-screen wiring. It is coupled to RN 0.81 / React 19 internals; upgrading RN is the main
  risk here.
- **`bridge.ts`** — screens that own complex state (`ServicesFlow`, results lists) register a controller /
  option set so tools can trigger searches and read out options.
- **`AgentStateContext`** — a "prefill bag"; tools write `{ fromCity, toCity, travelDate… }`, 12 screens
  read via `useAgentPrefill()`/`consumePrefill()` to auto-fill forms.
- **Safety rules are enforced in code, not the prompt:** payments/orders/destructive buttons are never tapped,
  secure/OTP/PIN/card fields never filled or read, calls only after `user_confirmed=true`, only http(s) URLs.
- **Persona** (`AssistantPersonaContext`, `services/assistant/persona.ts`) — name, voice, personality,
  language stored in `assistant_settings`; the whole system prompt is built in `buildSystemInstruction()`
  inside `VoiceAssistantContext.tsx` (worth reading end-to-end — it defines the assistant's behaviour).
- **AI calls** (`aiCalls.ts`) — the assistant phones a contact via the `ai-call-start` edge function, then
  `createAiCallWatcher` polls `ai_calls` and speaks the result back.
- **`appCommand.ts` + `installedApps.ts` + native `InstalledAppsModule.kt`** — "open WhatsApp" is detected
  locally by regex and launched instantly without a model round-trip; the Kotlin module lists launcher apps
  (Android 11+ `<queries>` added by `plugins/withLauncherQueries.js`).

### 5.4 Services flow (`components/all-services/ServicesFlow.tsx`)

A single screen hosting a **24-state view machine** (`ServiceView`): travel → flights → results → fares →
passenger → add-ons → review & pay → success; buses → results → seats → boarding points → passenger;
hotels → results → detail → guest → review & pay → success; bills / recharge / finance → billPay.
All TBO calls go through `services/tboService.ts` → `tbo-flights` / `tbo-hotels` edge functions (credentials
stay server-side). Bill and hotel data in `billData.ts` / `hotelData.ts` is partly static.

### 5.5 Money

- **Wallet** (`app/(tabs)/wallet.tsx`): add money = `create-razorpay-order` → `RazorpayCheckout.open` →
  `verify-razorpay-payment` → insert `payment_transactions` + `wallet_transactions`. Withdraw button exists.
- **Scan & Pay** (`components/scan-pay/ScanPayScreen.tsx`): parses `upi://` QR or a typed UPI id and debits
  the wallet through Supabase. (Note: it does not go through NPCI/UPI rails; it is a wallet ledger entry.)
- **Plans / subscriptions**: `usePlan.ts`, `select-plan.tsx`, RPC `purchase_celebrity_subscription`.
- **Referrals / commission**: L1 10 % / L2 5 % (`constants/mockData.ts`), RPCs `get_my_referrals*`.
- **Celebrity side**: earnings, payouts (`payout_requests`, `bank_details`), TDS tab.

### 5.6 Hub (local-first productivity)

- **Reminders / calendar** rows live on the server (`reminders`, `calendar_events`) so a server dispatcher
  can call the user; but **the phone schedules its own local notifications** (`services/hub/notifications.ts`),
  re-synced on every launch/foreground because Android drops alarms on reboot.
- **Documents** (`services/documents/*`): the `generate-document` function returns structure; the phone renders
  PDF (expo-print), XLSX (SheetJS), Word-HTML, CSV, TXT, MD and keeps an index in AsyncStorage. Documents never
  leave the device.
- **Finance ledger** (`services/finance/store.ts`): EMIs/incomes/expenses in AsyncStorage per user.
- **Home widgets**: weather (Open-Meteo), news (Google News RSS), daily quote, day streak — all cached locally.
- **Occasion alerts** (`services/occasionAlerts.ts`): birthdays/anniversaries → local notifications + in-app card.

### 5.7 Theme (`context/ThemeContext.tsx`, `constants/neon.ts`, `constants/colors.ts`)

Dark/light + a user-chosen **accent seed** from which the whole palette is re-derived (ported 1:1 from a
Flutter "MyAssistant" app, per the comments). Use `useTheme().neon` for new UI; `colors`/`gradients` are the
older WishMe tokens kept for existing screens.

---

## 6. Data flow cheat-sheet

```
Screen ──useAuth().getValidSession()──► access_token
       ──supabaseFetch('/rest/v1/<table>?…', {…}, token)──► PostgREST (RLS applies)
       ──supabaseFetch('/functions/v1/<fn>', {method:'POST', body}, token)──► Edge Function ──► 3rd party
                                                                              (Razorpay, TBO, ElevenLabs,
                                                                               Gemini, Sarvam, Vapi, HeyGen, B2)
Voice ──AssistantEngine──► Gemini WS (token from voice-token) | Sarvam relay WS
      ◄──tool call──  runAssistantTool() ──► router.push / bridge controller / fiber-tree tap / Supabase
```

Local persistence: AsyncStorage keys are namespaced `@wishme/*` (auth, onboarding, tour, voice engine,
persona cache) or `<feature>_v1` (home widgets, streak, documents index, finance ledger).

---

## 7. Build, run, and verification status

### Verified on 15 Oct 2026
- `pnpm install --frozen-lockfile` succeeds (pnpm 10.34.7, 1,123 packages, ~6 min cold). The esbuild postinstall
  warns because the workspace overrides drop its Windows binary; it downloads one itself and finishes.
- `tsc -p tsconfig.json --noEmit` in `artifacts/mobile` passes (about 26 s). Two pre-existing errors in
  `scripts/*.selfcheck.ts` (`node:module` has no types in this package) were resolved by excluding `scripts/`
  from the app's tsconfig: those files are Node programs run directly, not app code.
- All seven self-check scripts pass (293 checks). They need Node >= 22.6 for `--experimental-strip-types`; on the
  Node 20 available here they were run through an equivalent TypeScript-transpiling loader.
- No secrets beyond the Supabase **anon** key are in the repo.

### Not verified
- Metro bundling, `expo prebuild`, EAS builds, and anything on a device. Node 24, the Android SDK, JDK 17 and adb
  are still not installed on this PC (only a Node 20 bundled with Adobe Creative Cloud was used).

### Local setup you'll need

```bash
# 1. Install Node 24 (nvm-windows or the installer) then:
corepack enable && corepack prepare pnpm@latest --activate
# 2. From repo root (preinstall hook refuses npm/yarn):
pnpm install
# 3. Typecheck the app
pnpm --filter @workspace/mobile typecheck
# 4. Run on a device — Expo Go is NOT enough (custom native module + patched audio lib):
pnpm --filter @workspace/mobile exec expo prebuild --platform android
pnpm --filter @workspace/mobile exec expo run:android      # needs Android SDK + JDK 17
#    or a cloud dev build:
pnpm --filter @workspace/mobile run eas:build:android --profile development
# 5. Pure-logic checks
cd artifacts/mobile && node --experimental-strip-types scripts/screenControl.selfcheck.ts
```

Notes:
- The `dev` script in `artifacts/mobile/package.json` is Replit-specific (uses `$REPLIT_*` vars). Locally use
  `pnpm --filter @workspace/mobile exec expo start --dev-client`.
- `JAVA_HOME` on this PC points at JDK 11; RN 0.81 needs **JDK 17**.
- Web (`expo start --web`) is only a visual preview: native-only modules are stubbed via `metro.config.js`.

---

## 8. Code quality observations

**Strengths**
- Excellent in-code documentation: nearly every service file opens with a design rationale, and tricky
  internals (fiber hook, audio sample rates, token refresh) explain *why*.
- Strict TypeScript, no `eslint-disable` sprawl, only ~23 `any` casts across 80k lines.
- Safety-critical behaviour (payments, secrets, calls) is enforced in code paths, not left to the LLM prompt.
- Defensive networking: timeouts, single-flight refresh, offline-tolerant session restore, reconnect logic.

**Weaknesses / risks (in rough priority order)**

1. **No automated tests.** Seven Node self-checks cover pure helpers; nothing guards the big screens.
   CI now runs typecheck + self-checks on every push (added 15 Oct), but there are still no component tests.
2. **No backend code in repo.** 45 tables, 6 RPCs, 43 edge functions are referenced by string; schema drift
   (e.g. the `plan_discount_pct` incident in git history) is discovered at runtime.
3. **Giant screen files** (`music.tsx` 1,793, `wallet.tsx` 1,451, `bookings.tsx` 1,383, …).
   The celebrity dashboard was split on 15 Oct; the same treatment would help the others.
4. **Hand-built PostgREST query strings everywhere** (≈150 call sites). A typed helper now exists
   (`services/supabaseRest.ts`) and the small hooks use it; the screens still need migrating.
5. **React Query is installed but unused**; data fetching is ad-hoc `useEffect` + `useState` in each screen,
   so there is no caching or deduplication across screens.
6. **99 `as never` casts on `router.push`** — typed routes are enabled but routinely bypassed.
7. **Fiber-tree screen control is coupled to RN 0.81 / React 19 internals.** Any RN upgrade must re-verify
   `assistant-hook.ts` and `screenControl.ts` (the comments list exactly which facts they rely on).
8. **Replit scaffolding still present** — `lib/*`, `api-server`, `mockup-sandbox` are unused by the app but
   wired into `.replit` and the root `tsconfig.json`, so they were left in place. (The stale root
   `app.json`/`eas.json` and the dead `constants/mockData.ts` were removed on 15 Oct.)
9. **Permissions footprint is large** (contacts, call phone, camera, mic, media, exact alarms, boot). Expect
    Play Store review questions; `permissions.tsx` and `services/permissions.ts` handle the UX side.
10. **Scan & Pay is a wallet ledger entry, not a real UPI payment.** Make sure product expectations match.
11. **Mixed line endings in git.** Most committed files are CRLF, some are LF, and `core.autocrlf=true` is set
    locally. Harmless, but a `.gitattributes` normalisation commit would stop editors producing noisy diffs.

---

## 9. Where to start as a new contributor

1. **Read these five files first** (≈2,500 lines, gives you 80 % of the mental model):
   - `artifacts/mobile/app/_layout.tsx` — provider tree and route list
   - `artifacts/mobile/context/AuthContext.tsx` — session handling
   - `artifacts/mobile/constants/supabase.ts` — how every network call is made
   - `artifacts/mobile/context/VoiceAssistantContext.tsx` — the assistant and its system prompt
   - `artifacts/mobile/services/assistant/tools.ts` — what the assistant can do
2. Then skim one screen per domain: `app/(tabs)/assistant.tsx`, `app/wish-celebrity.tsx`,
   `components/all-services/ServicesFlow.tsx`, `app/(tabs)/wallet.tsx`, `app/(tabs)/hub.tsx`.
3. Get Supabase access (dashboard or a backend repo) — you cannot reason about most features without seeing
   the table shapes and edge function contracts.
4. Set up a **development build** on a physical Android phone (voice, contacts, installed-apps need real
   native code).

### Good next tasks
- Install Node 24 + pnpm properly (the verification above used a temporary pnpm and a borrowed Node 20) so
  `pnpm run check` works from any shell; add JDK 17 and the Android SDK for `expo run:android`.
- Add ESLint (`eslint-config-expo`) — needs a dependency, so it was not added without a lockfile update.
- Migrate the remaining screens from raw `supabaseFetch` + `res.json()` to `services/supabaseRest.ts`, then
  put React Query in front of the hot reads (wallet balance, celebrity list, plan).
- Split `music.tsx`, `wallet.tsx` and `bookings.tsx` the way the celebrity dashboard was split.
- Replace `as never` route casts with proper `Href` types.
- Decide on line endings and add a `.gitattributes` (`* text=auto`) in one normalisation commit.

---

## 10. Improvements applied on 15 Oct 2026 (uncommitted)

All of these are in the working tree, not committed. After they were made, dependencies were installed and the
mobile typecheck and all self-checks were run and pass (see section 7). The typecheck caught one defect in the
split (the TDS tab file exported its date helper instead of the tab), which was fixed.

- **Celebrity dashboard split**: `app/celebrity-dashboard.tsx` (2,261 lines) is now a 235-line shell; the ten
  tabs and the shared types/building blocks/stylesheet live in `components/celebrity-dashboard/`. The split was
  done by a script that sliced at top-level declaration boundaries, computed each file's imports from real
  identifier use, and refused to proceed on any cross-tab reference. A second script confirmed every original
  line is present exactly once and every import resolves.
- **Music, wallet and bookings screens split** the same way: `app/(tabs)/music.tsx` (1,793 → 99 lines),
  `app/(tabs)/wallet.tsx` (1,451 → 127) and `app/bookings.tsx` (1,383 → 248) are now thin shells over
  `components/music/`, `components/wallet/` and `components/bookings/`. Each folder has a `shared.tsx` (types,
  constants, helpers, stylesheet), a few building-block files and one file per tab or card group. The slicing
  script now walks the TypeScript AST (per-declaration identifier use, layered files so a tab can never import a
  sibling tab, every original line verified present exactly once). One part was done by hand: the wallet deposit
  and withdraw sheets lived inside `WalletScreen`, so they became `useDeposit`/`DepositModal` and
  `useWithdraw`/`WithdrawModal` pairs in `components/wallet/`; the state and handler code moved verbatim into the
  hooks, which the screen calls in the same order as before. `tsc --noEmit` passes after each of the three splits.
- **Typed REST helper**: `services/supabaseRest.ts` plus migration of `useWallet`, `usePlan`, `useCelebrity`
  and `useCelebrityFavorites`. Behaviour is unchanged; `usePlan` now tolerates one of its two requests failing.
- **Dead code removed**: `constants/mockData.ts` (only `CATEGORIES` and a type re-export were used) replaced by
  `constants/celebrities.ts`; stale root `app.json` and `eas.json` deleted.
- **Config over constants**: Supabase URL/anon key can be overridden via `EXPO_PUBLIC_SUPABASE_*`; `.env.example`
  added.
- **Scripts**: mobile `start`, `android`, `ios`, `selfcheck` (runs every `scripts/*.selfcheck.ts`), `check`;
  root `check`, `format`, `format:check`; `engines` declared; `.node-version` = 24. The mobile tsconfig now
  excludes `scripts/` (Node programs, not app code), which removes two pre-existing typecheck errors.
- **CI**: `.github/workflows/ci.yml` runs install, typecheck and self-checks on push to master and on PRs.
- **Hygiene**: `.prettierrc`, `.prettierignore`, `.editorconfig` (no line-ending rule, on purpose).
- **Docs**: `replit.md` rewritten to describe the current app; this report updated.

## 11. Glossary of in-repo names

| Term | Meaning |
|---|---|
| MyAssistant | The AI home / assistant persona (ported from an earlier Flutter app); "AI Home" = `(tabs)/assistant` |
| Hub | Calendar + reminders + call logs + documents + finance section |
| Neon / Daylight | The design-token system in `constants/neon.ts` |
| Wish a Celebrity / Wish a Friend | Two order types (`wish_celebrity_orders`, `wish_friend_orders`) |
| UGC | User-generated-content style promo videos/ads made by celebrities |
| TBO | Travel Boutique Online, the flights/hotels supplier behind `tbo-*` edge functions |
| Vapi | Voice-AI provider used for celebrity voice calls and AI phone calls |
| Sarvam | Indian-language voice stack used as alternative assistant engine |
| B2 | Backblaze B2 bucket `wishmetoday` for celebrity media |
| Prefill bag | `AgentStateContext` values the assistant writes and forms read |
| Self-check | A `scripts/*.selfcheck.ts` script runnable with plain Node, no RN |
