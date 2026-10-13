-- ============================================================
-- KTI: Admin Management System
-- Run in: Supabase Dashboard > SQL Editor (after taking a backup)
--
-- Prerequisite: 20260813_fix_approval_trigger_consistency.sql has
-- been run (the `students` table must exist).
--
-- What this adds (all additive — no existing application data is
-- dropped or rewritten, apart from linking each application to the
-- new `kti_courses` row that matches its existing `programme` text):
--
--   staff_users         role-based admin access (replaces "any
--                       logged-in user is an admin")
--   kti_courses             admin-managed course catalogue
--   course_prices       append-only price history with effective dates
--   intakes             intake periods per course
--   form_versions       draft/published application form config
--   application_events  status + edit history per application
--   application_notes   internal notes
--   payments            manually recorded payments/refunds (no gateway)
--   audit_log           sensitive admin changes (prices, roles, ...)
--   rate_limits         submission/upload throttling
--
-- Security changes:
--   * Anonymous users can no longer INSERT into or SELECT from
--     `applications`. Public submissions go through the server
--     (service role) via submit_application(), which validates the
--     course, intake, deadline and documents and snapshots the price.
--   * Anonymous uploads to storage are removed; the server uploads.
--   * Every admin policy now checks staff_users roles instead of
--     `auth.uid() IS NOT NULL`.
--
-- IMPORTANT — after running this, nobody has admin access until you
-- grant it. See the "BOOTSTRAP" section at the very bottom.
--
-- Safe to run more than once.
-- ============================================================

begin;

do $$
begin
  if to_regclass('public.students') is null then
    raise exception 'Run 20260813_fix_approval_trigger_consistency.sql before this migration';
  end if;
end $$;

-- Stop (changing nothing) if any table this migration creates already
-- exists with a different structure — e.g. from another project sharing
-- this database. An unrelated `public.courses` table is why the new
-- course catalogue is called `kti_courses`; that table is left untouched.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('kti_courses', 'legacy_name'), ('course_prices', 'tuition_fee'), ('intakes', 'applications_open_at'),
      ('staff_users', 'role'), ('audit_log', 'entity_type'), ('form_versions', 'config'),
      ('application_events', 'event_type'), ('application_notes', 'body'), ('payments', 'void_reason'),
      ('rate_limits', 'window_start')
    ) as v(tbl, col)
  loop
    if to_regclass('public.' || r.tbl) is not null and not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = r.tbl and column_name = r.col
    ) then
      raise exception 'A table named public.% already exists with a different structure. Nothing was changed — please send this message to the developer.', r.tbl;
    end if;
  end loop;
end $$;

-- ============================================================
-- 1. Staff users & roles
-- ============================================================

create table if not exists staff_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null
             check (role in ('super_admin', 'admissions', 'course_admin', 'finance', 'read_only')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table staff_users enable row level security;

-- Role helpers. SECURITY DEFINER so policies can call them without
-- recursing into staff_users' own RLS.
create or replace function kti_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select role from staff_users where user_id = auth.uid() and active
$$;

create or replace function kti_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select kti_staff_role() is not null
$$;

-- super_admin passes every role check.
create or replace function kti_has_role(variadic roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(kti_staff_role() = 'super_admin' or kti_staff_role() = any(roles), false)
$$;

drop policy if exists "Staff read own row or super admin reads all" on staff_users;
create policy "Staff read own row or super admin reads all" on staff_users
  for select to authenticated
  using (user_id = auth.uid() or kti_has_role('super_admin'));

drop policy if exists "Super admin manages staff" on staff_users;
create policy "Super admin manages staff" on staff_users
  for all to authenticated
  using (kti_has_role('super_admin'))
  with check (kti_has_role('super_admin'));

-- Never leave the system without an active super admin.
create or replace function protect_last_super_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.role = 'super_admin' and old.active)
     or (tg_op = 'UPDATE' and old.role = 'super_admin' and old.active
         and (new.role <> 'super_admin' or not new.active)) then
    if (select count(*) from staff_users
        where role = 'super_admin' and active and user_id <> old.user_id) = 0 then
      raise exception 'LAST_SUPER_ADMIN: at least one active super admin is required';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_last_super_admin on staff_users;
create trigger trg_protect_last_super_admin
  before update or delete on staff_users
  for each row execute function protect_last_super_admin();

drop trigger if exists trg_staff_users_updated_at on staff_users;
create trigger trg_staff_users_updated_at
  before update on staff_users
  for each row execute function set_updated_at();

-- ============================================================
-- 2. Audit log (sensitive admin changes)
-- ============================================================

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id   text,
  action      text not null,
  changes     jsonb,
  actor_id    uuid,
  actor_email text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

alter table audit_log enable row level security;

drop policy if exists "Super admin reads audit log" on audit_log;
create policy "Super admin reads audit log" on audit_log
  for select to authenticated using (kti_has_role('super_admin'));
-- No insert/update/delete policies: rows are only written by the
-- SECURITY DEFINER trigger below, and are immutable.

create or replace function current_actor_email()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select email from staff_users where user_id = auth.uid()), 'system')
$$;

-- Generic row-change audit trigger. TG_ARGV[0] names the id column.
create or replace function log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_id_col text := coalesce(tg_argv[0], 'id');
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_changes := v_new;
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_changes := v_old;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value))
      into v_changes
      from jsonb_each(v_new) n
     where n.key not in ('updated_at')
       and (v_old -> n.key) is distinct from n.value;
    if v_changes is null then
      return new;
    end if;
  end if;

  insert into audit_log (entity_type, entity_id, action, changes, actor_id, actor_email)
  values (tg_table_name, coalesce(v_new, v_old) ->> v_id_col, lower(tg_op), v_changes,
          auth.uid(), current_actor_email());

  return coalesce(new, old);
end;
$$;

