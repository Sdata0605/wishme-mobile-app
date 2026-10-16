#Requires -Version 5.1
<#
.SYNOPSIS
  Exports everything the WishMe Supabase project (eqikeuqwbphwongtfzhe) holds, so the backend can be
  rebuilt elsewhere: schema with RLS policies, SQL functions and triggers; roles; auth and storage schemas;
  a data dump; storage bucket listings; and the source of every deployed edge function.

.DESCRIPTION
  Run from this folder AFTER you have done, in your own terminal:
      supabase login
      supabase init          (creates .\supabase; answer "N" to the editor settings prompts)
      supabase link --project-ref eqikeuqwbphwongtfzhe
  The link step asks for the database password; type it into the terminal prompt. Never paste it, or an
  access token, into a chat.

  Output goes to .\out\<yyyyMMdd-HHmmss>\ (git-ignored). The script never prints secret values: `supabase
  secrets list` only shows names and digests. Each step is best-effort; failures are logged to
  out\<stamp>\audit.log and the script continues, so one unsupported flag does not stop the rest.

.PARAMETER SkipData
  Skip the public-schema data dump (it contains personal data and can be large).
.PARAMETER SkipAuthData
  Skip the auth-schema data dump (auth.users with bcrypt password hashes; needed for user migration).
.PARAMETER SkipFunctions
  Skip downloading edge function sources.
.PARAMETER SkipStorage
  Skip listing storage buckets and objects.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\run-all.ps1
  powershell -ExecutionPolicy Bypass -File .\run-all.ps1 -SkipData
#>
param(
  [switch]$SkipData,
  [switch]$SkipAuthData,
  [switch]$SkipFunctions,
  [switch]$SkipStorage
)

$ErrorActionPreference = 'Continue'
$ExpectedRef = 'eqikeuqwbphwongtfzhe'
Set-Location $PSScriptRoot

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $PSScriptRoot "out\$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $out 'functions') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $out 'storage') | Out-Null
$log = Join-Path $out 'audit.log'

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
  Write-Host $line
  Add-Content -Path $log -Value $line -Encoding utf8
}

# Runs the supabase CLI, captures stdout to a file (optional) and records the exit code. Never throws.
function Run-Step([string]$name, [string[]]$cliArgs, [string]$stdoutFile) {
  Log "== $name"
  Log ("   supabase " + ($cliArgs -join ' '))
  # stderr is left on the console on purpose: the CLI prints progress there and Windows PowerShell 5.1
  # would wrap redirected stderr lines in error records.
  try {
    if ($stdoutFile) {
      & supabase @cliArgs | Out-File -FilePath $stdoutFile -Encoding utf8
    } else {
      & supabase @cliArgs | Out-File -FilePath $log -Append -Encoding utf8
    }
    $code = $LASTEXITCODE
  } catch {
    $code = 1
    Log ("   exception: " + $_.Exception.Message)
  }
  if ($code -ne 0) { Log "   FAILED (exit $code) - see audit.log, continuing" } else { Log "   ok" }
  return ($code -eq 0)
}

# ---------------------------------------------------------------- preflight
$cli = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $cli) {
  Remove-Item -Recurse -Force -Path $out
  Write-Host "supabase CLI not found on PATH. See README.md (scoop or the GitHub release zip). Aborting."
  exit 2
}
Log "WishMe Supabase audit -> $out"
Run-Step 'CLI version' @('--version') (Join-Path $out 'cli-version.txt') | Out-Null

$refFile = Join-Path $PSScriptRoot 'supabase\.temp\project-ref'
if (-not (Test-Path $refFile)) {
  Log "This folder is not linked. Run: supabase init ; supabase link --project-ref $ExpectedRef   (then re-run). Aborting."
  exit 2
}
$linkedRef = (Get-Content $refFile -Raw).Trim()
if ($linkedRef -ne $ExpectedRef) {
  Log "Linked project is '$linkedRef' but the WishMe project is '$ExpectedRef'. Re-link and re-run. Aborting."
  exit 2
}
Log "Linked project: $linkedRef"

# ---------------------------------------------------------------- database
# Schema: every object in the public schema (and other non-managed schemas): tables, constraints,
# indexes, RLS policies, SQL/plpgsql functions (the 6 RPCs and triggers such as the one that creates a
# profiles row on sign-up), views, extensions, cron jobs if pg_cron is used.
Run-Step 'Schema dump (public)' @('db','dump','--linked','-f',(Join-Path $out 'schema.sql')) $null | Out-Null

# Roles and grants (custom roles are not in the schema dump).
Run-Step 'Roles dump' @('db','dump','--linked','--role-only','-f',(Join-Path $out 'roles.sql')) $null | Out-Null

# auth + storage schemas: the managed tables (auth.users, storage.buckets, storage.objects) and, most
# importantly, the RLS policies on storage.objects that decide who may upload to which bucket.
Run-Step 'Schema dump (auth, storage)' @('db','dump','--linked','--schema','auth,storage','-f',(Join-Path $out 'schema-auth-storage.sql')) $null | Out-Null

if (-not $SkipData) {
  Run-Step 'Data dump (public, COPY format)' @('db','dump','--linked','--data-only','--use-copy','-f',(Join-Path $out 'data.sql')) $null | Out-Null
} else { Log "== Data dump skipped (-SkipData)" }

