alter table public.profiles
  add column if not exists specific_qr_code text;

update public.profiles
set specific_qr_code = 'PB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where specific_qr_code is null;

alter table public.profiles
  alter column specific_qr_code set default ('PB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));

create unique index if not exists profiles_specific_qr_code_key
  on public.profiles (specific_qr_code);

create or replace function public.resolve_specific_qr(p_qr_code text)
returns table(session_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select ts.id
  from public.profiles p
  join public.transfer_sessions ts on ts.pin = p.permanent_pin
  where p.specific_qr_code = upper(trim(p_qr_code))
    and p.role = 'user'
    and p.disabled = false
    and ts.status = 'active'
    and ts.expires_at > now()
  limit 1;
$$;

revoke execute on function public.resolve_specific_qr(text) from public;
grant execute on function public.resolve_specific_qr(text) to anon, authenticated;