-- For sensitive actions that don't change a row (e.g. exporting data).
create or replace function log_admin_action(p_action text, p_entity_type text, p_details jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not kti_is_staff() then
    raise exception 'FORBIDDEN: staff only';
  end if;
  insert into audit_log (entity_type, action, changes, actor_id, actor_email)
  values (left(p_entity_type, 60), left(p_action, 60), p_details, auth.uid(), current_actor_email());
end;
$$;

revoke execute on function log_admin_action(text, text, jsonb) from public, anon;
grant execute on function log_admin_action(text, text, jsonb) to authenticated;

drop trigger if exists trg_audit_staff_users on staff_users;
create trigger trg_audit_staff_users
  after insert or update or delete on staff_users
  for each row execute function log_audit('user_id');

-- ============================================================
-- 3. Courses, prices, intakes
-- ============================================================

create table if not exists kti_courses (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  name                   text not null check (length(btrim(name)) between 2 and 200),
  description            text check (description is null or length(description) <= 5000),
  category               text check (category is null or length(category) <= 120),
  qualification_type     text check (qualification_type is null or length(qualification_type) <= 120),
  duration               text check (duration is null or length(duration) <= 120),
  requirements           text check (requirements is null or length(requirements) <= 5000),
  study_modes            text[] not null default '{}'
                         check (study_modes <@ array['online', 'in_person', 'blended']),
  status                 text not null default 'draft'
                         check (status in ('draft', 'active', 'inactive', 'archived')),
  accepting_applications boolean not null default true,
  application_deadline   date,
  capacity               int check (capacity is null or capacity > 0),
  sort_order             int not null default 0,
  -- The free-text `applications.programme` value this course replaces,
  -- so historical applications stay linked.
  legacy_name            text unique,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists kti_courses_name_unique on kti_courses (lower(btrim(name)));
create index if not exists kti_courses_status_idx on kti_courses (status, sort_order);

drop trigger if exists trg_kti_courses_updated_at on kti_courses;
create trigger trg_kti_courses_updated_at
  before update on kti_courses
  for each row execute function set_updated_at();

drop trigger if exists trg_audit_kti_courses on kti_courses;
create trigger trg_audit_kti_courses
  after insert or update or delete on kti_courses
  for each row execute function log_audit();

alter table kti_courses enable row level security;

drop policy if exists "Staff read kti_courses" on kti_courses;
create policy "Staff read kti_courses" on kti_courses
  for select to authenticated using (kti_is_staff());

drop policy if exists "Course admins insert kti_courses" on kti_courses;
create policy "Course admins insert kti_courses" on kti_courses
  for insert to authenticated with check (kti_has_role('course_admin'));

drop policy if exists "Course admins update kti_courses" on kti_courses;
create policy "Course admins update kti_courses" on kti_courses
  for update to authenticated
  using (kti_has_role('course_admin')) with check (kti_has_role('course_admin'));

-- Deleting is only possible for kti_courses nothing references (the FK
-- from applications is ON DELETE RESTRICT); archive everything else.
drop policy if exists "Course admins delete unused kti_courses" on kti_courses;
create policy "Course admins delete unused kti_courses" on kti_courses
  for delete to authenticated using (kti_has_role('course_admin') and status = 'draft');

-- Append-only price history. A price applies from effective_from
-- until the next row's effective_from.
create table if not exists course_prices (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references kti_courses(id) on delete cascade,
  currency          text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  tuition_fee       numeric(12, 2) not null check (tuition_fee >= 0),
  registration_fee  numeric(12, 2) not null default 0 check (registration_fee >= 0),
  -- [{ "label": "Materials", "amount": 250.00 }, ...]
  other_fees        jsonb not null default '[]' check (jsonb_typeof(other_fees) = 'array'),
  -- Promotional discount off the tuition fee, optionally time-limited.
  discount_amount   numeric(12, 2) not null default 0 check (discount_amount >= 0),
  discount_label    text check (discount_label is null or length(discount_label) <= 120),
  discount_ends_at  timestamptz,
  effective_from    timestamptz not null default now(),
  note              text check (note is null or length(note) <= 1000),
  created_by        uuid,
  created_at        timestamptz not null default now(),
  check (discount_amount <= tuition_fee)
);

create index if not exists course_prices_lookup_idx on course_prices (course_id, effective_from desc);

drop trigger if exists trg_audit_course_prices on course_prices;
create trigger trg_audit_course_prices
  after insert or update or delete on course_prices
  for each row execute function log_audit();

-- Prices are history: they can't be edited, and only not-yet-effective
-- (scheduled) prices can be deleted.
create or replace function protect_course_prices()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'PRICE_IMMUTABLE: add a new price instead of editing an existing one';
  end if;
  -- Deleting a (draft) course cascades to its prices; allow that.
  if tg_op = 'DELETE' and old.effective_from <= now()
     and exists (select 1 from kti_courses where id = old.course_id) then
    raise exception 'PRICE_IMMUTABLE: prices that have taken effect cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_protect_course_prices on course_prices;
create trigger trg_protect_course_prices
  before update or delete on course_prices
  for each row execute function protect_course_prices();

alter table course_prices enable row level security;

drop policy if exists "Staff read prices" on course_prices;
create policy "Staff read prices" on course_prices
  for select to authenticated using (kti_is_staff());

drop policy if exists "Course admins add prices" on course_prices;
create policy "Course admins add prices" on course_prices
  for insert to authenticated
  with check (kti_has_role('course_admin') and created_by = auth.uid());

drop policy if exists "Course admins delete scheduled prices" on course_prices;
create policy "Course admins delete scheduled prices" on course_prices
  for delete to authenticated using (kti_has_role('course_admin'));

-- The full fee breakdown for a course at a point in time, or NULL if no
-- price has been set. This exact object is stored on each application.
create or replace function course_price_quote(p_course_id uuid, p_at timestamptz default now())
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'price_id',         p.id,
    'currency',         p.currency,
    'tuition_fee',      p.tuition_fee,
    'registration_fee', p.registration_fee,
    'other_fees',       p.other_fees,
    'discount_amount',  d.amount,
    'discount_label',   case when d.amount > 0 then p.discount_label end,
    'total',            greatest(p.tuition_fee - d.amount, 0) + p.registration_fee + o.total,
    'effective_from',   p.effective_from,
    'quoted_at',        p_at
  )
  from (
    select * from course_prices
     where course_id = p_course_id and effective_from <= p_at
     order by effective_from desc, created_at desc
     limit 1
  ) p
  cross join lateral (
    select case when p.discount_ends_at is null or p.discount_ends_at > p_at
                then p.discount_amount else 0 end as amount
  ) d
  cross join lateral (
    select coalesce(sum((f ->> 'amount')::numeric), 0) as total
      from jsonb_array_elements(p.other_fees) f
  ) o
$$;

create table if not exists intakes (
  id                     uuid primary key default gen_random_uuid(),
  course_id              uuid not null references kti_courses(id) on delete cascade,
  name                   text not null check (length(btrim(name)) between 2 and 120),
  starts_on              date,
  ends_on                date,
  applications_open_at   timestamptz,
  applications_close_at  timestamptz,
  capacity               int check (capacity is null or capacity > 0),
  status                 text not null default 'open'
                         check (status in ('planned', 'open', 'closed', 'archived')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (course_id, name),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (applications_close_at is null or applications_open_at is null
         or applications_close_at > applications_open_at)
);

drop trigger if exists trg_intakes_updated_at on intakes;
create trigger trg_intakes_updated_at
  before update on intakes
  for each row execute function set_updated_at();

drop trigger if exists trg_audit_intakes on intakes;
create trigger trg_audit_intakes
  after insert or update or delete on intakes
  for each row execute function log_audit();

alter table intakes enable row level security;

drop policy if exists "Staff read intakes" on intakes;
create policy "Staff read intakes" on intakes
  for select to authenticated using (kti_is_staff());

drop policy if exists "Course admins manage intakes" on intakes;
create policy "Course admins manage intakes" on intakes
  for all to authenticated
  using (kti_has_role('course_admin')) with check (kti_has_role('course_admin'));

create or replace function intake_is_open(i intakes, p_at timestamptz default now())
returns boolean language sql stable as $$
  select i.status = 'open'
     and (i.applications_open_at is null or i.applications_open_at <= p_at)
     and (i.applications_close_at is null or i.applications_close_at > p_at)
$$;

-- ============================================================
-- 4. Application form configuration (draft / published)
-- ============================================================

create table if not exists form_versions (
  id           uuid primary key default gen_random_uuid(),
  status       text not null check (status in ('draft', 'published', 'superseded')),
  config       jsonb not null check (jsonb_typeof(config) = 'object'),
  note         text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_by uuid,
  published_at timestamptz
);

create unique index if not exists form_versions_one_draft on form_versions ((true)) where status = 'draft';
create unique index if not exists form_versions_one_published on form_versions ((true)) where status = 'published';

drop trigger if exists trg_form_versions_updated_at on form_versions;
create trigger trg_form_versions_updated_at
  before update on form_versions
  for each row execute function set_updated_at();

drop trigger if exists trg_audit_form_versions on form_versions;
create trigger trg_audit_form_versions
  after insert or update or delete on form_versions
  for each row execute function log_audit();

alter table form_versions enable row level security;

drop policy if exists "Staff read form versions" on form_versions;
create policy "Staff read form versions" on form_versions
  for select to authenticated using (kti_is_staff());

drop policy if exists "Super admin edits form draft" on form_versions;
create policy "Super admin edits form draft" on form_versions
  for all to authenticated
  using (kti_has_role('super_admin')) with check (kti_has_role('super_admin'));

-- Atomically make the current draft the published version.
create or replace function publish_form_draft()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not kti_has_role('super_admin') then
    raise exception 'FORBIDDEN: only a super admin can publish the application form';
  end if;
  select id into v_id from form_versions where status = 'draft' for update;
  if v_id is null then
    raise exception 'NO_DRAFT: there is no draft to publish';
  end if;
  update form_versions set status = 'superseded' where status = 'published';
  update form_versions
     set status = 'published', published_by = auth.uid(), published_at = now()
   where id = v_id;
  return v_id;
end;
$$;

revoke execute on function publish_form_draft() from public, anon;
grant execute on function publish_form_draft() to authenticated;

-- ============================================================
-- 5. Seed kti_courses from the previously hard-coded list
--    (no prices are invented — set them in the admin dashboard)
-- ============================================================

insert into kti_courses (code, name, category, status, sort_order, legacy_name)
values
  ('KTI-001', 'Pastoral Care Training (Narrative Community-Based)', 'UP-Endorsed Courses', 'active', 10, 'Pastoral Care Training (Narrative Community-Based)'),
  ('KTI-002', 'Starting and Sustaining Community Projects', 'UP-Endorsed Courses', 'active', 20, 'Starting and Sustaining Community Projects'),
  ('KTI-003', 'Crisis and Trauma Support', 'UP-Endorsed Courses', 'active', 30, 'Crisis and Trauma Support'),
  ('KTI-004', 'Early Childhood Development', 'UP-Endorsed Courses', 'active', 40, 'Early Childhood Development'),
  ('KTI-005', 'Peace Building', 'UP-Endorsed Courses', 'active', 50, 'Peace Building'),
  ('KTI-006', 'From Victims to Agents', 'UP-Endorsed Courses', 'active', 60, 'From Victims to Agents'),
  ('KTI-007', 'Narrative Group Counselling (offered by Prof Roelf Schoeman – Centre for Faith and Community)', 'UP-Endorsed Courses', 'active', 70, 'Narrative Group Counselling (offered by Prof Roelf Schoeman – Centre for Faith and Community)'),
  ('KTI-008', 'Moderator (SAQA US 117759)', 'Other Courses', 'active', 80, 'Moderator (SAQA US 117759)'),
  ('KTI-009', 'Assessor (SAQA US 115753)', 'Other Courses', 'active', 90, 'Assessor (SAQA US 115753)'),
  ('KTI-010', 'Facilitator (SAQA US 117871)', 'Other Courses', 'active', 100, 'Facilitator (SAQA US 117871)'),
  ('KTI-011', 'Narrative Group Counselling (offered by Apostle Kenny Mokgope)', 'Other Courses', 'active', 110, 'Narrative Group Counselling (offered by Apostle Kenny Mokgope)'),
  ('KTI-012', 'Praise and Worship Programme', 'Other Courses', 'active', 120, 'Praise and Worship Programme'),
  ('KTI-013', 'Diploma in Theology', 'Other Courses', 'active', 130, 'Diploma in Theology'),
  ('KTI-014', 'Ordination', 'Other Courses', 'active', 140, 'Ordination'),
  ('KTI-015', 'How to manufacture your own Perfume', 'Skill Development Programme', 'active', 150, 'How to manufacture your own Perfume'),
  ('KTI-016', 'How to manufacture the Detergents', 'Skill Development Programme', 'active', 160, 'How to manufacture the Detergents')
on conflict do nothing;

-- Any other programme names found on existing applications become
-- inactive kti_courses so those applications stay linked.
insert into kti_courses (code, name, status, sort_order, legacy_name)
select 'KTI-L' || lpad(row_number() over (order by p.programme)::text, 3, '0')
         || '-' || upper(substr(md5(p.programme), 1, 4)),
       left(p.programme, 200), 'inactive', 1000, p.programme
  from (select distinct btrim(programme) as programme
          from applications
         where programme is not null and btrim(programme) <> '') p
 where not exists (select 1 from kti_courses c where c.legacy_name = p.programme)
   and not exists (select 1 from kti_courses c where lower(btrim(c.name)) = lower(left(p.programme, 200)))
on conflict do nothing;

-- ============================================================
-- 6. Applications: new columns, statuses, links
-- ============================================================

alter table applications add column if not exists course_id uuid references kti_courses(id) on delete restrict;
alter table applications add column if not exists intake_id uuid references intakes(id) on delete restrict;
alter table applications add column if not exists study_mode text;
alter table applications add column if not exists price_snapshot jsonb;
alter table applications add column if not exists custom_answers jsonb not null default '{}';
alter table applications add column if not exists form_version_id uuid references form_versions(id) on delete set null;
alter table applications add column if not exists archived_at timestamptz;
alter table applications add column if not exists archived_by uuid;
alter table applications add column if not exists archive_reason text;

-- Generated search helpers (name + reference + email + phone + ID).
alter table applications add column if not exists applicant_name text
  generated always as (
    btrim(coalesce(personal_info ->> 'first_name', '') || ' ' || coalesce(personal_info ->> 'last_name', ''))
  ) stored;

alter table applications add column if not exists search_text text
  generated always as (
    lower(
      coalesce(student_number, '') || ' ' ||
      coalesce(personal_info ->> 'first_name', '') || ' ' ||
      coalesce(personal_info ->> 'last_name', '') || ' ' ||
      coalesce(personal_info ->> 'id_number', '') || ' ' ||
      coalesce(contact_details ->> 'email', '') || ' ' ||
      coalesce(contact_details ->> 'phone', '') || ' ' ||
      coalesce(contact_details ->> 'whatsapp', '')
    )
  ) stored;

alter table applications drop constraint if exists applications_status_check;
alter table applications add constraint applications_status_check
  check (status in ('submitted', 'under_review', 'info_requested', 'approved',
                    'waitlisted', 'rejected', 'withdrawn'));

create index if not exists applications_submitted_idx on applications (submitted_at desc);
create index if not exists applications_status_idx on applications (status);
create index if not exists applications_course_idx on applications (course_id);
create index if not exists applications_intake_idx on applications (intake_id);

-- Link existing applications to their course (only rows not yet linked).
update applications a
   set course_id = c.id
  from kti_courses c
 where a.course_id is null
   and a.programme is not null
   and c.legacy_name = btrim(a.programme);

-- Fields that must never change after submission. The price snapshot
-- in particular is what the applicant was quoted; later course price
-- changes must not alter it.
create or replace function protect_application_fields()
returns trigger language plpgsql as $$
begin
  if new.student_number is distinct from old.student_number then
    raise exception 'IMMUTABLE_FIELD: student_number cannot be changed';
  end if;
  if new.submitted_at is distinct from old.submitted_at then
    raise exception 'IMMUTABLE_FIELD: submitted_at cannot be changed';
  end if;
  if old.price_snapshot is not null and new.price_snapshot is distinct from old.price_snapshot then
    raise exception 'IMMUTABLE_FIELD: the price recorded at submission cannot be changed';
  end if;
  if old.course_id is not null and new.course_id is distinct from old.course_id then
    raise exception 'IMMUTABLE_FIELD: the course of a submitted application cannot be changed';
  end if;
  if new.status is distinct from old.status then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_application_fields on applications;
create trigger trg_protect_application_fields
  before update on applications
  for each row execute function protect_application_fields();

-- Enforce course / intake capacity when accepting an applicant.
create or replace function enforce_enrolment_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_capacity int;
  v_taken int;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.course_id is not null then
      select capacity into v_capacity from kti_courses where id = new.course_id for update;
      if v_capacity is not null then
        select count(*) into v_taken from applications
         where course_id = new.course_id and status = 'approved' and id <> new.id;
        if v_taken >= v_capacity then
          raise exception 'COURSE_FULL: this course has reached its capacity of % students', v_capacity;
        end if;
      end if;
    end if;
    if new.intake_id is not null then
      select capacity into v_capacity from intakes where id = new.intake_id for update;
      if v_capacity is not null then
        select count(*) into v_taken from applications
         where intake_id = new.intake_id and status = 'approved' and id <> new.id;
        if v_taken >= v_capacity then
          raise exception 'INTAKE_FULL: this intake has reached its capacity of % students', v_capacity;
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_enrolment_capacity on applications;
create trigger trg_enforce_enrolment_capacity
  before update of status on applications
  for each row execute function enforce_enrolment_capacity();

-- ============================================================
-- 7. Application history, notes
-- ============================================================

create table if not exists application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  event_type     text not null
                 check (event_type in ('submitted', 'status_changed', 'record_edited',
                                       'archived', 'restored', 'note_added',
                                       'payment_recorded', 'payment_voided', 'message_prepared')),
  from_status    text,
  to_status      text,
  details        jsonb,
  actor_id       uuid,
  actor_email    text,
  created_at     timestamptz not null default now()
);

create index if not exists application_events_app_idx on application_events (application_id, created_at desc);
create index if not exists application_events_created_idx on application_events (created_at desc);

alter table application_events enable row level security;

drop policy if exists "Staff read application events" on application_events;
create policy "Staff read application events" on application_events
  for select to authenticated using (kti_is_staff());
-- Written only by SECURITY DEFINER triggers; immutable.

create or replace function record_application_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_edits jsonb := '{}';
  v_col text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    insert into application_events (application_id, event_type, to_status, details, actor_id, actor_email)
    values (new.id, 'submitted', new.status,
            jsonb_build_object('course_id', new.course_id, 'price_snapshot', new.price_snapshot),
            auth.uid(), case when auth.uid() is null then 'applicant' else current_actor_email() end);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into application_events (application_id, event_type, from_status, to_status, details, actor_id, actor_email)
    values (new.id, 'status_changed', old.status, new.status,
            case when new.rejection_reason is distinct from old.rejection_reason
                 then jsonb_build_object('reason', new.rejection_reason) end,
            auth.uid(), current_actor_email());
  end if;

  if new.archived_at is distinct from old.archived_at then
    insert into application_events (application_id, event_type, details, actor_id, actor_email)
    values (new.id, case when new.archived_at is null then 'restored' else 'archived' end,
            jsonb_build_object('reason', new.archive_reason), auth.uid(), current_actor_email());
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  foreach v_col in array array['personal_info', 'contact_details', 'next_of_kin', 'education',
                               'personal_statement', 'custom_answers', 'intake_id', 'study_mode',
                               'course_id', 'documents']
  loop
    if (v_old -> v_col) is distinct from (v_new -> v_col) then
      v_edits := v_edits || jsonb_build_object(v_col, jsonb_build_object('from', v_old -> v_col, 'to', v_new -> v_col));
    end if;
  end loop;

  if v_edits <> '{}' then
    insert into application_events (application_id, event_type, details, actor_id, actor_email)
    values (new.id, 'record_edited', v_edits, auth.uid(), current_actor_email());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_record_application_event on applications;
create trigger trg_record_application_event
  after insert or update on applications
  for each row execute function record_application_event();

create table if not exists application_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  body           text not null check (length(btrim(body)) between 1 and 5000),
  author_id      uuid,
  author_email   text,
  created_at     timestamptz not null default now()
);

