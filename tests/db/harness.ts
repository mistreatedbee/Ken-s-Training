import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations')

/**
 * Minimal stand-in for the parts of Supabase that the migrations rely
 * on: the anon/authenticated/service_role roles, auth.users + auth.uid(),
 * the storage schema, and Supabase's default grants (every new table in
 * `public` is granted to anon/authenticated, so RLS is what protects it).
 */
const SUPABASE_SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`

/**
 * Tables that exist in the production KTI database but in no migration
 * here (apparently from another project). The migration must leave them
 * alone — in particular it must not collide with `public.courses`.
 */
const PRODUCTION_EXTRAS = `
create type course_status as enum ('active', 'inactive');
create table courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration text,
  fees numeric not null,
  registration_fee numeric not null,
  capacity integer not null,
  start_date date,
  status course_status not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table student_profiles (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id)
);
insert into courses (name, fees, registration_fee, capacity) values ('Legacy course', 1500, 200, 30);
-- Production also has its own is_staff(); the migration must not replace it.
create function is_staff() returns boolean language sql stable as $$ select 'legacy'::text = 'legacy' $$;
`

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
}

export function readMigration(file: string) {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
}

/** A fresh database with the shim and the migrations applied (optionally stopping before one). */
export async function createDb(opts: { stopBefore?: string } = {}) {
  const db = new PGlite()
  await db.exec(SUPABASE_SHIM)
  await db.exec(PRODUCTION_EXTRAS)
  for (const file of migrationFiles()) {
    if (opts.stopBefore && file >= opts.stopBefore) break
    await db.exec(readMigration(file))
  }
  return db
}

export const NEW_MIGRATION = '20261013_admin_management_system.sql'

export type Db = PGlite

let userSeq = 0

/** Create an auth user, optionally with a staff role. Returns the user id. */
export async function createUser(db: Db, role?: string, email?: string) {
  userSeq += 1
  const id = `00000000-0000-0000-0000-${String(userSeq).padStart(12, '0')}`
  const mail = email ?? `user${userSeq}@example.com`
  await asSuperuser(db)
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, mail])
  if (role) {
    await db.query(
      'insert into staff_users (user_id, email, role) values ($1, $2, $3)',
      [id, mail, role],
    )
  }
  return id
}

export async function asSuperuser(db: Db) {
  await db.exec(`reset role; set request.jwt.claim.sub = '';`)
}

export async function asAnon(db: Db) {
  await db.exec(`reset role; set request.jwt.claim.sub = ''; set role anon;`)
}

export async function asService(db: Db) {
  await db.exec(`reset role; set request.jwt.claim.sub = ''; set role service_role;`)
}

export async function asUser(db: Db, userId: string) {
  await db.exec(`reset role; set request.jwt.claim.sub = '${userId}'; set role authenticated;`)
}

/** Run `fn` and return the Postgres error message it raised (or null). */
export async function errorOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
