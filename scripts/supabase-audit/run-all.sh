#!/usr/bin/env bash
# Exports everything the WishMe Supabase project (eqikeuqwbphwongtfzhe) holds: schema with RLS policies and
# SQL functions, roles, auth/storage schemas, data, storage listings and the source of every edge function.
#
# Run from this folder AFTER, in your own terminal:
#     supabase login
#     supabase init
#     supabase link --project-ref eqikeuqwbphwongtfzhe      (type the DB password at the prompt; never in a chat)
#
# Usage: ./run-all.sh [--skip-data] [--skip-auth-data] [--skip-functions] [--skip-storage]
# Output: ./out/<stamp>/ (git-ignored). Every step is best-effort and logged to out/<stamp>/audit.log.
# Same steps as run-all.ps1; keep the two in sync. This file must stay LF (see .gitattributes).

set -u
cd "$(dirname "$0")"

EXPECTED_REF="eqikeuqwbphwongtfzhe"
SKIP_DATA=0; SKIP_AUTH_DATA=0; SKIP_FUNCTIONS=0; SKIP_STORAGE=0
for arg in "$@"; do
  case "$arg" in
    --skip-data) SKIP_DATA=1 ;;
    --skip-auth-data) SKIP_AUTH_DATA=1 ;;
    --skip-functions) SKIP_FUNCTIONS=1 ;;
    --skip-storage) SKIP_STORAGE=1 ;;
    *) echo "unknown flag: $arg"; exit 2 ;;
  esac
done

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$PWD/out/$STAMP"
mkdir -p "$OUT/functions" "$OUT/storage"
LOG="$OUT/audit.log"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }

# run_step <name> <stdout-file-or-"-"> -- <supabase args...>
run_step() {
  local name="$1" stdout="$2"; shift 2; [ "$1" = "--" ] && shift
  log "== $name"
  log "   supabase $*"
  if [ "$stdout" = "-" ]; then
    supabase "$@" >>"$LOG"
  else
    supabase "$@" >"$stdout"
  fi
  local code=$?
  if [ $code -ne 0 ]; then log "   FAILED (exit $code), continuing"; else log "   ok"; fi
  return $code
}

# ---------------------------------------------------------------- preflight
log "WishMe Supabase audit -> $OUT"
if ! command -v supabase >/dev/null 2>&1; then
  log "supabase CLI not found on PATH. See README.md. Aborting."; exit 2
fi
run_step "CLI version" "$OUT/cli-version.txt" -- --version || true

REF_FILE="supabase/.temp/project-ref"
if [ ! -f "$REF_FILE" ]; then
  log "Not linked. Run: supabase init && supabase link --project-ref $EXPECTED_REF  then re-run. Aborting."; exit 2
fi
LINKED_REF="$(tr -d '[:space:]' <"$REF_FILE")"
if [ "$LINKED_REF" != "$EXPECTED_REF" ]; then
  log "Linked project is '$LINKED_REF', expected '$EXPECTED_REF'. Re-link and re-run. Aborting."; exit 2
fi
log "Linked project: $LINKED_REF"

# ---------------------------------------------------------------- database
run_step "Schema dump (public)" - -- db dump --linked -f "$OUT/schema.sql" || true
run_step "Roles dump" - -- db dump --linked --role-only -f "$OUT/roles.sql" || true
run_step "Schema dump (auth, storage)" - -- db dump --linked --schema auth,storage -f "$OUT/schema-auth-storage.sql" || true

if [ $SKIP_DATA -eq 0 ]; then
  run_step "Data dump (public, COPY format)" - -- db dump --linked --data-only --use-copy -f "$OUT/data.sql" || true
else log "== Data dump skipped (--skip-data)"; fi

if [ $SKIP_AUTH_DATA -eq 0 ]; then
  run_step "Data dump (auth schema)" - -- db dump --linked --data-only --use-copy --schema auth -f "$OUT/data-auth.sql" || true
  run_step "Data dump (storage schema)" - -- db dump --linked --data-only --use-copy --schema storage -f "$OUT/data-storage.sql" || true
else log "== Auth/storage data dump skipped (--skip-auth-data)"; fi

run_step "Inspect: table sizes" "$OUT/inspect-table-sizes.txt" -- inspect db table-sizes --linked || true
run_step "Inspect: table record counts" "$OUT/inspect-table-record-counts.txt" -- inspect db table-record-counts --linked || true
run_step "Inspect: index sizes" "$OUT/inspect-index-sizes.txt" -- inspect db index-sizes --linked || true