create index if not exists application_notes_app_idx on application_notes (application_id, created_at desc);

alter table application_notes enable row level security;

drop policy if exists "Staff read notes" on application_notes;
create policy "Staff read notes" on application_notes
  for select to authenticated using (kti_is_staff());

drop policy if exists "Admissions add notes" on application_notes;
create policy "Admissions add notes" on application_notes
  for insert to authenticated
  with check (kti_has_role('admissions') and author_id = auth.uid());

create or replace function record_note_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into application_events (application_id, event_type, details, actor_id, actor_email)
  values (new.application_id, 'note_added', jsonb_build_object('note_id', new.id), auth.uid(), current_actor_email());
  return new;
end;
$$;

drop trigger if exists trg_record_note_event on application_notes;
create trigger trg_record_note_event
  after insert on application_notes
  for each row execute function record_note_event();

-- ============================================================
-- 8. Payments (manual records — no payment gateway)
-- ============================================================

create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete restrict,
  kind           text not null check (kind in ('payment', 'refund')),
  amount         numeric(12, 2) not null check (amount > 0),
  currency       text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  method         text not null check (method in ('eft', 'cash', 'card_external', 'other')),
  reference      text check (reference is null or length(reference) <= 120),
  received_on    date not null default current_date,
  note           text check (note is null or length(note) <= 1000),
  recorded_by    uuid,
  created_at     timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid,
  void_reason    text
);

