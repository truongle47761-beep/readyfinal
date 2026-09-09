-- Chạy toàn bộ file này trong Supabase > SQL Editor.
create table if not exists public.timepay_records (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.timepay_records enable row level security;

drop policy if exists "timepay_select_own" on public.timepay_records;
create policy "timepay_select_own"
on public.timepay_records for select
using (auth.uid() = user_id);

drop policy if exists "timepay_insert_own" on public.timepay_records;
create policy "timepay_insert_own"
on public.timepay_records for insert
with check (auth.uid() = user_id and auth.uid() = id);

drop policy if exists "timepay_update_own" on public.timepay_records;
create policy "timepay_update_own"
on public.timepay_records for update
using (auth.uid() = user_id and auth.uid() = id)
with check (auth.uid() = user_id and auth.uid() = id);

drop policy if exists "timepay_delete_own" on public.timepay_records;
create policy "timepay_delete_own"
on public.timepay_records for delete
using (auth.uid() = user_id and auth.uid() = id);
