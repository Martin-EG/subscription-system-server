alter type public."PaymentNotificationStatus"
  add value if not exists 'PROCESSING' after 'PENDING';

alter table public.payment_notifications
  add column if not exists event_type text,
  add column if not exists payload jsonb,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_until timestamptz null;

with notification_payloads as (
  select
    notifications.id,
    jsonb_build_object(
      'userId', payments.user_id,
      'subscriptionId', notifications.subscription_id,
      'transactionId', payments.transaction_id,
      'amount', payments.amount,
      'currency', payments.currency,
      'occurredAt', payments.payment_date
    ) as payload
  from public.payment_notifications as notifications
  left join lateral (
    select
      payment_logs.user_id,
      payment_logs.transaction_id,
      payment_logs.amount,
      payment_logs.currency,
      payment_logs.payment_date
    from public.payment_logs
    where payment_logs.subscription_id = notifications.subscription_id
      and payment_logs.payment_date <= notifications.created_at
    order by payment_logs.payment_date desc
    limit 1
  ) as payments on true
  where notifications.event_type is null
    or notifications.payload is null
)
update public.payment_notifications as notifications
set
  event_type = coalesce(notifications.event_type, 'PAYMENT_SUCCEEDED'),
  payload = coalesce(notification_payloads.payload, '{}'::jsonb)
from notification_payloads
where notifications.id = notification_payloads.id;

alter table public.payment_notifications
  alter column event_type set not null,
  alter column payload set not null;

drop index if exists public.payment_notifications_status_created_at_idx;

create index if not exists payment_notifications_status_next_attempt_at_idx
  on public.payment_notifications (status, next_attempt_at);