create index if not exists payments_app_idx on payments (application_id);

alter table payments enable row level security;

drop policy if exists "Staff read payments" on payments;
create policy "Staff read payments" on payments
  for select to authenticated using (kti_is_staff());

drop policy if exists "Finance records payments" on payments;
create policy "Finance records payments" on payments
  for insert to authenticated
  with check (kti_has_role('finance') and recorded_by = auth.uid() and voided_at is null);

drop policy if exists "Finance voids payments" on payments;
create policy "Finance voids payments" on payments
  for update to authenticated
  using (kti_has_role('finance')) with check (kti_has_role('finance'));

-- Payments are never edited or deleted — only voided, once.
create or replace function protect_payments()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'PAYMENT_IMMUTABLE: payments cannot be deleted; void them instead';
  end if;
  if old.voided_at is not null then
    raise exception 'PAYMENT_IMMUTABLE: this payment has already been voided';
  end if;
  if (to_jsonb(new) - array['voided_at', 'voided_by', 'void_reason'])
     is distinct from (to_jsonb(old) - array['voided_at', 'voided_by', 'void_reason']) then
    raise exception 'PAYMENT_IMMUTABLE: only void details can be set on a payment';
  end if;
  if new.voided_at is null or coalesce(btrim(new.void_reason), '') = '' then
    raise exception 'PAYMENT_IMMUTABLE: voiding requires a reason';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_payments on payments;
