# Backend Supabase setup

This repo's backend expects an existing Supabase schema. Your new Supabase project is empty, so login and signup will fail until the base tables exist.

## First backend milestone

For login and signup to work reliably, set up these pieces first:

1. Supabase auth is enabled with email/password.
2. The core `public.profiles` table exists.
3. The teacher and student dashboard tables exist: `classes`, `class_members`, `assignments`, `submissions`.
4. Row-level security policies allow authenticated users to read and write their own data.

## Apply the bootstrap SQL

In the Supabase dashboard:

1. Open SQL Editor.
2. Run [/home/jonas/Documents/Downloads/Praxis/migrations/bootstrap-auth-schema.sql](/home/jonas/Documents/Downloads/Praxis/migrations/bootstrap-auth-schema.sql).
3. After that, run the remaining migrations in date order from [/home/jonas/Documents/Downloads/Praxis/migrations](/home/jonas/Documents/Downloads/Praxis/migrations).

The bootstrap file creates only the missing base schema that this repo no longer stores as an initial migration.

## Verify backend status

Start the backend and open:

1. `/api/health`
2. `/api/setup/status`

`/api/setup/status` returns which core tables are still missing.

## Required env vars

Your server needs these values in `.env`:

1. `SUPABASE_URL`
2. `SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`

This repo already accepts `SUPABASE_SERVICE_KEY` as a fallback, so your current `.env` naming is compatible.

## Important limitation

The bootstrap gets auth and the basic app shell unstuck. It does not replace the rest of the dated migrations. Features like analytics, research exports, assignment types, and later RLS fixes still depend on the existing migration files.