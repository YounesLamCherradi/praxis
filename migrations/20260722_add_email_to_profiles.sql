-- Add email to profiles table for easier user management in Supabase Table Editor.
-- This denormalizes auth.users.email into profiles so you can see everything in one view.

alter table public.profiles
  add column if not exists email text unique;

-- Sync existing emails from auth.users (one-time backfill)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Make email NOT NULL after backfill is complete
alter table public.profiles
  alter column email set not null;

-- Index email for fast lookups
create index if not exists profiles_email_idx on public.profiles(lower(email));
