begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public."SubscriptionStatus" as enum (
    'ACTIVE',
    'PAST_DUE',
    'CANCELLED',
    'EXPIRED'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public."PaymentNotificationStatus" as enum (
    'PENDING',
    'PROCESSING',
    'SENT',
    'FAILED'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public."UserRole" as enum ('USER', 'ADMIN');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public."BillingPeriod" as enum ('MONTHLY', 'YEARLY');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public."IdempotencyOperation" as enum (
    'CHECKOUT',
    'RENEW',
    'CANCEL'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public."IdempotencyStatus" as enum (
    'PROCESSING',
    'COMPLETED',
    'FAILED'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role public."UserRole" not null default 'USER',
  created_at timestamptz not null default now()
);

alter table public.users
  add column if not exists role public."UserRole" not null default 'USER';

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12, 2) not null check (price >= 0),
  currency varchar(3) not null,
  billing_period public."BillingPeriod" null
);

do $$
declare
  billing_period_type text;
begin
  select columns.udt_name
  into billing_period_type
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'plans'
    and columns.column_name = 'billing_period';

  if billing_period_type <> 'BillingPeriod' then
    alter table public.plans
      alter column billing_period drop not null,
      alter column billing_period type public."BillingPeriod"
      using (
        case upper(billing_period::text)
          when 'MENSUAL' then 'MONTHLY'::public."BillingPeriod"
          when 'MONTHLY' then 'MONTHLY'::public."BillingPeriod"
          when 'ANUAL' then 'YEARLY'::public."BillingPeriod"
          when 'YEARLY' then 'YEARLY'::public."BillingPeriod"
          else null
        end
      );
  else
    alter table public.plans
      alter column billing_period drop not null;
  end if;
end
$$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public."SubscriptionStatus" not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz null,
  cancelled_at timestamptz null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stripe_subscription_id text null
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

create unique index if not exists subscriptions_one_current_per_user_idx
  on public.subscriptions (user_id)
  where status in ('ACTIVE', 'PAST_DUE');

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  user_id uuid not null references public.users (id) on delete cascade,
  operation public."IdempotencyOperation" not null,
  request_hash text not null,
  status public."IdempotencyStatus" not null default 'PROCESSING',
  response_status integer null,
  response_body jsonb null,
  resource_id uuid null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint idempotency_keys_user_operation_key_unique
    unique (user_id, operation, key)
);

create index if not exists idempotency_keys_status_expires_at_idx
  on public.idempotency_keys (status, expires_at);

create index if not exists idempotency_keys_resource_id_idx
  on public.idempotency_keys (resource_id);

create table if not exists public.user_access (
  user_id uuid primary key references public.users (id) on delete cascade,
  has_premium_access boolean not null default false,
  valid_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  currency varchar(3) not null,
  status text not null,
  payment_date timestamptz not null,
  transaction_id text not null unique
);

create index if not exists payment_logs_user_id_idx
  on public.payment_logs (user_id);

create index if not exists payment_logs_subscription_id_idx
  on public.payment_logs (subscription_id);

create table if not exists public.payment_notifications (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status public."PaymentNotificationStatus" not null default 'PENDING',
  retry_count integer not null default 0 check (retry_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz null,
  last_attempt_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists payment_notifications_status_next_attempt_at_idx
  on public.payment_notifications (status, next_attempt_at);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case upper(coalesce(new.raw_app_meta_data ->> 'app_role', 'USER'))
      when 'ADMIN' then 'ADMIN'::public."UserRole"
      else 'USER'::public."UserRole"
    end
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role;

  insert into public.subscriptions (
    user_id,
    plan_id,
    status,
    started_at,
    expires_at,
    cancel_at_period_end,
    created_at,
    updated_at
  )
  select
    new.id,
    'f787d141-3c8e-420f-b367-a9edcc84a6df',
    'ACTIVE'::public."SubscriptionStatus",
    now(),
    null,
    false,
    now(),
    now()
  where exists (
    select 1
    from public.plans
    where plans.id = 'f787d141-3c8e-420f-b367-a9edcc84a6df'
  )
  and not exists (
    select 1
    from public.subscriptions
    where subscriptions.user_id = new.id
      and subscriptions.status in ('ACTIVE', 'PAST_DUE')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data, raw_app_meta_data
  on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.plans (id, name, price, currency, billing_period)
values
  ('f787d141-3c8e-420f-b367-a9edcc84a6df', 'Gratis', 0, 'MXN', null),
  (
    '99902751-fb7d-4d2f-9716-6eca142b060e',
    'Premium mensual',
    99,
    'MXN',
    'MONTHLY'
  ),
  (
    '768a6a3b-60f1-4d23-9d23-f9affc529aa8',
    'Premium anual',
    999,
    'MXN',
    'YEARLY'
  )
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  currency = excluded.currency,
  billing_period = excluded.billing_period;

insert into public.subscriptions (
  user_id,
  plan_id,
  status,
  started_at,
  expires_at,
  cancel_at_period_end,
  created_at,
  updated_at
)
select
  users.id,
  'f787d141-3c8e-420f-b367-a9edcc84a6df',
  'ACTIVE'::public."SubscriptionStatus",
  now(),
  null,
  false,
  now(),
  now()
from public.users
where not exists (
  select 1
  from public.subscriptions
  where subscriptions.user_id = users.id
    and subscriptions.status in ('ACTIVE', 'PAST_DUE')
);

alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.user_access enable row level security;
alter table public.payment_logs enable row level security;
alter table public.payment_notifications enable row level security;

drop policy if exists "plans_are_publicly_readable" on public.plans;
create policy "plans_are_publicly_readable"
  on public.plans for select
  to anon, authenticated
  using (true);

drop policy if exists "users_read_own_or_admin" on public.users;
create policy "users_read_own_or_admin"
  on public.users for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'ADMIN'
  );

drop policy if exists "subscriptions_read_own_or_admin" on public.subscriptions;
create policy "subscriptions_read_own_or_admin"
  on public.subscriptions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'ADMIN'
  );

drop policy if exists "user_access_read_own_or_admin" on public.user_access;
create policy "user_access_read_own_or_admin"
  on public.user_access for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'ADMIN'
  );

drop policy if exists "payment_logs_read_own_or_admin" on public.payment_logs;
create policy "payment_logs_read_own_or_admin"
  on public.payment_logs for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'ADMIN'
  );

drop policy if exists "payment_notifications_read_own_or_admin"
  on public.payment_notifications;
create policy "payment_notifications_read_own_or_admin"
  on public.payment_notifications for select
  to authenticated
  using (
    exists (
      select 1
      from public.subscriptions
      where subscriptions.id = payment_notifications.subscription_id
        and (
          subscriptions.user_id = (select auth.uid())
          or (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'ADMIN'
        )
    )
  );

grant select on public.plans to anon, authenticated;
grant select on public.users to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.user_access to authenticated;
grant select on public.payment_logs to authenticated;
grant select on public.payment_notifications to authenticated;

commit;
