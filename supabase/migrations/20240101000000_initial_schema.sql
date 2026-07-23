-- ============================================================
-- KTI Admission System — Simplified Schema (idempotent)
-- No applicant accounts. Applicants submit publicly.
-- Admins are Supabase Auth users (any authenticated user = admin).
-- ============================================================

-- Drop old auth trigger (from previous schema that created profiles on signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop everything in reverse FK order
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS reviewer_assignments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS application_documents CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS student_number_counters CASCADE;
DROP TABLE IF EXISTS programmes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Student number counter (atomic, no race conditions)
CREATE TABLE student_number_counters (
  year INT PRIMARY KEY,
  counter INT DEFAULT 0
);

-- Applications (no user association — public submissions)
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number TEXT UNIQUE,
  programme TEXT,
  personal_info JSONB DEFAULT '{}',
  contact_details JSONB DEFAULT '{}',
  next_of_kin JSONB DEFAULT '{}',
  education JSONB DEFAULT '{}',
  church_background JSONB DEFAULT '{}',
  personal_statement JSONB DEFAULT '{}',
  documents JSONB DEFAULT '[]',
  declaration BOOLEAN DEFAULT FALSE,
  signature_data TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate student number on insert (SECURITY DEFINER bypasses RLS on counter table)
DROP FUNCTION IF EXISTS generate_student_number() CASCADE;
CREATE OR REPLACE FUNCTION generate_student_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  year_val INT := EXTRACT(YEAR FROM NOW())::INT;
  counter_val INT;
BEGIN
  INSERT INTO student_number_counters (year, counter)
  VALUES (year_val, 1)
  ON CONFLICT (year) DO UPDATE
    SET counter = student_number_counters.counter + 1
  RETURNING counter INTO counter_val;

  NEW.student_number := 'KTI-' || year_val::TEXT || '-' || LPAD(counter_val::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_student_number ON applications;
CREATE TRIGGER assign_student_number
  BEFORE INSERT ON applications
  FOR EACH ROW EXECUTE FUNCTION generate_student_number();

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_updated_at ON applications;
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_number_counters ENABLE ROW LEVEL SECURITY;

-- Drop before recreating
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can submit applications" ON applications;
  DROP POLICY IF EXISTS "Admins can read applications" ON applications;
  DROP POLICY IF EXISTS "Admins can update applications" ON applications;
  DROP POLICY IF EXISTS "No direct access to counters" ON student_number_counters;
END $$;

-- Anyone (including unauthenticated) can INSERT an application
CREATE POLICY "Public can submit applications" ON applications
  FOR INSERT WITH CHECK (true);

-- Only authenticated users (admins) can read applications
CREATE POLICY "Admins can read applications" ON applications
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only authenticated users (admins) can update applications
CREATE POLICY "Admins can update applications" ON applications
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Counter table: no direct access (SECURITY DEFINER trigger bypasses RLS)
CREATE POLICY "No direct access to counters" ON student_number_counters
  FOR ALL USING (false);

-- ============================================================
-- Storage
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can upload documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can view documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
END $$;

-- Applicants can upload documents without an account
CREATE POLICY "Public can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'application-documents');

-- Only authenticated admins can view documents
CREATE POLICY "Admins can view documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'application-documents' AND auth.uid() IS NOT NULL);

-- Only authenticated admins can delete documents
CREATE POLICY "Admins can delete documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'application-documents' AND auth.uid() IS NOT NULL);
