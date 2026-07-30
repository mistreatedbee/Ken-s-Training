-- ============================================================
-- KTI: Remove Church & Ministry data; Members -> Students
-- Run in: Supabase Dashboard > SQL Editor
--
-- KTI is a training institute admissions system, not a church
-- membership platform. The `church_background` column and the
-- `members` table (with its own KTI-MBR-YYYY-NNNN numbering and
-- a `church` column) were copy-pasted from a separate CLM
-- (Christian Leadership Movement) membership project and were
-- never cleaned up. KTI already generates a correct student
-- number (KTI-YYYY-NNNN) on `applications` — this migration
-- retires the duplicate member numbering in favour of that.
-- ============================================================

-- 1. Drop the church/ministry data captured on applications.
alter table applications drop column if exists church_background;

-- 2. Rename members -> students.
alter table members rename to students;

-- 3. Backfill student_number from the linked application's real
--    student number before renaming the column, since the old
--    member_number values used a different, KTI-MBR-based format.
alter table students add column if not exists student_number text;

update students s
set student_number = a.student_number
from applications a
where s.application_id = a.id
  and a.student_number is not null;

-- Any students without a resolvable application keep a numbered
-- placeholder so the column can be made unique/not-null.
update students
set student_number = 'KTI-LEGACY-' || substr(id::text, 1, 8)
where student_number is null;

alter table students alter column student_number set not null;
alter table students add constraint students_student_number_key unique (student_number);

-- 4. Drop the old member_number column, its generator, and church column.
alter table students drop column if exists member_number;
drop function if exists generate_kti_member_number() cascade;
drop sequence if exists kti_member_seq;

alter table students drop column if exists church;

-- 5. Recreate the approval trigger to use the application's real
--    student_number and stop referencing church_background.
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

-- 6. Rename the RLS policy for clarity (table already carries the
--    original policy through the rename in step 2).
alter policy "Admin full access — members" on students
  rename to "Admin full access — students";
