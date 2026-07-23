-- ============================================================
-- KTI Admission System — Initial Schema (idempotent)
-- ============================================================

-- Drop all tables in reverse FK order so re-runs start clean
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS reviewer_assignments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS application_documents CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS student_number_counters CASCADE;
DROP TABLE IF EXISTS programmes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'reviewer')),
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Programmes
CREATE TABLE IF NOT EXISTS programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_years INT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student number counter (atomic, no race conditions)
CREATE TABLE IF NOT EXISTS student_number_counters (
  year INT PRIMARY KEY,
  counter INT DEFAULT 0
);

-- Student number generation function
DROP FUNCTION IF EXISTS generate_student_number() CASCADE;
CREATE OR REPLACE FUNCTION generate_student_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES programmes(id),
  student_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  reviewer_id UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  personal_info JSONB DEFAULT '{}',
  contact_details JSONB DEFAULT '{}',
  next_of_kin JSONB DEFAULT '{}',
  education JSONB DEFAULT '{}',
  programme_selection JSONB DEFAULT '{}',
  church_background JSONB DEFAULT '{}',
  personal_statement JSONB DEFAULT '{}',
  declaration BOOLEAN DEFAULT FALSE,
  current_step INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Application documents
CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('id_document','matric_certificate','church_letter','passport_photo','other')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2),
  payment_date DATE,
  reference_number TEXT,
  proof_storage_path TEXT,
  proof_file_name TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviewer assignments
CREATE TABLE IF NOT EXISTS reviewer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(application_id, reviewer_id)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_number_counters ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role (SECURITY DEFINER avoids RLS recursion)
DROP FUNCTION IF EXISTS get_my_role() CASCADE;
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Drop existing policies before recreating (idempotent)
DO $$ BEGIN
  -- profiles
  DROP POLICY IF EXISTS "Users read own profile" ON profiles;
  DROP POLICY IF EXISTS "Users update own profile" ON profiles;
  DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
  -- programmes
  DROP POLICY IF EXISTS "Anyone reads active programmes" ON programmes;
  DROP POLICY IF EXISTS "Admins manage programmes" ON programmes;
  -- applications
  DROP POLICY IF EXISTS "Students read own application" ON applications;
  DROP POLICY IF EXISTS "Students insert own application" ON applications;
  DROP POLICY IF EXISTS "Students update own draft" ON applications;
  DROP POLICY IF EXISTS "Staff read all applications" ON applications;
  DROP POLICY IF EXISTS "Admins update applications" ON applications;
  -- application_documents
  DROP POLICY IF EXISTS "Students manage own documents" ON application_documents;
  DROP POLICY IF EXISTS "Staff read all documents" ON application_documents;
  -- payments
  DROP POLICY IF EXISTS "Students read own payments" ON payments;
  DROP POLICY IF EXISTS "Students insert own payment" ON payments;
  DROP POLICY IF EXISTS "Admins manage payments" ON payments;
  -- notifications
  DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
  DROP POLICY IF EXISTS "System insert notifications" ON notifications;
  -- reviewer_assignments
  DROP POLICY IF EXISTS "Reviewers see own assignments" ON reviewer_assignments;
  DROP POLICY IF EXISTS "Admins manage assignments" ON reviewer_assignments;
  -- audit_log
  DROP POLICY IF EXISTS "Admins read audit log" ON audit_log;
  DROP POLICY IF EXISTS "System insert audit log" ON audit_log;
  -- student_number_counters
  DROP POLICY IF EXISTS "No direct access" ON student_number_counters;
END $$;

-- profiles
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT USING (get_my_role() IN ('admin','reviewer'));

-- programmes
CREATE POLICY "Anyone reads active programmes" ON programmes FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage programmes" ON programmes FOR ALL USING (get_my_role() = 'admin');

-- applications
CREATE POLICY "Students read own application" ON applications FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Students insert own application" ON applications FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Students update own draft" ON applications FOR UPDATE USING (profile_id = auth.uid() AND status = 'draft');
CREATE POLICY "Staff read all applications" ON applications FOR SELECT USING (get_my_role() IN ('admin','reviewer'));
CREATE POLICY "Admins update applications" ON applications FOR UPDATE USING (get_my_role() = 'admin');

-- application_documents
CREATE POLICY "Students manage own documents" ON application_documents FOR ALL
  USING (application_id IN (SELECT id FROM applications WHERE profile_id = auth.uid()));
CREATE POLICY "Staff read all documents" ON application_documents FOR SELECT USING (get_my_role() IN ('admin','reviewer'));

-- payments
CREATE POLICY "Students read own payments" ON payments FOR SELECT
  USING (application_id IN (SELECT id FROM applications WHERE profile_id = auth.uid()));
CREATE POLICY "Students insert own payment" ON payments FOR INSERT
  WITH CHECK (application_id IN (SELECT id FROM applications WHERE profile_id = auth.uid()));
CREATE POLICY "Admins manage payments" ON payments FOR ALL USING (get_my_role() = 'admin');

-- notifications
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "System insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- reviewer_assignments
CREATE POLICY "Reviewers see own assignments" ON reviewer_assignments FOR SELECT
  USING (reviewer_id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "Admins manage assignments" ON reviewer_assignments FOR ALL USING (get_my_role() = 'admin');

-- audit_log
CREATE POLICY "Admins read audit log" ON audit_log FOR SELECT USING (get_my_role() IN ('admin','reviewer'));
CREATE POLICY "System insert audit log" ON audit_log FOR INSERT WITH CHECK (true);

-- student_number_counters
CREATE POLICY "No direct access" ON student_number_counters FOR ALL USING (false);

-- ============================================================
-- Storage Buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('application-documents', 'application-documents', false),
  ('payment-proofs', 'payment-proofs', false),
  ('profile-photos', 'profile-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies before recreating
DO $$ BEGIN
  DROP POLICY IF EXISTS "Students upload own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Students read own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins read all application docs" ON storage.objects;
  DROP POLICY IF EXISTS "Students delete own documents" ON storage.objects;
  DROP POLICY IF EXISTS "Students upload own proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Students read own proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Admins read all proofs" ON storage.objects;
  DROP POLICY IF EXISTS "Users manage own photo" ON storage.objects;
END $$;

-- Storage RLS: application-documents
CREATE POLICY "Students upload own documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'application-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students read own documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'application-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all application docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'application-documents' AND get_my_role() IN ('admin','reviewer'));

CREATE POLICY "Students delete own documents" ON storage.objects FOR DELETE
  USING (bucket_id = 'application-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage RLS: payment-proofs
CREATE POLICY "Students upload own proofs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students read own proofs" ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all proofs" ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND get_my_role() = 'admin');

-- Storage RLS: profile-photos
CREATE POLICY "Users manage own photo" ON storage.objects FOR ALL
  USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO programmes (name, duration_years, description) VALUES
  ('Certificate in Theology', 1, 'A one-year foundation in Scripture, faith, and ministry. Perfect for beginners seeking to grow in their understanding of the faith.'),
  ('Diploma in Ministry', 2, 'A two-year programme preparing you to lead and serve in your church and community with depth and practical skill.'),
  ('Bachelor of Theology', 3, 'A full degree for deeper study, teaching, and pastoral leadership across the breadth of theological disciplines.')
ON CONFLICT DO NOTHING;