if (-not $SkipAuthData) {
  # auth.users carries encrypted_password (bcrypt), email_confirmed_at, raw_user_meta_data, etc.
  Run-Step 'Data dump (auth schema)' @('db','dump','--linked','--data-only','--use-copy','--schema','auth','-f',(Join-Path $out 'data-auth.sql')) $null | Out-Null
  # storage.buckets (public flag, size limits, mime allow-lists) and storage.objects (paths, sizes, owners).
  Run-Step 'Data dump (storage schema)' @('db','dump','--linked','--data-only','--use-copy','--schema','storage','-f',(Join-Path $out 'data-storage.sql')) $null | Out-Null
} else { Log "== Auth/storage data dump skipped (-SkipAuthData)" }

# Table sizes and row counts help size the VPS and spot tables the app never touches.
Run-Step 'Inspect: table sizes' @('inspect','db','table-sizes','--linked') (Join-Path $out 'inspect-table-sizes.txt') | Out-Null
Run-Step 'Inspect: table record counts' @('inspect','db','table-record-counts','--linked') (Join-Path $out 'inspect-table-record-counts.txt') | Out-Null
Run-Step 'Inspect: index sizes' @('inspect','db','index-sizes','--linked') (Join-Path $out 'inspect-index-sizes.txt') | Out-Null

# ---------------------------------------------------------------- edge functions
if (-not $SkipFunctions) {
  $listFile = Join-Path $out 'functions-list.txt'
  Run-Step 'Edge functions: list' @('functions','list','--project-ref',$ExpectedRef) $listFile | Out-Null

  # Names from the deployed list (table output: ID | NAME | SLUG | STATUS | VERSION | UPDATED_AT).
  $deployed = @()
  if (Test-Path $listFile) {
    foreach ($line in Get-Content $listFile) {
      if ($line -notmatch '\|') { continue }
      $cells = $line.Split('|') | ForEach-Object { $_.Trim() }
      if ($cells.Count -ge 3 -and $cells[0] -match '^[0-9a-f-]{36}$') { $deployed += $cells[2] }
    }
  }
  # Names the app calls (functions.txt); anything listed here but not deployed is reported.
  $expected = Get-Content (Join-Path $PSScriptRoot 'functions.txt') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }
  $all = @($deployed + $expected | Sort-Object -Unique)
  Log ("Deployed functions: {0}; referenced by the app: {1}; union: {2}" -f $deployed.Count, $expected.Count, $all.Count)

  $missing = @($expected | Where-Object { $deployed -notcontains $_ })
  $extra = @($deployed | Where-Object { $expected -notcontains $_ })
  Set-Content -Path (Join-Path $out 'functions-referenced-but-not-deployed.txt') -Value ($missing -join "`r`n") -Encoding utf8
  Set-Content -Path (Join-Path $out 'functions-deployed-but-not-referenced.txt') -Value ($extra -join "`r`n") -Encoding utf8
  if ($extra.Count -gt 0) { Log ("Deployed but never called by the app (webhooks/cron?): " + ($extra -join ', ')) }
  if ($missing.Count -gt 0) { Log ("Called by the app but not deployed: " + ($missing -join ', ')) }

  # `supabase functions download <slug>` writes the deployed bundle to .\supabase\functions\<slug>\ .
  $fnDir = Join-Path $PSScriptRoot 'supabase\functions'
  foreach ($slug in $all) {
    $ok = Run-Step "Download function $slug" @('functions','download',$slug,'--project-ref',$ExpectedRef) $null
    $src = Join-Path $fnDir $slug
    if ($ok -and (Test-Path $src)) {
      Copy-Item -Recurse -Force -Path $src -Destination (Join-Path $out "functions\$slug")
    }
  }

  # Secret NAMES only (the CLI prints name + sha256 digest, never the value). Tells us which third-party
  # keys exist: RAZORPAY_*, ELEVENLABS_*, GEMINI_*, SARVAM_*, VAPI_*, TBO_*, HEYGEN_*, B2_*, SMTP ...
  Run-Step 'Secrets: names and digests' @('secrets','list','--project-ref',$ExpectedRef) (Join-Path $out 'secrets-names.txt') | Out-Null
} else { Log "== Edge functions skipped (-SkipFunctions)" }

# ---------------------------------------------------------------- storage
if (-not $SkipStorage) {
  $bucketsFile = Join-Path $out 'storage\buckets.txt'
  Run-Step 'Storage: buckets' @('storage','ls','ss:///','--experimental','--linked') $bucketsFile | Out-Null
  if (Test-Path $bucketsFile) {
    foreach ($raw in Get-Content $bucketsFile) {
      $b = ($raw.Trim() -replace '^ss:///', '').TrimEnd('/')
      if (-not $b) { continue }
      Run-Step "Storage: list $b" @('storage','ls','-r',"ss:///$b/",'--experimental','--linked') (Join-Path $out "storage\$b.txt") | Out-Null
    }
  }
} else { Log "== Storage skipped (-SkipStorage)" }

# ---------------------------------------------------------------- summary
Log "Done. Next: node .\summarize.mjs `"$out`"   (writes SUMMARY.md next to the dumps)"
Log "Then read README.md section 'What the CLI cannot export' for the dashboard checklist."
