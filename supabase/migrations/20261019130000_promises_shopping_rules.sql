-- PROMISES, THE SHOPPING LIST AND STANDING RULES (2026-10-19) — ported from MyAssistant (commitments, shopping,
-- standing instructions). Each row belongs to one user, who alone can read and change it.

-- What the user said THEY would do ("I'll send Ravi the proposal by Friday"), tracked until done. Written by the assistant
-- (note_promise) and by memory-ingest when a conversation ends.
create table if not exists public.assistant_promises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null check (char_length(text) between 2 and 300),
  owed_to    text not null default '',
  due_at     timestamptz,
  status     text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  source     text not null default 'voice' check (source in ('voice', 'chat', 'call', 'app')),
  -- The sentence it came from, so the user can see why it is on the list.
  quote      text not null default '',
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assistant_promises_user on public.assistant_promises (user_id, status, due_at);
alter table public.assistant_promises enable row level security;
drop policy if exists "assistant_promises_owner" on public.assistant_promises;
create policy "assistant_promises_owner" on public.assistant_promises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One list for anything to buy.
create table if not exists public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  quantity   text not null default '',
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shopping_items_user on public.shopping_items (user_id, done, created_at);
alter table public.shopping_items enable row level security;
drop policy if exists "shopping_items_owner" on public.shopping_items;
create policy "shopping_items_owner" on public.shopping_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lasting rules for how the assistant behaves ("always ask before sending messages", "never call anyone after 10 pm"),
-- given to it at the start of every conversation.
create table if not exists public.assistant_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text       text not null check (char_length(text) between 3 and 300),
  created_at timestamptz not null default now()
);
create index if not exists assistant_rules_user on public.assistant_rules (user_id, created_at);
alter table public.assistant_rules enable row level security;
drop policy if exists "assistant_rules_owner" on public.assistant_rules;
create policy "assistant_rules_owner" on public.assistant_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
