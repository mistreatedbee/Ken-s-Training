-- ============================================================
-- KTI: Make sure application approval doesn't crash
-- Run in: Supabase Dashboard > SQL Editor
--
-- 20240102_whatsapp_members.sql created a trigger that fires when an
-- application's status changes to 'approved'. It inserts a row into a
-- `members` table and reads `applications.church_background`.
--
-- 20260729_remove_church_add_students.sql later renamed `members` to
-- `students`, dropped `church_background`, and redefined the trigger
-- function to match — but both files are "run manually in the SQL
-- Editor" migrations, not applied automatically. If they were run out
-- of order, or only one of them was ever actually run, the live
-- trigger function can still reference a column or table that no
-- longer exists. Since the trigger only runs its INSERT when
-- NEW.status = 'approved', that failure only ever shows up on the
-- approve action — reject is untouched.
--
-- This migration is idempotent: it detects whichever partial state
-- the database is actually in and brings it to the same end state
-- 20260729 intended, then redefines the trigger function to match
-- the current schema. Safe to run regardless of what's already there.
-- ============================================================

-- 1. Finish the members -> students migration if it never happened.
do $$
begin
  if to_regclass('public.members') is not null
     and to_regclass('public.students') is null then

    alter table members rename to students;

    alter table students add column if not exists student_number text;

    update students s
    set student_number = a.student_number
    from applications a
    where s.application_id = a.id
      and a.student_number is not null
      and s.student_number is null;

    update students
    set student_number = 'KTI-LEGACY-' || substr(id::text, 1, 8)
    where student_number is null;

    alter table students alter column student_number set not null;

    if not exists (
      select 1 from pg_constraint where conname = 'students_student_number_key'
    ) then
      alter table students add constraint students_student_number_key unique (student_number);
    end if;

    alter table students drop column if exists member_number;
    alter table students drop column if exists church;

    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'students'
        and policyname = 'Admin full access — members'
    ) then
      alter policy "Admin full access — members" on students
        rename to "Admin full access — students";
    end if;
  end if;
end $$;

drop function if exists generate_kti_member_number() cascade;
drop sequence if exists kti_member_seq;

-- 2. Drop the retired church/ministry column if it's still around.
alter table applications drop column if exists church_background;

-- 3. Redefine the trigger function against the current schema only —
--    `students` table, no `church_background`. This is a straight
--    CREATE OR REPLACE, so it's safe even if 20260729 already applied
--    this exact definition.
create or replace function handle_kti_application_approved()
returns trigger language plpgsql security definer as $$
declare
  v_pi   jsonb;
  v_cd   jsonb;
  v_name text;
  v_phone text;
  v_email text;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    v_pi    := new.personal_info;
    v_cd    := new.contact_details;
    v_name  := trim(coalesce(v_pi->>'first_name','') || ' ' || coalesce(v_pi->>'last_name',''));
    v_phone := coalesce(v_cd->>'whatsapp', v_cd->>'phone', '');
    v_email := v_pi->>'email';

    insert into students (
      application_id, student_number, full_name, phone, email, programme, joined_date
    ) values (
      new.id,
      new.student_number,
      v_name,
      v_phone,
      v_email,
      new.programme,
      current_date
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- 4. Make sure the trigger itself exists and points at this function.
drop trigger if exists trg_kti_application_approved on applications;
create trigger trg_kti_application_approved
  after update of status on applications
  for each row execute function handle_kti_application_approved();