create trigger trg_protect_payments
  before update or delete on payments
  for each row execute function protect_payments();

drop trigger if exists trg_audit_payments on payments;
create trigger trg_audit_payments
  after insert or update on payments
  for each row execute function log_audit();

create or replace function record_payment_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into application_events (application_id, event_type, details, actor_id, actor_email)
  values (new.application_id,
          case when tg_op = 'INSERT' then 'payment_recorded' else 'payment_voided' end,
          jsonb_build_object('payment_id', new.id, 'kind', new.kind, 'amount', new.amount,
                             'currency', new.currency, 'reason', new.void_reason),
          auth.uid(), current_actor_email());
  return new;
end;
$$;

drop trigger if exists trg_record_payment_event on payments;
create trigger trg_record_payment_event
  after insert or update on payments
  for each row execute function record_payment_event();

-- Per-application balance. security_invoker so callers' RLS applies.
drop view if exists application_financials;
create view application_financials with (security_invoker = true) as
select a.id as application_id,
       a.price_snapshot ->> 'currency' as currency,
       (a.price_snapshot ->> 'total')::numeric as amount_due,
       coalesce(sum(p.amount) filter (where p.kind = 'payment' and p.voided_at is null), 0) as amount_paid,
       coalesce(sum(p.amount) filter (where p.kind = 'refund' and p.voided_at is null), 0) as amount_refunded,
       coalesce(sum(case when p.voided_at is not null then 0
                         when p.kind = 'payment' then p.amount else -p.amount end), 0) as net_paid,
       case
         when a.price_snapshot is null then 'no_fee'
         when coalesce(sum(p.amount) filter (where p.kind = 'refund' and p.voided_at is null), 0) > 0
              and coalesce(sum(case when p.voided_at is not null then 0
                                    when p.kind = 'payment' then p.amount else -p.amount end), 0) <= 0
           then 'refunded'
         when coalesce(sum(case when p.voided_at is not null then 0
                                when p.kind = 'payment' then p.amount else -p.amount end), 0) <= 0
           then 'unpaid'
         when coalesce(sum(case when p.voided_at is not null then 0
                                when p.kind = 'payment' then p.amount else -p.amount end), 0)
              < (a.price_snapshot ->> 'total')::numeric
           then 'partially_paid'
         else 'paid'
       end as payment_status
  from applications a
  left join payments p on p.application_id = a.id
 group by a.id;

