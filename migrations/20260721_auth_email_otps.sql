-- Email OTP support for sign-up and password reset.

create table if not exists public.auth_email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('signup', 'password_reset')),
  code_hash text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_email_otps_email_purpose_created_idx
  on public.auth_email_otps(email, purpose, created_at desc);

create index if not exists auth_email_otps_unconsumed_idx
  on public.auth_email_otps(email, purpose)
  where consumed_at is null;

alter table public.auth_email_otps enable row level security;

grant select, insert, update, delete on table public.auth_email_otps to service_role;
revoke all on table public.auth_email_otps from authenticated;
revoke all on table public.auth_email_otps from anon;
