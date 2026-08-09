create extension if not exists pgcrypto;

create table if not exists public.transfer_sessions (
  id uuid primary key default gen_random_uuid(),
  pin text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','expired','closed'))
);

create table if not exists public.webrtc_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.transfer_sessions(id) on delete cascade,
  sender_id text not null,
  receiver_id text,
  type text not null check (type in ('offer','answer','ice-candidate','peer-ready')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists transfer_sessions_pin_idx on public.transfer_sessions(pin);
create index if not exists transfer_sessions_expires_idx on public.transfer_sessions(expires_at);
create index if not exists webrtc_signals_session_idx on public.webrtc_signals(session_id, created_at);
create index if not exists webrtc_signals_expires_idx on public.webrtc_signals(expires_at);

alter table public.transfer_sessions enable row level security;
alter table public.webrtc_signals enable row level security;

-- The browser needs to discover an active session by PIN.
create policy "anon can read active sessions"
on public.transfer_sessions for select
to anon, authenticated
using (expires_at > now() and status = 'active');

-- Session creation does not expose private file data.
create policy "anon can create sessions"
on public.transfer_sessions for insert
to anon, authenticated
with check (expires_at > now() and status = 'active');


-- WebRTC signaling contains negotiation metadata, never file contents.
create policy "anon can read live signals"
on public.webrtc_signals for select
to anon, authenticated
using (expires_at > now());

create policy "anon can create live signals"
on public.webrtc_signals for insert
to anon, authenticated
with check (expires_at > now());

-- Realtime publication (safe to run repeatedly)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'webrtc_signals'
  ) then
    alter publication supabase_realtime add table public.webrtc_signals;
  end if;
end $$;

-- Cleanup function for stale signaling/session records.
create or replace function public.cleanup_printbhejo_sessions()
returns void
language sql
security definer
as $$
  delete from public.webrtc_signals where expires_at <= now();
  update public.transfer_sessions
    set status = 'expired'
    where expires_at <= now() and status = 'active';
  delete from public.transfer_sessions
    where expires_at <= now() - interval '1 hour';
$$;