-- ============================================================
-- 9. Students (enrolments): link to course / intake
-- ============================================================

alter table students add column if not exists course_id uuid references kti_courses(id) on delete set null;
alter table students add column if not exists intake_id uuid references intakes(id) on delete set null;

update students s
   set course_id = a.course_id, intake_id = a.intake_id
  from applications a
 where s.application_id = a.id and s.course_id is null and a.course_id is not null;

create or replace function handle_kti_application_approved()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pi jsonb := new.personal_info;
  v_cd jsonb := new.contact_details;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into students (
      application_id, student_number, full_name, phone, email, programme,
      course_id, intake_id, joined_date, status
    ) values (
      new.id,
      new.student_number,
      btrim(coalesce(v_pi ->> 'first_name', '') || ' ' || coalesce(v_pi ->> 'last_name', '')),
      coalesce(nullif(v_cd ->> 'whatsapp', ''), v_cd ->> 'phone', ''),
      coalesce(nullif(v_cd ->> 'email', ''), v_pi ->> 'email'),
      new.programme,
      new.course_id,
      new.intake_id,
      current_date,
      'active'
    )
    on conflict (student_number) do update
      set status = 'active', course_id = excluded.course_id, intake_id = excluded.intake_id;
  elsif old.status = 'approved' and new.status is distinct from 'approved' then
    -- Withdrawn / reversed decisions keep the student record for history.
    update students set status = 'inactive' where application_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kti_application_approved on applications;
create trigger trg_kti_application_approved
  after update of status on applications
  for each row execute function handle_kti_application_approved();

-- ============================================================
-- 10. Tighten existing RLS: staff roles instead of "logged in"
-- ============================================================

-- applications
drop policy if exists "Public can submit applications" on applications;
drop policy if exists "Public can read back their new submission" on applications;
drop policy if exists "Admins can read applications" on applications;
drop policy if exists "Admins can update applications" on applications;
revoke insert, select, update, delete on applications from anon;

drop policy if exists "Staff read applications" on applications;
create policy "Staff read applications" on applications
  for select to authenticated using (kti_is_staff());

drop policy if exists "Admissions update applications" on applications;
create policy "Admissions update applications" on applications
  for update to authenticated
  using (kti_has_role('admissions')) with check (kti_has_role('admissions'));

-- students
drop policy if exists "Admin full access — members" on students;
drop policy if exists "Admin full access — students" on students;
drop policy if exists "Staff read students" on students;
create policy "Staff read students" on students
  for select to authenticated using (kti_is_staff());
drop policy if exists "Admissions manage students" on students;
create policy "Admissions manage students" on students
  for update to authenticated
  using (kti_has_role('admissions')) with check (kti_has_role('admissions'));

-- WhatsApp
drop policy if exists "Admin full access — templates" on whatsapp_templates;
drop policy if exists "Admin full access — logs" on whatsapp_logs;
drop policy if exists "Admin full access — settings" on whatsapp_settings;

drop policy if exists "Staff read templates" on whatsapp_templates;
create policy "Staff read templates" on whatsapp_templates
  for select to authenticated using (kti_is_staff());
drop policy if exists "Admissions manage templates" on whatsapp_templates;
create policy "Admissions manage templates" on whatsapp_templates
  for all to authenticated
  using (kti_has_role('admissions')) with check (kti_has_role('admissions'));

drop policy if exists "Staff read message log" on whatsapp_logs;
create policy "Staff read message log" on whatsapp_logs
  for select to authenticated using (kti_is_staff());
drop policy if exists "Admissions log messages" on whatsapp_logs;
create policy "Admissions log messages" on whatsapp_logs
  for insert to authenticated with check (kti_has_role('admissions'));

drop policy if exists "Staff read WhatsApp settings" on whatsapp_settings;
create policy "Staff read WhatsApp settings" on whatsapp_settings
  for select to authenticated using (kti_is_staff());
drop policy if exists "Admissions manage WhatsApp settings" on whatsapp_settings;
create policy "Admissions manage WhatsApp settings" on whatsapp_settings
  for update to authenticated
  using (kti_has_role('admissions')) with check (kti_has_role('admissions'));

alter table whatsapp_templates drop constraint if exists whatsapp_templates_trigger_type_check;
alter table whatsapp_templates add constraint whatsapp_templates_trigger_type_check
  check (trigger_type in ('submission', 'under_review', 'info_requested', 'approved', 'waitlisted',
                          'rejected', 'withdrawn', 'course_update', 'admission_instructions', 'manual'));

-- wa.me links only open WhatsApp; we can't know whether a message was
-- actually sent or delivered, so record that honestly.
alter table whatsapp_logs add column if not exists delivery_status text not null default 'not_tracked'
  check (delivery_status in ('not_tracked'));

-- Prepared WhatsApp messages appear in the application's history.
create or replace function record_message_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.application_id is not null then
    insert into application_events (application_id, event_type, details, actor_id, actor_email)
    values (new.application_id, 'message_prepared',
            jsonb_build_object('channel', 'whatsapp', 'template', new.template_name,
                               'trigger', new.trigger_type, 'log_id', new.id,
                               'delivery_status', new.delivery_status),
            auth.uid(), current_actor_email());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_message_event on whatsapp_logs;
create trigger trg_record_message_event
  after insert on whatsapp_logs
  for each row execute function record_message_event();

