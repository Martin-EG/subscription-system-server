create index if not exists subscriptions_status_expires_at_idx
  on public.subscriptions (status, expires_at);
