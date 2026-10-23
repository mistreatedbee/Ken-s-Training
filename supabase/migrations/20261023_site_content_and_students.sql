-- ============================================================
-- KTI: Editable website content + student management
-- Run in: Supabase Dashboard > SQL Editor (after taking a backup)
-- Requires 20261013_admin_management_system.sql. Safe to run twice.
-- Additive: no existing data is changed.
--
--  * kti_site_content — one row holding the public website text
--    (announcement, homepage, requirements, contact details). Edited
--    by super admins in Admin > Website content; read by everyone.
--  * students — notes and ID number columns, a 'completed' status,
--    and admissions staff can add students by hand (e.g. people who
--    enrolled before the online form) and remove ones added in error.
-- ============================================================

begin;

do $$
begin
  if to_regprocedure('public.kti_has_role(text[])') is null then
    raise exception 'Run 20261013_admin_management_system.sql before this migration';
  end if;
end $$;

-- ── Website content ──────────────────────────────────────────

create table if not exists kti_site_content (
  id         text primary key default 'site' check (id = 'site'),
  content    jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into kti_site_content (id) values ('site') on conflict do nothing;

alter table kti_site_content enable row level security;
revoke insert, update, delete, truncate on kti_site_content from anon;

drop policy if exists "Anyone reads site content" on kti_site_content;
create policy "Anyone reads site content" on kti_site_content
  for select to anon, authenticated using (true);

drop policy if exists "Super admin edits site content" on kti_site_content;
create policy "Super admin edits site content" on kti_site_content
  for update to authenticated
  using (kti_has_role('super_admin')) with check (kti_has_role('super_admin'));

drop trigger if exists trg_kti_site_content_updated_at on kti_site_content;
create trigger trg_kti_site_content_updated_at
  before update on kti_site_content
  for each row execute function set_updated_at();

drop trigger if exists trg_audit_kti_site_content on kti_site_content;
create trigger trg_audit_kti_site_content
  after update on kti_site_content
  for each row execute function log_audit();

-- ── Students ─────────────────────────────────────────────────

alter table students add column if not exists notes text;
alter table students add column if not exists id_number text;

alter table students drop constraint if exists students_notes_check;
alter table students add constraint students_notes_check check (notes is null or length(notes) <= 5000);

-- The original check came from the old `members` table.
alter table students drop constraint if exists members_status_check;
alter table students drop constraint if exists students_status_check;
alter table students add constraint students_status_check
  check (status in ('active', 'inactive', 'suspended', 'completed'));

-- Student numbers for students added by hand share the application
-- counter, so numbers never clash.
create or replace function kti_next_student_number()
returns text language plpgsql security definer set search_path = public as $$
declare
  year_val int := extract(year from now())::int;
  counter_val int;
begin
  if not kti_has_role('admissions') then
    raise exception 'FORBIDDEN: only admissions staff can add students';
  end if;
  insert into student_number_counters (year, counter) values (year_val, 1)
  on conflict (year) do update set counter = student_number_counters.counter + 1
  returning counter into counter_val;
  return 'KTI-' || year_val::text || '-' || lpad(counter_val::text, 4, '0');
end;
$$;

revoke execute on function kti_next_student_number() from public, anon;
grant execute on function kti_next_student_number() to authenticated;

drop policy if exists "Admissions add students" on students;
create policy "Admissions add students" on students
  for insert to authenticated with check (kti_has_role('admissions'));

-- Only students added by hand (no application) can be removed; others
-- are kept for the record and can be set inactive instead.
drop policy if exists "Admissions remove manually added students" on students;
create policy "Admissions remove manually added students" on students
  for delete to authenticated using (kti_has_role('admissions') and application_id is null);

drop trigger if exists trg_audit_students on students;
create trigger trg_audit_students
  after insert or update or delete on students
  for each row execute function log_audit();

commit;
