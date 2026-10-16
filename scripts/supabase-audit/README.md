# Supabase audit toolkit

Everything the WishMe backend *is* lives inside the hosted Supabase project `eqikeuqwbphwongtfzhe`: the
Postgres schema with its row-level-security policies and SQL functions, the data, the storage buckets and the
source of ~46 edge functions. None of it is in this repository. This folder exports all of it so the backend
can be rebuilt on the owner's VPS (see [docs/BACKEND_MIGRATION_PLAN.md](../../docs/BACKEND_MIGRATION_PLAN.md),
phase A) and so the contract inventory in [docs/BACKEND_CONTRACT_INVENTORY.md](../../docs/BACKEND_CONTRACT_INVENTORY.md)
can be checked against what the server actually does.

The export needs the **project owner's login**. Nothing here stores or asks for a token: `supabase login`
opens the browser, and `supabase link` asks for the database password in the terminal. Never paste a
token, password or service-role key into a chat window.

## Files

| File | Purpose |
|---|---|
| `run-all.ps1` | Windows PowerShell 5.1 driver: dumps schema, roles, auth/storage schemas, data, storage listings, every edge function, secret *names*. |
| `run-all.sh` | The same steps for Git Bash / macOS / Linux (kept LF by `.gitattributes`). |
| `summarize.mjs` | Plain-Node report over one run's output: tables, RLS policies, functions, triggers, cron, buckets, edge-function env vars, and a cross-check against what the app calls. |
| `functions.txt` | The 46 edge-function slugs the app calls (grep of `/functions/v1/` in `artifacts/mobile`). |
| `tables.txt` | The 47 tables, 6 RPCs and 5 buckets the app uses (grep of `/rest/v1/`, `/rpc/`, `/storage/v1/`). |
| `out/` | Output, one sub-folder per run. **Git-ignored**: contains personal data and bcrypt password hashes. |
| `supabase/` | Created by `supabase init` / `link` / `functions download`. Git-ignored. |

## 1. Install the Supabase CLI on Windows

Pick one. The CLI is a single Go binary. Keep Docker Desktop running while the export runs: depending on the CLI
version, `db dump` and `functions download` run their tools in containers. (The 16 Oct run used CLI 2.121.0 with
Docker Desktop running.) If `supabase login` sits at "Press Enter" without reacting, use
`supabase login --no-browser`: it prints a link and asks for the code shown on that page.

**Scoop** (recommended if you have or want scoop):

```powershell
scoop bucket add supabase https://github.com/supabase/cli.git
scoop install supabase
```

