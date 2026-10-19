-- MEMORY THAT LEARNS (2026-10-19) — ported from MyAssistant (memory/learning.js, 2026-10-18).
--
-- Every remembered fact now carries a strength (1 as stored, 0.1 … 3):
--   used in an answer ....... +0.05 (at most five facts a conversation)
--   said again .............. +0.3
--   contradicted ............ x0.4 (a learned habit is let go at once)
--   unused for 30 days ...... x0.98 a day; facts about the user and the people in their life never fade
-- Below 0.35 a fact leaves the assistant's prompt but stays listed and recallable.
--
-- Once a day per user (memory-learn, action "daily"): decay, consolidation (duplicates and contradictions merged,
-- newest wins) and habits learnt from a week of conversations, kept only after they show on three different days.
--
-- Written by memory-ingest and memory-learn with the service role; the user can read their own rows.

alter table public.assistant_memories add column if not exists strength real not null default 1;
alter table public.assistant_memories add column if not exists uses integer not null default 0;
alter table public.assistant_memories add column if not exists last_used_at timestamptz;
alter table public.assistant_memories add column if not exists evidence integer not null default 1;

-- source gains 'learned' (a habit noticed, not told). Only matters if the column has a check constraint.
alter table public.assistant_memories drop constraint if exists assistant_memories_source_check;
alter table public.assistant_memories
  add constraint assistant_memories_source_check check (source in ('user', 'chat', 'call', 'learned'));

-- Patterns seen in what the user does, waiting for enough days to be kept.
create table if not exists public.memory_candidates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  fact       text not null,
  kind       text not null default 'preferences',
  days       jsonb not null default '[]'::jsonb,   -- YYYY-MM-DD (India) it showed on
  status     text not null default 'pending' check (status in ('pending', 'promoted', 'rejected')),
  memory_id  uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.memory_candidates enable row level security;
drop policy if exists "memory_candidates_owner_read" on public.memory_candidates;
create policy "memory_candidates_owner_read" on public.memory_candidates for select using (auth.uid() = user_id);
drop policy if exists "memory_candidates_owner_delete" on public.memory_candidates;
create policy "memory_candidates_owner_delete" on public.memory_candidates for delete using (auth.uid() = user_id);

-- Once-a-day upkeep per user.
create table if not exists public.memory_upkeep (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  day             text not null default '',
  decayed_at      timestamptz,
  consolidated_at timestamptz
);
alter table public.memory_upkeep enable row level security;

-- ── Service-role helpers (PostgREST cannot express "strength = strength + x") ─────────────────────────────────────────

-- Used in an answer (p_used = true) or said again (p_used = false, p_evidence = true).
create or replace function public.memory_reinforce(p_user uuid, p_ids uuid[], p_amount real, p_used boolean, p_evidence boolean)
returns void language sql security definer set search_path = public as $$
  update assistant_memories
     set strength = least(3, strength + p_amount),
         uses = uses + case when p_used then 1 else 0 end,
         evidence = evidence + case when p_evidence then 1 else 0 end,
         last_used_at = now()
   where user_id = p_user and id = any(p_ids) and status = 'active';
$$;

-- Contradicted by the user.
create or replace function public.memory_weaken(p_user uuid, p_ids uuid[], p_factor real)
returns void language sql security definer set search_path = public as $$
  update assistant_memories
     set strength = greatest(0.1, strength * p_factor), updated_at = now()
   where user_id = p_user and id = any(p_ids) and status = 'active';
$$;

-- Unused for 30 days: x0.98 a day. Facts about the user and their people never fade.
create or replace function public.memory_decay(p_user uuid, p_days integer)
returns void language sql security definer set search_path = public as $$
  update assistant_memories
     set strength = greatest(0.1, strength * power(0.98, greatest(1, least(30, p_days))))
   where user_id = p_user and status = 'active'
     and category not in ('about_me', 'people')
     and coalesce(last_used_at, created_at) < now() - interval '30 days';
$$;

revoke all on function public.memory_reinforce(uuid, uuid[], real, boolean, boolean) from public, anon, authenticated;
revoke all on function public.memory_weaken(uuid, uuid[], real) from public, anon, authenticated;
revoke all on function public.memory_decay(uuid, integer) from public, anon, authenticated;
grant execute on function public.memory_reinforce(uuid, uuid[], real, boolean, boolean) to service_role;
grant execute on function public.memory_weaken(uuid, uuid[], real) to service_role;
grant execute on function public.memory_decay(uuid, integer) to service_role;
