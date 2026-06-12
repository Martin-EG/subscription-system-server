begin;

create extension if not exists pgcrypto;

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

alter table public.subscriptions
  add column if not exists started_at timestamptz,
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists created_at timestamptz,
  add column if not exists stripe_subscription_id text null;

update public.subscriptions
set
  started_at = coalesce(started_at, updated_at, now()),
  created_at = coalesce(created_at, updated_at, now())
where started_at is null
   or created_at is null;

alter table public.subscriptions
  alter column started_at set default now(),
  alter column started_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column expires_at drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'external_subscription_id'
  ) then
    execute $sql$
      update public.subscriptions
      set stripe_subscription_id = coalesce(
        stripe_subscription_id,
        external_subscription_id
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'idempotency_id'
  ) then
    execute $sql$
      insert into public.idempotency_keys (
        key,
        user_id,
        operation,
        request_hash,
        status,
        response_status,
        resource_id,
        created_at,
        expires_at
      )
      select
        subscriptions.idempotency_id,
        subscriptions.user_id,
        'CHECKOUT'::public."IdempotencyOperation",
        encode(digest(subscriptions.idempotency_id, 'sha256'), 'hex'),
        'COMPLETED'::public."IdempotencyStatus",
        201,
        subscriptions.id,
        coalesce(subscriptions.created_at, subscriptions.updated_at, now()),
        now() + interval '24 hours'
      from public.subscriptions
      where subscriptions.idempotency_id is not null
      on conflict (user_id, operation, key) do nothing
    $sql$;
  end if;
end
$$;

alter table public.subscriptions
  drop column if exists external_subscription_id,
  drop column if exists idempotency_id;

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);

create unique index if not exists subscriptions_one_current_per_user_idx
  on public.subscriptions (user_id)
  where status in ('ACTIVE', 'PAST_DUE');

insert into public.plans (id, name, price, currency, billing_period)
values (
  '00000000-0000-0000-0000-000000000001',
  'Gratis',
  0,
  'MXN',
  null
)
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  currency = excluded.currency,
  billing_period = excluded.billing_period;

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
    '00000000-0000-0000-0000-000000000001',
    'ACTIVE'::public."SubscriptionStatus",
    now(),
    null,
    false,
    now(),
    now()
  where not exists (
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
  '00000000-0000-0000-0000-000000000001',
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

alter table public.idempotency_keys enable row level security;

commit;