**GitHub release zip**: open <https://github.com/supabase/cli/releases/latest>, download the
`supabase_windows_amd64.zip` asset (older releases name it `supabase_<version>_windows_amd64.zip`), extract
`supabase.exe` into a folder that is on your `PATH` (for example `%LOCALAPPDATA%\Programs\supabase\`), open a
new terminal and check:

```powershell
supabase --version
```

**npx** (if Node 20+ is on your PATH): `npx supabase@latest --version` works without installing; prefix every
`supabase` command below with `npx `. Global `npm install -g supabase` is not supported by the package.

Scoop can also install the two optional helpers: `scoop install postgresql` gives `psql` and `pg_restore`,
useful later for the VPS restore, but nothing in this folder needs them.

## 2. Log in and link (owner only, in your own terminal)

```powershell
cd scripts\supabase-audit
supabase login
supabase init
supabase link --project-ref eqikeuqwbphwongtfzhe
```

- `supabase login` opens a browser page; approve it there. The token is stored by the CLI in your user
  profile, not in this repo.
- `supabase init` creates the `supabase/` folder the CLI needs (answer **N** to the editor-settings questions).
- `supabase link` asks for the **database password** (Supabase dashboard → Project Settings → Database →
  "Reset database password" if nobody knows it). Type it at the prompt. The `db dump` steps may ask for it
  again; type it again there. Do not put it in a file or in shell history.

## 3. Run the export

```powershell
powershell -ExecutionPolicy Bypass -File .\run-all.ps1
```

or, from Git Bash:

```bash
./run-all.sh
```

Flags: `-SkipData` / `--skip-data` (public data; large and personal), `-SkipAuthData` / `--skip-auth-data`
(auth.users, storage metadata), `-SkipFunctions`, `-SkipStorage`. Each step is best-effort: a flag the installed
CLI version does not know is logged in `out/<stamp>/audit.log` and the run continues. Expect a few minutes; the
function downloads are one network call each.

What lands in `out/<stamp>/`:

| Output | Command behind it | What to look for |
|---|---|---|
| `schema.sql` | `supabase db dump --linked` | Tables, constraints, indexes, **RLS policies**, SQL/plpgsql functions (the 6 RPCs), **triggers** (the sign-up trigger that creates `profiles`, any wallet-balance trigger, database webhooks), views, `pg_cron` jobs, realtime publication. |
| `roles.sql` | `db dump --role-only` | Custom roles and grants. |
| `schema-auth-storage.sql` | `db dump --schema auth,storage` | The managed schemas; the **policies on `storage.objects`** decide who may upload where. |
| `data.sql` | `db dump --data-only --use-copy` | Every public row, COPY format, restorable with `psql`. |
| `data-auth.sql` | `db dump --data-only --schema auth` | `auth.users` (bcrypt `encrypted_password`, `email_confirmed_at`, `raw_user_meta_data`), `auth.identities`. This is the input for user migration. |
| `data-storage.sql` | `db dump --data-only --schema storage` | `storage.buckets` (public flag, size limits) and `storage.objects` (every file path, size, owner). |
| `inspect-*.txt` | `supabase inspect db …` | Table sizes and row counts: sizing input for the VPS. |
| `functions-list.txt` | `supabase functions list` | Every **deployed** function, including ones the app never calls (webhook receivers, cron workers). |
| `functions-deployed-but-not-referenced.txt` | diff against `functions.txt` | Exactly those hidden functions: Razorpay/Vapi webhooks, reminder dispatchers, cleanup jobs. Read them first. |
| `functions-referenced-but-not-deployed.txt` | diff the other way | Calls the app makes that 404 today. |
| `functions/<slug>/` | `supabase functions download <slug>` | Source of each function, as deployed. |
| `secrets-names.txt` | `supabase secrets list` | Names and sha256 digests of the project secrets. **No values**. Tells us which third-party keys exist. |
| `storage/buckets.txt`, `storage/<bucket>.txt` | `supabase storage ls` | Bucket names and recursive object listings. |

Then build the report:

```powershell
node .\summarize.mjs .\out\<stamp>
```

It writes `out/<stamp>/SUMMARY.md`: headline counts, tables with RLS status and policies, functions, triggers,
cron jobs, buckets, each edge function's tables / external hosts / env vars, and two cross-check lists against
`tables.txt` and `functions.txt` (missing in the project; present but unused by the app). Node is not on the
PATH on the dev PC used so far; any Node 18+ works, for example
`"C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe" .\summarize.mjs .\out\<stamp>`.

## 4. What the CLI cannot export (dashboard checklist)

Record these by hand (screenshots into `out/<stamp>/dashboard/` are fine; they are git-ignored):

- **Authentication → Providers / Settings**: email confirmations on or off, OTP length and expiry, password
  minimum, rate limits, site URL and redirect URLs, custom **SMTP** settings (host, port, sender; the password is
  in the Secrets vault, do not copy it). The app relies on `send-email-otp` for sign-up and on `/auth/v1/recover`
  for password reset; both send email through this configuration.
- **Authentication → JWT settings**: the JWT secret is needed only if we ever want to validate old tokens; the
  migration plan issues its own tokens, so note its *existence*, not its value.
- **Edge Functions → each function → Details**: "Verify JWT" on or off per function (the app calls
  `send-email-otp`, `verify-email-otp`, `create-razorpay-order` with the **anon** key in some flows, so these
  must have JWT verification off today).
- **Database → Webhooks**: triggers that call edge functions on row changes (if any exist they also appear as
  `supabase_functions.http_request` triggers in `schema.sql`).
- **Database → Extensions**: `pg_cron`, `pg_net`, `pgsodium`/`vault`, `pg_graphql`, `vector` — anything beyond the
  defaults is a dependency to replace.
- **Database → Replication / Realtime**: which tables are in the `supabase_realtime` publication (the app
  subscribes to `profiles`, `bookings`, `music_generations`, `wish_friend_orders`, `image_promotions`,
  `celebrity_favorites`, `conversations`, `messages`).
- **Storage → each bucket → Policies and settings**: public or private, max size, MIME allow-list. The app treats
  `profile-photos`, `verification-docs`, `promotional-content`, `greeting-card-uploads`, `voice-notes` and
  `celebrity-avatars` as **public-URL** buckets (it builds `…/object/public/<bucket>/<path>` itself).
- **Project Settings → API**: the anon key is in the app already; confirm whether the **service-role** key has ever
  been shared outside the edge functions (it would need rotation if so).
- **Project Settings → Integrations / Vault**: third-party keys stored in the vault rather than function secrets.
- **Reports / Logs**: a week of API and function logs gives request volumes per endpoint for sizing (see the open
  questions in the migration plan).
- **Billing / usage**: database size, storage size, egress, function invocations per month.

## 5. External accounts to inventory at the same time

For each: who owns the account, is the key live or test, where does it live (function secret, vault, someone's
laptop). Razorpay (key id, key secret, **webhook secret**, which webhooks are configured and to which URL),
Backblaze B2 (bucket `wishmetoday`, application key id and its capabilities), ElevenLabs, Google AI Studio
(Gemini Live), Sarvam, Vapi (assistants, phone numbers, server URL/webhook), TBO (agency credentials, test vs
production endpoints), HeyGen, the email provider behind `send-email-otp`, and the WhatsApp provider behind
`send-whatsapp-welcome`. Names only in any shared document; the values move straight into the VPS secret store.

## Safety notes

- The CLI never prints secret values; `supabase secrets list` shows digests (in JSON output, the `value` field is the
  SHA-256 digest, not the secret).
- Recent CLIs print JSON instead of tables when output is captured. The scripts and `summarize.mjs` read both forms.
- `out/` and `supabase/` are git-ignored. Before sharing a run with anyone, delete `data.sql` and `data-auth.sql`
  or share only `SUMMARY.md`.
- The scripts only *read* from the project (`db dump`, `functions download`, `storage ls`, `secrets list`,
  `inspect`). They never run `db push`, `db reset`, `functions deploy` or `secrets set`.