# ---------------------------------------------------------------- edge functions
if [ $SKIP_FUNCTIONS -eq 0 ]; then
  LIST="$OUT/functions-list.txt"
  run_step "Edge functions: list" "$LIST" -- functions list --project-ref "$EXPECTED_REF" || true

  # Deployed slugs. Recent CLIs print JSON ({"functions":[{"slug":...}]}) when not attached to a terminal;
  # older ones print a table: <uuid> | NAME | SLUG | STATUS | VERSION | UPDATED_AT. Handle both.
  if grep -q '"slug"' "$LIST" 2>/dev/null; then
    DEPLOYED="$(grep -o '"slug":"[^"]*"' "$LIST" | sed 's/"slug":"//; s/"$//' | sort -u)"
  else
    DEPLOYED="$(awk -F'|' '/\|/ { gsub(/^[ \t]+|[ \t]+$/, "", $1); gsub(/^[ \t]+|[ \t]+$/, "", $3); if ($1 ~ /^[0-9a-f-]{36}$/) print $3 }' "$LIST" 2>/dev/null | sort -u)"
  fi
  EXPECTED="$(grep -v '^[[:space:]]*#' functions.txt | sed 's/[[:space:]]//g' | grep -v '^$' | sort -u)"
  ALL="$(printf '%s\n%s\n' "$DEPLOYED" "$EXPECTED" | grep -v '^$' | sort -u)"
  log "Deployed: $(printf '%s\n' "$DEPLOYED" | grep -c .); referenced by app: $(printf '%s\n' "$EXPECTED" | grep -c .); union: $(printf '%s\n' "$ALL" | grep -c .)"

  comm -23 <(printf '%s\n' "$EXPECTED") <(printf '%s\n' "$DEPLOYED") >"$OUT/functions-referenced-but-not-deployed.txt"
  comm -13 <(printf '%s\n' "$EXPECTED") <(printf '%s\n' "$DEPLOYED") >"$OUT/functions-deployed-but-not-referenced.txt"
  [ -s "$OUT/functions-deployed-but-not-referenced.txt" ] && log "Deployed but never called by the app (webhooks/cron?): $(tr '\n' ' ' <"$OUT/functions-deployed-but-not-referenced.txt")"
  [ -s "$OUT/functions-referenced-but-not-deployed.txt" ] && log "Called by the app but not deployed: $(tr '\n' ' ' <"$OUT/functions-referenced-but-not-deployed.txt")"

  while IFS= read -r slug; do
    [ -z "$slug" ] && continue
    if run_step "Download function $slug" - -- functions download "$slug" --project-ref "$EXPECTED_REF"; then
      [ -d "supabase/functions/$slug" ] && cp -R "supabase/functions/$slug" "$OUT/functions/$slug"
    fi
  done <<<"$ALL"

  # Names and digests only; the CLI never prints secret values.
  run_step "Secrets: names and digests" "$OUT/secrets-names.txt" -- secrets list --project-ref "$EXPECTED_REF" || true
else log "== Edge functions skipped (--skip-functions)"; fi

# ---------------------------------------------------------------- storage
if [ $SKIP_STORAGE -eq 0 ]; then
  BUCKETS="$OUT/storage/buckets.txt"
  run_step "Storage: buckets" "$BUCKETS" -- storage ls ss:/// --experimental --linked || true
  if [ -f "$BUCKETS" ]; then
    # JSON ({"paths":["bucket/",...]}) from recent CLIs, one name per line from older ones.
    if grep -q '"paths"' "$BUCKETS"; then
      sed 's/.*"paths":\[//; s/\].*//' "$BUCKETS" | tr ',' '\n' | tr -d '"' >"$BUCKETS.names"
    else
      cp "$BUCKETS" "$BUCKETS.names"
    fi
    while IFS= read -r raw; do
      b="$(printf '%s' "$raw" | sed -e 's#^ss:///##' -e 's#/*$##' -e 's/^[[:space:]]*//')"
      [ -z "$b" ] && continue
      run_step "Storage: list $b" "$OUT/storage/$b.txt" -- storage ls -r "ss:///$b/" --experimental --linked || true
    done <"$BUCKETS.names"
  fi
else log "== Storage skipped (--skip-storage)"; fi

log "Done. Next: node ./summarize.mjs \"$OUT\"   (writes SUMMARY.md next to the dumps)"
log "Then read README.md section 'What the CLI cannot export' for the dashboard checklist."
