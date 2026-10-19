-- THE DAY'S QUOTE AND ITS PICTURES (2026-10-19) — ported from MyAssistant (quotecards/service.js, 2026-10-18).
--
-- Once per India day the quote-cards function writes a NEW motivational line (never one already used) and makes one
-- text-free picture per style. Every user gets the same line and the same files; nobody's tap costs a generation. The
-- words are set on the phone over the picture (image models misspell words). Only quote-cards (service role) reads or
-- writes these tables; the pictures are public in the quote-cards bucket (dated, style-named, nothing personal).

create table if not exists public.daily_quotes (
  day        text primary key,                 -- YYYY-MM-DD, India
  text       text not null,
  deity      text not null,
  created_at timestamptz not null default now()
);
alter table public.daily_quotes enable row level security;

create table if not exists public.daily_quote_images (
  day        text not null references public.daily_quotes (day) on delete cascade,
  style      text not null,
  status     text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  path       text,
  provider   text,
  updated_at timestamptz not null default now(),
  primary key (day, style)
);
alter table public.daily_quote_images enable row level security;

insert into storage.buckets (id, name, public)
values ('quote-cards', 'quote-cards', true)
on conflict (id) do update set public = true;
