# WishMe workspace

pnpm workspace monorepo. The product is the Expo app in `artifacts/mobile`; the other packages are Replit
template scaffolding that the app does not depend on. A fuller walkthrough is in `PROJECT_REPORT.md`.

## Stack

- **Monorepo**: pnpm workspaces (`artifacts/*`, `lib/*`, `scripts`), Node 24, TypeScript 5.9
- **Mobile app**: Expo SDK 54, Expo Router v6, React Native 0.81, React 19 (New Architecture + React Compiler on)
- **Backend**: Supabase (Postgres via PostgREST, Auth, Edge Functions). The app calls it directly with `fetch`;
  nothing in this repo runs server-side. The database schema and edge functions live in the Supabase project.
- **Payments**: Razorpay through the `create-razorpay-order` / `verify-razorpay-payment` edge functions
- **Voice**: Gemini Live or Sarvam (chosen server-side), audio through a patched `@speechmatics/expo-two-way-audio`
- **Native code**: one Android Expo module (`artifacts/mobile/modules/installed-apps`) and a config plugin

## Structure

```text
wishme-mobile-app/
├── artifacts/
│   ├── mobile/              ★ the WishMe app (see below)
│   ├── api-server/          Express 5 scaffold with one /api/healthz route — not used by the app
│   └── mockup-sandbox/      Vite playground for Replit's mockup tool — not used by the app
├── lib/
│   ├── db/                  Drizzle + pg scaffold; the schema file is empty
│   ├── api-spec/            OpenAPI spec (only /healthz) + Orval config
│   ├── api-zod/             Generated zod schemas from that spec
│   └── api-client-react/    Generated React Query hooks from that spec
├── scripts/                 Root utility package (hello.ts)
├── patches/                 pnpm patch for expo-two-way-audio (24 kHz playback + flush)
├── .github/workflows/ci.yml Typecheck + self-checks + prettier on push and PR
└── PROJECT_REPORT.md        Architecture walkthrough, risks and onboarding notes
```

## Root scripts

- `pnpm run typecheck` — `tsc --build` for the lib packages, then each artifact's own typecheck
- `pnpm run check` — the mobile app's typecheck and self-check scripts (what CI runs)
- `pnpm run format` / `format:check` — Prettier over the mobile app's non-screen code

## `artifacts/mobile` (`@workspace/mobile`)

- **Entry**: `index.js` imports `assistant-hook.ts` first (captures React's fiber root for the voice
  assistant), then `expo-router/entry`.
- **Routing**: `app/_layout.tsx` holds the provider tree and the stack; `app/index.tsx` decides where to land
  (celebrity dashboard, the AI home tab, sign-in or onboarding). The visible tabs are Home, Services, the mic
  orb (AI home), Hub and You; wallet, scan-pay, celebrities, music and voice-call are hidden tabs.
- **Data access**: `constants/supabase.ts` (`supabaseFetch`) and the typed helpers in
  `services/supabaseRest.ts` (`fetchRows`, `fetchOne`, `insertRows`, `updateRows`, `deleteRows`, `callRpc`).
  Prefer the helpers in new code. The Supabase URL and anon key can be overridden with
  `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
- **Auth**: `context/AuthContext.tsx` — Supabase Auth REST, session in AsyncStorage, single-flight token refresh,
  OTP sign-up through the `send-email-otp` / `verify-email-otp` functions.
- **Voice assistant**: `context/VoiceAssistantContext.tsx` owns one `AssistantEngine`
  (`services/voice/engine.ts`) that wraps `services/geminiLive/client.ts` and `services/sarvamLive/client.ts`.
  Tools live in `services/assistant/` (`tools.ts` is the dispatcher; `uiTools.ts` is generic screen control over
  the fiber tree in `screenControl.ts`; `hubTools.ts`, `docTools.ts`). The system prompt is
  `services/assistant/systemPrompt.ts`. Safety rules (no payments, no secret fields, confirm before calls) are
  enforced in code.
- **Services flow**: `components/all-services/ServicesFlow.tsx` is a view state machine for flights, hotels,
  buses (TBO through `services/tboService.ts`) and bills.
- **Celebrity dashboard**: `app/celebrity-dashboard.tsx` is the shell; each tab is a file in
  `components/celebrity-dashboard/`, with the shared types, building blocks and stylesheet in `shared.tsx`.
- **Design tokens**: `constants/neon.ts` (accent-seeded palette, dark/light) via `useTheme().neon`;
  `constants/colors.ts` keeps the older WishMe tokens for existing screens.
- **Scripts**: `pnpm --filter @workspace/mobile run start` (dev client), `android`, `ios`, `typecheck`,
  `selfcheck` (runs every `scripts/*.selfcheck.ts` with plain Node), `check` (both), `eas:build:*`.
  The `dev` script is Replit-specific.

Expo Go cannot run this app (custom native module + patched audio library): use a development build
(`expo run:android` locally with JDK 17 and the Android SDK, or `eas build --profile development`).

## Other packages

- `artifacts/api-server`: `pnpm --filter @workspace/api-server run dev|build`; bundles to `dist/index.cjs`.
- `lib/db`: `pnpm --filter @workspace/db run push` (needs `DATABASE_URL`). No tables are defined.
- `lib/api-spec`: `pnpm --filter @workspace/api-spec run codegen` regenerates `api-zod` and `api-client-react`.
