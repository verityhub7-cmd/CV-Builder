create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  account_status text not null default 'active' check (account_status in ('active','blocked')),
  is_pro boolean not null default false,
  plan_name text not null default 'free',
  pro_purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  plan_name text not null default 'professional_builder',
  amount numeric(10,2) not null default 1.00,
  currency text not null default 'USD',
  payment_method text not null,
  transaction_id text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_name text not null default 'ats',
  resume_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.resumes enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_resumes_updated_at on public.resumes;
create trigger set_resumes_updated_at
before update on public.resumes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, account_status, is_pro, plan_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'active',
    false,
    'free'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, account_status, is_pro, plan_name)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''),
  'active',
  false,
  'free'
from auth.users
on conflict (id) do nothing;

create or replace function public.grant_pro_after_payment_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.profiles
    set is_pro = true,
        plan_name = 'professional_builder',
        pro_purchased_at = coalesce(new.approved_at, now()),
        updated_at = now()
    where id = new.user_id;

    new.approved_at = coalesce(new.approved_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists grant_pro_after_payment_approval on public.payments;
create trigger grant_pro_after_payment_approval
before update on public.payments
for each row execute function public.grant_pro_after_payment_approval();

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own free profile" on public.profiles;
create policy "Users can insert own free profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and is_pro = false and account_status = 'active');

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
on public.payments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can submit own pending payments" on public.payments;
create policy "Users can submit own pending payments"
on public.payments
for insert
to authenticated
with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Users can view own resumes" on public.resumes;
create policy "Users can view own resumes"
on public.resumes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own resumes" on public.resumes;
create policy "Users can insert own resumes"
on public.resumes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own resumes" on public.resumes;
create policy "Users can update own resumes"
on public.resumes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own resumes" on public.resumes;
create policy "Users can delete own resumes"
on public.resumes
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists resumes_user_id_idx on public.resumes(user_id);
