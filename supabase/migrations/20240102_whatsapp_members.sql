-- ============================================================
-- KTI: WhatsApp Communication Module + Members
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── WhatsApp Templates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  trigger_type TEXT        NOT NULL DEFAULT 'manual'
                           CHECK (trigger_type IN ('submission','approved','rejected','under_review','manual')),
  body         TEXT        NOT NULL DEFAULT '',
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  is_default   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WhatsApp Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID        REFERENCES applications(id) ON DELETE SET NULL,
  applicant_name   TEXT        NOT NULL DEFAULT '',
  whatsapp_number  TEXT        NOT NULL DEFAULT '',
  template_id      UUID        REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  template_name    TEXT,
  message_body     TEXT        NOT NULL DEFAULT '',
  trigger_type     TEXT        NOT NULL DEFAULT 'manual',
  sent_by          TEXT        NOT NULL DEFAULT '',
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── WhatsApp Settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id                       SERIAL PRIMARY KEY,
  auto_send_on_submission  BOOLEAN NOT NULL DEFAULT FALSE,
  auto_send_on_approval    BOOLEAN NOT NULL DEFAULT FALSE,
  auto_send_on_rejection   BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed a single settings row
INSERT INTO whatsapp_settings (auto_send_on_submission, auto_send_on_approval, auto_send_on_rejection)
SELECT FALSE, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_settings);

-- ── Auto-updated timestamp ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Default KTI Templates ─────────────────────────────────────
INSERT INTO whatsapp_templates (name, trigger_type, body, active, is_default) VALUES

('Application received', 'submission',
'Hello {{ApplicantName}} 👋

Thank you for applying to *Ken''s Training Institute* for the *{{ProgrammeName}}* programme.

Your application ({{ApplicationID}}) has been received and is under review. We will be in touch shortly.

God bless you! 🙏
KTI Admissions Team', TRUE, TRUE),

('Application approved', 'approved',
'Dear {{ApplicantName}},

We are delighted to inform you that your application to *Ken''s Training Institute* for the *{{ProgrammeName}}* programme has been *APPROVED*! 🎉

Please watch your email for further instructions regarding enrolment.

Welcome to the KTI family!
KTI Admissions Team', TRUE, TRUE),

('Application declined', 'rejected',
'Dear {{ApplicantName}},

Thank you for your interest in *Ken''s Training Institute*. After careful consideration, we regret to inform you that your application for the *{{ProgrammeName}}* programme was not successful at this time.

We encourage you to reapply in a future intake.

God bless,
KTI Admissions Team', TRUE, TRUE),

('Now under review', 'under_review',
'Hello {{ApplicantName}},

Your application to *Ken''s Training Institute* ({{ApplicationID}}) is now *under review*. Our admissions team will contact you if any additional information is needed.

KTI Admissions Team', TRUE, TRUE),

('General follow-up', 'manual',
'Hello {{ApplicantName}},

This is a follow-up from *Ken''s Training Institute* regarding your application for the *{{ProgrammeName}}* programme ({{ApplicationID}}).

Please reply to this message or contact us at admissions@kti.ac.za if you have any questions.

KTI Admissions Team', TRUE, TRUE)

ON CONFLICT DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_settings  ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admins) can do everything
CREATE POLICY "Admin full access — templates" ON whatsapp_templates
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Admin full access — logs" ON whatsapp_logs
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Admin full access — settings" ON whatsapp_settings
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── Members table ─────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS kti_member_seq START 1;

CREATE OR REPLACE FUNCTION generate_kti_member_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'KTI-MBR-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
         LPAD(NEXTVAL('kti_member_seq')::TEXT, 4, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number  TEXT        UNIQUE DEFAULT generate_kti_member_number(),
  application_id UUID        REFERENCES applications(id) ON DELETE SET NULL,
  full_name      TEXT        NOT NULL DEFAULT '',
  phone          TEXT,
  email          TEXT,
  church         TEXT,
  programme      TEXT,
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','inactive','suspended')),
  joined_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access — members" ON members
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Trigger: create member when application approved ──────────
CREATE OR REPLACE FUNCTION handle_kti_application_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pi   JSONB;
  v_cd   JSONB;
  v_ch   JSONB;
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_church TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    v_pi    := NEW.personal_info;
    v_cd    := NEW.contact_details;
    v_ch    := NEW.church_background;
    v_name  := TRIM(COALESCE(v_pi->>'first_name','') || ' ' || COALESCE(v_pi->>'last_name',''));
    v_phone := COALESCE(v_cd->>'whatsapp', v_cd->>'phone', '');
    v_email := v_pi->>'email';
    v_church := v_ch->>'church_name';

    INSERT INTO members (
      application_id, full_name, phone, email, church, programme, joined_date
    ) VALUES (
      NEW.id,
      v_name,
      v_phone,
      v_email,
      v_church,
      NEW.programme,
      CURRENT_DATE
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kti_application_approved ON applications;
CREATE TRIGGER trg_kti_application_approved
  AFTER UPDATE OF status ON applications
  FOR EACH ROW EXECUTE FUNCTION handle_kti_application_approved();
