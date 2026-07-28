begin;

-- Track each provider hand-off independently. This lets a retried fan-out skip
-- recipients whose email was already accepted by the provider.
create table if not exists public.notification_deliveries (
  idempotency_key text primary key,
  status text not null default 'processing'
    check (status in ('processing', 'delivered', 'failed')),
  provider_message_id text,
  last_error text,
  attempt_count integer not null default 1 check (attempt_count >= 1),
  started_at timestamptz not null default timezone('utc', now()),
  delivered_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
grant select, insert, update, delete on public.notification_deliveries to service_role;

-- A worker crash must not leave an event permanently invisible, and repeated
-- permanent failures need a terminal state instead of retrying forever.
alter table public.notification_outbox
  add column if not exists claimed_at timestamptz;

alter table public.notification_outbox
  drop constraint if exists notification_outbox_status_check;

alter table public.notification_outbox
  add constraint notification_outbox_status_check
  check (status in ('pending', 'processing', 'delivered', 'failed', 'dead_letter'));

create index if not exists notification_outbox_processing_claim_idx
  on public.notification_outbox (status, claimed_at)
  where status = 'processing';

-- Course messages are persisted before delivery and completed by the outbox.
alter table public.course_messages
  drop constraint if exists course_messages_status_check;

alter table public.course_messages
  add constraint course_messages_status_check
  check (status in ('draft', 'queued', 'sending', 'sent', 'partially_sent', 'failed'));

commit;