insert into whatsapp_templates (name, trigger_type, body, active, is_default)
select v.name, v.trigger_type, v.body, true, true
  from (values
    ('More information needed', 'info_requested',
     E'Hello {{ApplicantName}},\n\nThank you for applying to *Ken''s Training Institute* for *{{ProgrammeName}}* ({{ApplicationID}}).\n\nWe need a little more information before we can continue reviewing your application. Please reply to this message and our admissions team will explain what is needed.\n\nKTI Admissions Team'),
    ('Placed on waiting list', 'waitlisted',
     E'Dear {{ApplicantName}},\n\nYour application ({{ApplicationID}}) for *{{ProgrammeName}}* has been placed on our *waiting list*. We will contact you as soon as a place becomes available.\n\nKTI Admissions Team'),
    ('Admission instructions', 'admission_instructions',
     E'Dear {{ApplicantName}},\n\nCongratulations again on your acceptance to *{{ProgrammeName}}* ({{ApplicationID}}). Here are your next steps for registration:\n\n[Add instructions here]\n\nKTI Admissions Team'),
    ('Course update', 'course_update',
     E'Hello {{ApplicantName}},\n\nThere has been an update to *{{ProgrammeName}}* that affects your application ({{ApplicationID}}):\n\n[Describe the change here]\n\nKTI Admissions Team')
  ) as v(name, trigger_type, body)
 where not exists (select 1 from whatsapp_templates t where t.trigger_type = v.trigger_type and t.is_default);

-- Storage: only the server (service role) uploads; staff can view.
drop policy if exists "Public can upload documents" on storage.objects;
drop policy if exists "Admins can view documents" on storage.objects;
drop policy if exists "Admins can delete documents" on storage.objects;

drop policy if exists "Staff view application documents" on storage.objects;
create policy "Staff view application documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'application-documents' and public.kti_is_staff());

drop policy if exists "Super admin deletes application documents" on storage.objects;
create policy "Super admin deletes application documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'application-documents' and public.kti_has_role('super_admin'));

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
 where id = 'application-documents';

-- ============================================================
-- 11. Rate limiting (server-side only)
-- ============================================================

create table if not exists rate_limits (
  bucket       text not null,
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, key, window_start)
);

alter table rate_limits enable row level security;
-- No policies: only the service role (which bypasses RLS) touches it.

create or replace function hit_rate_limit(p_bucket text, p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  delete from rate_limits where window_start < now() - make_interval(secs => p_window_seconds * 2);
  insert into rate_limits (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window, 1)
  on conflict (bucket, key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

revoke execute on function hit_rate_limit(text, text, int, int) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, text, int, int) to service_role;

-- ============================================================
-- 12. Public catalogue + submission
-- ============================================================

-- Everything the public form needs: open kti_courses with their current
-- fees and open intakes, plus the published form configuration.
create or replace function get_public_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'code', c.code,
               'name', c.name,
               'description', c.description,
               'category', c.category,
               'qualification_type', c.qualification_type,
               'duration', c.duration,
               'requirements', c.requirements,
               'study_modes', to_jsonb(c.study_modes),
               'application_deadline', c.application_deadline,
               'open_for_applications', c.accepting_applications
                                        and (c.application_deadline is null or c.application_deadline >= current_date),
               'price', course_price_quote(c.id),
               'intakes', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', i.id, 'name', i.name, 'starts_on', i.starts_on,
                          'applications_close_at', i.applications_close_at)
                        order by i.starts_on nulls last, i.name)
                   from intakes i
                  where i.course_id = c.id and intake_is_open(i)
               ), '[]'::jsonb)
             ) order by c.sort_order, c.name)
        from kti_courses c
       where c.status = 'active'
    ), '[]'::jsonb),
    'form', (select config from form_versions where status = 'published'),
    'form_version_id', (select id from form_versions where status = 'published')
  )
$$;

revoke execute on function get_public_catalog() from public;
grant execute on function get_public_catalog() to anon, authenticated, service_role;

