-- ============================================================
-- KTI: Fix "new row violates row-level security policy" on submit
-- Run in: Supabase Dashboard > SQL Editor
--
-- The apply form does `.insert([payload]).select('student_number')`,
-- which requires reading the new row back (RETURNING). The only
-- SELECT policy on `applications` requires auth.uid() IS NOT NULL,
-- so an anonymous applicant can insert but can't read their own row
-- back, and PostgREST reports that as an RLS violation on insert.
--
-- Fix: allow anon to read back just `id` and `student_number` via a
-- column-level grant (never the PII columns like personal_info or
-- contact_details), under a permissive row policy scoped to anon.
-- ============================================================

revoke select on applications from anon;
grant select (id, student_number) on applications to anon;

drop policy if exists "Public can read back their new submission" on applications;
create policy "Public can read back their new submission" on applications
  for select to anon
  using (true);
