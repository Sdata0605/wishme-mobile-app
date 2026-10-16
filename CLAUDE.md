# WishMe — notes for Claude

The owner works on this repo from two Windows PCs and more than one Claude account. Nothing from an earlier
conversation carries over, so this file and `HANDOFF.md` are the memory.

**Start every session by reading `HANDOFF.md`** (current state, open work, how to build). Before you stop, update
its "Current state" and "Next steps" sections, and commit it with the work, so the other PC can pick up from there.

For what the app is and how the code is laid out, see `PROJECT_REPORT.md`.

## Working rules

- **This repo is not the owner's.** It belongs to `Sdata0605`, and another developer (Prashnat) works on `master`.
  The owner's own work lives on **`dhanush/mobile-app`** (or branches cut from it). Never push to `master`, to
  anyone else's branch, or to a branch that has already been merged. Never force-push someone else's work.
  Open a pull request only when the owner asks for one.
- Commit or push only when the owner asks.
- End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>` (or the model line your harness gives).
  PR descriptions end with "🤖 Generated with [Claude Code](https://claude.com/claude-code)".
- **The GitHub repo is public.** Never commit secrets, `.env` files, Supabase service-role keys, or the Supabase
  audit output (`scripts/supabase-audit/out/` is git-ignored on purpose: it describes open security holes in
  production). Do not paste audit findings into commits, PRs or issues.
- Line endings: most files are CRLF (`core.autocrlf=true`). Keep a file's existing endings; `sed -i` in Git Bash
  turns CRLF files into LF, so edit with the editor tools or a Node one-liner instead.
- Typecheck before handing work back: in `artifacts/mobile`, `tsc -p tsconfig.json --noEmit`.
- Never type the owner's phone PIN or passwords. Ask them to unlock the phone or sign in themselves.
- Ask before downloading tools; say what, from where, and how big.
