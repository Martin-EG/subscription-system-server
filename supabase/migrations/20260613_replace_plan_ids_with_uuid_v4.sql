begin;

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

update public.subscriptions
set plan_id = case plan_id
  when '00000000-0000-0000-0000-000000000001'::uuid
    then 'f787d141-3c8e-420f-b367-a9edcc84a6df'::uuid
  when '00000000-0000-0000-0000-000000000002'::uuid
    then '99902751-fb7d-4d2f-9716-6eca142b060e'::uuid
  when '00000000-0000-0000-0000-000000000003'::uuid
    then '768a6a3b-60f1-4d23-9d23-f9affc529aa8'::uuid
  else plan_id
end
where plan_id in (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid
);

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

delete from public.plans
where id in (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid
);

commit;