create or replace function submit_application(p jsonb)
returns table (id uuid, student_number text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_course kti_courses%rowtype;
  v_intake intakes%rowtype;
  v_form jsonb;
  v_form_id uuid;
  v_draft text := p ->> 'draft_id';
  v_doc jsonb;
  v_has_open_intakes boolean;
  v_id_number text := lower(btrim(coalesce(p -> 'personal_info' ->> 'id_number', '')));
  v_row applications%rowtype;
begin
  if pg_column_size(p) > 200000 then
    raise exception 'PAYLOAD_TOO_LARGE';
  end if;

  -- Form-level open/close window (published config).
  select fv.config, fv.id into v_form, v_form_id from form_versions fv where fv.status = 'published';
  if v_form is not null then
    if coalesce((v_form -> 'settings' ->> 'applications_open')::boolean, true) = false
       or coalesce(nullif(v_form -> 'settings' ->> 'opens_at', '')::timestamptz, '-infinity') > now()
       or coalesce(nullif(v_form -> 'settings' ->> 'closes_at', '')::timestamptz, 'infinity') <= now() then
      raise exception 'APPLICATIONS_CLOSED';
    end if;
  end if;

  -- Course must exist and be open.
  begin
    select * into v_course from kti_courses c where c.id = (p ->> 'course_id')::uuid for share;
  exception when invalid_text_representation then
    raise exception 'COURSE_NOT_FOUND';
  end;
  if v_course.id is null then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if v_course.status <> 'active' or not v_course.accepting_applications
     or (v_course.application_deadline is not null and v_course.application_deadline < current_date) then
    raise exception 'COURSE_CLOSED';
  end if;

  -- Intake: required when the course has open intakes.
  select exists (select 1 from intakes i where i.course_id = v_course.id and intake_is_open(i))
    into v_has_open_intakes;
  if nullif(p ->> 'intake_id', '') is not null then
    begin
      select * into v_intake from intakes i where i.id = (p ->> 'intake_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'INTAKE_CLOSED';
    end;
    if v_intake.id is null or v_intake.course_id <> v_course.id or not intake_is_open(v_intake) then
      raise exception 'INTAKE_CLOSED';
    end if;
  elsif v_has_open_intakes then
    raise exception 'INTAKE_REQUIRED';
  end if;

  -- Study mode must be one the course offers.
  if cardinality(v_course.study_modes) > 0 then
    if nullif(p ->> 'study_mode', '') is null or not ((p ->> 'study_mode') = any(v_course.study_modes)) then
      raise exception 'STUDY_MODE_INVALID';
    end if;
  elsif nullif(p ->> 'study_mode', '') is not null then
    raise exception 'STUDY_MODE_INVALID';
  end if;

  -- One live application per person per course.
  if v_id_number <> '' and exists (
    select 1 from applications a
     where a.course_id = v_course.id
       and lower(btrim(a.personal_info ->> 'id_number')) = v_id_number
       and a.status not in ('rejected', 'withdrawn')
       and a.archived_at is null
  ) then
    raise exception 'DUPLICATE_APPLICATION';
  end if;

  -- Documents must have been uploaded by the server into this draft's folder.
  if jsonb_typeof(coalesce(p -> 'documents', '[]'::jsonb)) <> 'array' then
    raise exception 'DOCUMENTS_INVALID';
  end if;
  for v_doc in select * from jsonb_array_elements(coalesce(p -> 'documents', '[]'::jsonb)) loop
    if v_draft is null or v_draft !~ '^[0-9a-f-]{36}$'
       or (v_doc ->> 'path') is null
       or left(v_doc ->> 'path', length('applications/' || v_draft || '/')) <> 'applications/' || v_draft || '/'
       or not exists (select 1 from storage.objects o
                       where o.bucket_id = 'application-documents' and o.name = v_doc ->> 'path') then
      raise exception 'DOCUMENTS_INVALID';
    end if;
  end loop;

  insert into applications (
    course_id, intake_id, study_mode, programme,
    personal_info, contact_details, next_of_kin, education, personal_statement,
    custom_answers, documents, declaration, signature_data,
    price_snapshot, form_version_id, status, submitted_at
  ) values (
    v_course.id, v_intake.id, nullif(p ->> 'study_mode', ''), v_course.name,
    coalesce(p -> 'personal_info', '{}'), coalesce(p -> 'contact_details', '{}'),
    coalesce(p -> 'next_of_kin', '{}'), coalesce(p -> 'education', '{}'),
    coalesce(p -> 'personal_statement', '{}'), coalesce(p -> 'custom_answers', '{}'),
    coalesce(p -> 'documents', '[]'), coalesce((p ->> 'declaration')::boolean, false),
    left(p ->> 'signature_data', 200),
    course_price_quote(v_course.id), v_form_id, 'submitted', now()
  )
  returning * into v_row;

  return query select v_row.id, v_row.student_number;
end;
$$;

revoke execute on function submit_application(jsonb) from public, anon, authenticated;
grant execute on function submit_application(jsonb) to service_role;

-- ============================================================
-- 13. Reporting (security invoker — callers' RLS applies)
-- ============================================================

-- Courses with their current fees and application counts.
drop view if exists course_overview;
create view course_overview with (security_invoker = true) as
select c.*,
       course_price_quote(c.id) as current_price,
       (select count(*) from applications a where a.course_id = c.id) as application_count,
       (select count(*) from applications a where a.course_id = c.id and a.status = 'approved') as enrolled_count,
       (select count(*) from applications a
         where a.course_id = c.id and a.status in ('submitted', 'under_review', 'info_requested')
           and a.archived_at is null) as pending_count,
       (select count(*) from intakes i where i.course_id = c.id and intake_is_open(i)) as open_intake_count
  from kti_courses c;

revoke all on course_overview, application_financials from anon;

create or replace function admin_report(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with apps as (
    select a.* from applications a
     where (p_from is null or a.submitted_at >= p_from)
       and (p_to is null or a.submitted_at < p_to)
  )
  select jsonb_build_object(
    'total', (select count(*) from apps),
    'archived', (select count(*) from apps where archived_at is not null),
    'by_status', coalesce((select jsonb_object_agg(status, n) from
                   (select status, count(*) n from apps group by status) s), '{}'::jsonb),
    'by_course', coalesce((select jsonb_agg(jsonb_build_object(
                     'course_id', course_id, 'course', coalesce(c.name, x.programme, 'Not specified'),
                     'total', n, 'approved', approved) order by n desc)
                   from (select course_id, max(programme) programme, count(*) n,
                                count(*) filter (where status = 'approved') approved
                           from apps group by course_id) x
                   left join kti_courses c on c.id = x.course_id), '[]'::jsonb),
    'by_month', coalesce((select jsonb_agg(jsonb_build_object('month', m, 'total', n) order by m)
                   from (select to_char(date_trunc('month', submitted_at), 'YYYY-MM') m, count(*) n
                           from apps group by 1) x), '[]'::jsonb),
    'enrolments', coalesce((select jsonb_agg(jsonb_build_object(
                     'course', coalesce(c.name, x.programme, 'Not specified'),
                     'intake', coalesce(i.name, '—'), 'total', n) order by c.name, i.name)
                   from (select course_id, intake_id, max(programme) programme, count(*) n
                           from apps where status = 'approved' group by course_id, intake_id) x
                   left join kti_courses c on c.id = x.course_id
                   left join intakes i on i.id = x.intake_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
                     'currency', currency, 'due', due, 'paid', paid, 'refunded', refunded,
                     'outstanding', due - net) order by currency)
                   from (select f.currency,
                                sum(f.amount_due) due, sum(f.amount_paid) paid,
                                sum(f.amount_refunded) refunded, sum(f.net_paid) net
                           from application_financials f
                           join apps on apps.id = f.application_id
                          where f.currency is not null
                          group by f.currency) x), '[]'::jsonb),
    'payment_status', coalesce((select jsonb_object_agg(payment_status, n) from
                   (select f.payment_status, count(*) n
                      from application_financials f join apps on apps.id = f.application_id
                     group by 1) s), '{}'::jsonb)
  )
$$;

revoke execute on function admin_report(timestamptz, timestamptz) from public, anon;
grant execute on function admin_report(timestamptz, timestamptz) to authenticated;

commit;

-- ============================================================
-- BOOTSTRAP — grant yourself super admin access (run once).
--
-- 1. See which accounts exist:
--      select id, email, created_at from auth.users order by created_at;
--
-- 2. Make your own account the first super admin (edit the email):
--
--      insert into staff_users (user_id, email, full_name, role)
--      select id, email, 'Your Name', 'super_admin'
--        from auth.users where email = 'you@example.com'
--      on conflict (user_id) do update set role = 'super_admin', active = true;
--
-- After that, add other staff from Admin > Staff & roles.
--
-- Also recommended: Supabase Dashboard > Authentication > Providers >
-- Email: turn OFF "Allow new users to sign up", so only accounts you
-- invite can exist.
-- ============================================================
