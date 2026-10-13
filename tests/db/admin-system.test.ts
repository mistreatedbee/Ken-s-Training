import { beforeEach, describe, expect, it } from 'vitest'
import {
  asAnon, asService, asSuperuser, asUser, createDb, createUser, errorOf,
  NEW_MIGRATION, readMigration, type Db,
} from './harness'

const DRAFT = '11111111-2222-3333-4444-555555555555'

function payload(courseId: string, extra: Record<string, unknown> = {}) {
  return {
    course_id: courseId,
    draft_id: DRAFT,
    personal_info: { first_name: 'Grace', last_name: 'Mokoena', id_number: '8001015009087' },
    contact_details: { phone: '0824451290', email: 'grace@example.com' },
    next_of_kin: {}, education: {}, personal_statement: {},
    documents: [],
    declaration: true,
    signature_data: 'Grace Mokoena',
    ...extra,
  }
}

async function submit(db: Db, p: Record<string, unknown>) {
  await asService(db)
  const { rows } = await db.query<{ id: string; student_number: string }>(
    'select * from submit_application($1)', [JSON.stringify(p)],
  )
  return rows[0]
}

async function makeCourse(db: Db, adminId: string, fields: Record<string, unknown> = {}) {
  await asUser(db, adminId)
  const code = `T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const { rows } = await db.query<{ id: string }>(
    `insert into kti_courses (code, name, status, study_modes, capacity)
     values ($1, $2, $3, $4, $5) returning id`,
    [code, (fields.name as string) ?? `Course ${code}`, fields.status ?? 'active',
     fields.study_modes ?? [], fields.capacity ?? null],
  )
  return rows[0].id
}

async function addPrice(db: Db, adminId: string, courseId: string, tuition: number, extra: Record<string, unknown> = {}) {
  await asUser(db, adminId)
  await db.query(
    `insert into course_prices (course_id, tuition_fee, registration_fee, other_fees,
                                discount_amount, discount_label, discount_ends_at, effective_from, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, coalesce($8::timestamptz, now()), $9)`,
    [courseId, tuition, extra.registration_fee ?? 0, JSON.stringify(extra.other_fees ?? []),
     extra.discount_amount ?? 0, extra.discount_label ?? null, extra.discount_ends_at ?? null,
     extra.effective_from ?? null, adminId],
  )
}

describe('KTI admin management system (database)', () => {
  let db: Db
  let superAdmin: string
  let admissions: string
  let courseAdmin: string
  let finance: string
  let readOnly: string
  let outsider: string

  beforeEach(async () => {
    db = await createDb()
    superAdmin = await createUser(db, 'super_admin')
    admissions = await createUser(db, 'admissions')
    courseAdmin = await createUser(db, 'course_admin')
    finance = await createUser(db, 'finance')
    readOnly = await createUser(db, 'read_only')
    outsider = await createUser(db) // e.g. a self-signup with no staff row
  })

  // ── Permissions ───────────────────────────────────────────────

  describe('permissions', () => {
    it('anonymous users can neither read nor insert applications directly', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      await submit(db, payload(courseId))
      await asAnon(db)
      expect(await errorOf(() => db.query('select id from applications'))).toMatch(/permission denied/)
      expect(await errorOf(() => db.query(
        `insert into applications (programme, status) values ('x', 'approved')`,
      ))).toMatch(/permission denied/)
    })

    it('anonymous users cannot call submit_application directly (server only)', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      await asAnon(db)
      expect(await errorOf(() => db.query('select * from submit_application($1)', [JSON.stringify(payload(courseId))])))
        .toMatch(/permission denied/)
    })

    it('a logged-in user without a staff role sees no applicant data', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      await submit(db, payload(courseId))
      await asUser(db, outsider)
      expect((await db.query('select * from applications')).rows).toHaveLength(0)
      expect((await db.query('select * from students')).rows).toHaveLength(0)
      expect((await db.query('select * from kti_courses')).rows).toHaveLength(0)
      const res = await db.query(`update applications set status = 'approved' returning id`)
      expect(res.rows).toHaveLength(0)
    })

    it('read-only staff can view but not modify applications', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(courseId))
      await asUser(db, readOnly)
      expect((await db.query('select id from applications')).rows).toHaveLength(1)
      const res = await db.query(`update applications set status = 'approved' where id = $1 returning id`, [app.id])
      expect(res.rows).toHaveLength(0)
      expect(await errorOf(() => db.query(
        `insert into application_notes (application_id, body, author_id) values ($1, 'hi', $2)`, [app.id, readOnly],
      ))).toMatch(/row-level security/)
    })

    it('only course admins (and super admins) can change courses and prices', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      for (const who of [admissions, finance, readOnly, outsider]) {
        await asUser(db, who)
        const res = await db.query(`update kti_courses set name = 'Hacked' where id = $1 returning id`, [courseId])
        expect(res.rows).toHaveLength(0)
        expect(await errorOf(() => db.query(
          `insert into course_prices (course_id, tuition_fee, created_by) values ($1, 1, $2)`, [courseId, who],
        ))).toMatch(/row-level security/)
      }
      await addPrice(db, superAdmin, courseId, 1000)
      await addPrice(db, courseAdmin, courseId, 1200)
    })

    it('admissions can change status; course admins cannot', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(courseId))
      await asUser(db, courseAdmin)
      expect((await db.query(`update applications set status = 'approved' where id = $1 returning id`, [app.id])).rows).toHaveLength(0)
      await asUser(db, admissions)
      expect((await db.query(`update applications set status = 'under_review' where id = $1 returning id`, [app.id])).rows).toHaveLength(1)
    })

    it('only finance (and super admins) can record payments', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(courseId))
      for (const who of [admissions, courseAdmin, readOnly]) {
        await asUser(db, who)
        expect(await errorOf(() => db.query(
          `insert into payments (application_id, kind, amount, method, recorded_by) values ($1, 'payment', 100, 'eft', $2)`,
          [app.id, who],
        ))).toMatch(/row-level security/)
      }
      await asUser(db, finance)
      await db.query(
        `insert into payments (application_id, kind, amount, method, recorded_by) values ($1, 'payment', 100, 'eft', $2)`,
        [app.id, finance],
      )
    })

    it('staff cannot promote themselves; only super admins manage staff', async () => {
      await asUser(db, admissions)
      const res = await db.query(`update staff_users set role = 'super_admin' where user_id = $1 returning user_id`, [admissions])
      expect(res.rows).toHaveLength(0)
      expect(await errorOf(() => db.query(
        `insert into staff_users (user_id, email, role) values ($1, 'x@y.z', 'super_admin')`, [outsider],
      ))).toMatch(/row-level security/)

      await asUser(db, superAdmin)
      await db.query(`insert into staff_users (user_id, email, role) values ($1, 'x@y.z', 'read_only')`, [outsider])
    })

    it('the last active super admin cannot be demoted or removed', async () => {
      await asUser(db, superAdmin)
      expect(await errorOf(() => db.query(
        `update staff_users set role = 'read_only' where user_id = $1`, [superAdmin],
      ))).toMatch(/LAST_SUPER_ADMIN/)
    })

    it('deactivated staff lose access immediately', async () => {
      const courseId = await makeCourse(db, courseAdmin)
      await submit(db, payload(courseId))
      await asUser(db, superAdmin)
      await db.query('update staff_users set active = false where user_id = $1', [readOnly])
      await asUser(db, readOnly)
      expect((await db.query('select id from applications')).rows).toHaveLength(0)
    })

    it('only super admins can read the audit log and publish the form', async () => {
      await asUser(db, admissions)
      expect((await db.query('select * from audit_log')).rows).toHaveLength(0)
      expect(await errorOf(() => db.query('select publish_form_draft()'))).toMatch(/FORBIDDEN/)
      await asUser(db, superAdmin)
      expect((await db.query('select * from audit_log')).rows.length).toBeGreaterThan(0)
    })

    it('storage: anonymous uploads are no longer allowed; non-staff cannot read documents', async () => {
      await asSuperuser(db)
      await db.query(`insert into storage.objects (bucket_id, name) values ('application-documents', 'applications/x/a.pdf')`)
      await asAnon(db)
      expect(await errorOf(() => db.query(
        `insert into storage.objects (bucket_id, name) values ('application-documents', 'evil.exe')`,
      ))).toMatch(/row-level security/)
      await asUser(db, outsider)
      expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
      await asUser(db, readOnly)
      expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
    })
  })

  // ── Courses & pricing ─────────────────────────────────────────

  describe('courses and pricing', () => {
    it('only active courses appear in the public catalogue, with their current price', async () => {
      const active = await makeCourse(db, courseAdmin, { name: 'Active course' })
      await makeCourse(db, courseAdmin, { name: 'Draft course', status: 'draft' })
      await makeCourse(db, courseAdmin, { name: 'Inactive course', status: 'inactive' })
      await addPrice(db, courseAdmin, active, 2500, { registration_fee: 300, other_fees: [{ label: 'Books', amount: 200 }] })

      await asAnon(db)
      const { rows } = await db.query<{ c: { courses: { name: string; price: { total: number; currency: string } }[] } }>(
        'select get_public_catalog() c',
      )
      const names = rows[0].c.courses.map((c) => c.name)
      expect(names).toContain('Active course')
      expect(names).not.toContain('Draft course')
      expect(names).not.toContain('Inactive course')
      const course = rows[0].c.courses.find((c) => c.name === 'Active course')!
      // lib/catalog.ts reads exactly these top-level keys.
      expect(Object.keys(rows[0].c).sort()).toEqual(['courses', 'form', 'form_version_id'])
      expect(Number(course.price.total)).toBe(3000)
      expect(course.price.currency).toBe('ZAR')
    })

    it('a new price is reflected immediately; a scheduled price only once it takes effect', async () => {
      const id = await makeCourse(db, courseAdmin)
      await addPrice(db, courseAdmin, id, 1000, { effective_from: new Date(Date.now() - 60_000).toISOString() })
      await addPrice(db, courseAdmin, id, 1500, { effective_from: new Date(Date.now() + 86_400_000).toISOString() })
      const quote = async (at?: string) => {
        await asSuperuser(db)
        const { rows } = await db.query<{ q: { total: number } }>(
          'select course_price_quote($1, coalesce($2::timestamptz, now())) q', [id, at ?? null],
        )
        return Number(rows[0].q.total)
      }
      expect(await quote()).toBe(1000)
      expect(await quote(new Date(Date.now() + 2 * 86_400_000).toISOString())).toBe(1500)
      await addPrice(db, courseAdmin, id, 1100)
      expect(await quote()).toBe(1100)
    })

    it('promotional discounts apply until they end', async () => {
      const id = await makeCourse(db, courseAdmin)
      await addPrice(db, courseAdmin, id, 1000, {
        discount_amount: 200, discount_label: 'Early bird',
        discount_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      await asSuperuser(db)
      const now = (await db.query<{ q: { total: number; discount_label: string } }>('select course_price_quote($1) q', [id])).rows[0].q
      expect(Number(now.total)).toBe(800)
      expect(now.discount_label).toBe('Early bird')
      const later = (await db.query<{ q: { total: number } }>(
        `select course_price_quote($1, now() + interval '2 days') q`, [id],
      )).rows[0].q
      expect(Number(later.total)).toBe(1000)
    })

    it('price history cannot be edited, and effective prices cannot be deleted', async () => {
      const id = await makeCourse(db, courseAdmin)
      await addPrice(db, courseAdmin, id, 1000)
      // No UPDATE policy at all: RLS silently matches nothing...
      await asUser(db, superAdmin)
      expect((await db.query('update course_prices set tuition_fee = 1 where course_id = $1 returning id', [id])).rows).toHaveLength(0)
      // ...and the trigger blocks it even for the database owner.
      await asSuperuser(db)
      expect(await errorOf(() => db.query('update course_prices set tuition_fee = 1 where course_id = $1', [id])))
        .toMatch(/PRICE_IMMUTABLE/)
      await asUser(db, courseAdmin)
      expect(await errorOf(() => db.query('delete from course_prices where course_id = $1', [id])))
        .toMatch(/PRICE_IMMUTABLE/)

      // A scheduled (future) price can be withdrawn.
      await addPrice(db, courseAdmin, id, 2000, { effective_from: new Date(Date.now() + 86_400_000).toISOString() })
      await asUser(db, courseAdmin)
      expect((await db.query('delete from course_prices where course_id = $1 and tuition_fee = 2000 returning id', [id])).rows).toHaveLength(1)
    })

    it('the price recorded on an application does not change when the course price changes', async () => {
      const id = await makeCourse(db, courseAdmin)
      await addPrice(db, courseAdmin, id, 1000, { registration_fee: 100 })
      const app = await submit(db, payload(id))
      await addPrice(db, courseAdmin, id, 5000, { registration_fee: 500 })

      await asUser(db, admissions)
      const { rows } = await db.query<{ price_snapshot: { total: number; tuition_fee: number } }>(
        'select price_snapshot from applications where id = $1', [app.id],
      )
      expect(Number(rows[0].price_snapshot.total)).toBe(1100)
      expect(Number(rows[0].price_snapshot.tuition_fee)).toBe(1000)

      await asUser(db, superAdmin)
      expect(await errorOf(() => db.query(
        `update applications set price_snapshot = '{"total": 1}' where id = $1`, [app.id],
      ))).toMatch(/IMMUTABLE_FIELD/)
    })

    it('courses with applications cannot be deleted, only archived; the applications remain', async () => {
      const id = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, courseAdmin)
      await db.query(`update kti_courses set status = 'archived' where id = $1`, [id])
      expect((await db.query('delete from kti_courses where id = $1 returning id', [id])).rows).toHaveLength(0)
      await asUser(db, readOnly)
      expect((await db.query('select id from applications where id = $1', [app.id])).rows).toHaveLength(1)
    })

    it('records price and course changes in the audit log', async () => {
      const id = await makeCourse(db, courseAdmin)
      await addPrice(db, courseAdmin, id, 1000)
      await asUser(db, courseAdmin)
      await db.query(`update kti_courses set status = 'inactive' where id = $1`, [id])
      await asUser(db, superAdmin)
      const { rows } = await db.query<{ entity_type: string; action: string; actor_email: string; changes: Record<string, unknown> }>(
        `select entity_type, action, actor_email, changes from audit_log where entity_id = $1 or changes ->> 'course_id' = $1 order by created_at`,
        [id],
      )
      expect(rows.map((r) => `${r.entity_type}:${r.action}`)).toEqual(
        expect.arrayContaining(['kti_courses:insert', 'course_prices:insert', 'kti_courses:update']),
      )
      const update = rows.find((r) => r.entity_type === 'kti_courses' && r.action === 'update')!
      expect(update.changes).toEqual({ status: { from: 'active', to: 'inactive' } })
      expect(update.actor_email).toMatch(/@example\.com/)
    })
  })

  // ── Submission ────────────────────────────────────────────────

  describe('submission', () => {
    it('creates an application with a reference number and a submitted event', async () => {
      const id = await makeCourse(db, courseAdmin, { name: 'Peace Studies' })
      const app = await submit(db, payload(id))
      expect(app.student_number).toMatch(/^KTI-\d{4}-\d{4}$/)
      await asUser(db, readOnly)
      const { rows } = await db.query<{ programme: string; status: string; course_id: string }>(
        'select programme, status, course_id from applications where id = $1', [app.id],
      )
      expect(rows[0]).toMatchObject({ programme: 'Peace Studies', status: 'submitted', course_id: id })
      const ev = await db.query<{ event_type: string; actor_email: string }>(
        'select event_type, actor_email from application_events where application_id = $1', [app.id],
      )
      expect(ev.rows).toEqual([{ event_type: 'submitted', actor_email: 'applicant' }])
    })

    it('rejects courses that are not open', async () => {
      const draft = await makeCourse(db, courseAdmin, { status: 'draft' })
      const inactive = await makeCourse(db, courseAdmin, { status: 'inactive' })
      const closed = await makeCourse(db, courseAdmin)
      const pastDeadline = await makeCourse(db, courseAdmin)
      await asUser(db, courseAdmin)
      await db.query('update kti_courses set accepting_applications = false where id = $1', [closed])
      await db.query(`update kti_courses set application_deadline = current_date - 1 where id = $1`, [pastDeadline])
      for (const id of [draft, inactive, closed, pastDeadline]) {
        expect(await errorOf(() => submit(db, payload(id)))).toMatch(/COURSE_CLOSED/)
      }
      expect(await errorOf(() => submit(db, payload('not-a-uuid')))).toMatch(/COURSE_NOT_FOUND/)
    })

    it('a deactivated course stops receiving applications but keeps existing ones', async () => {
      const id = await makeCourse(db, courseAdmin)
      const first = await submit(db, payload(id))
      await asUser(db, courseAdmin)
      await db.query(`update kti_courses set status = 'inactive' where id = $1`, [id])
      expect(await errorOf(() => submit(db, payload(id, {
        personal_info: { first_name: 'B', last_name: 'C', id_number: '9001015009087' },
      })))).toMatch(/COURSE_CLOSED/)
      await asUser(db, admissions)
      expect((await db.query('select id from applications where id = $1', [first.id])).rows).toHaveLength(1)
    })

    it('requires a valid open intake when the course has open intakes', async () => {
      const id = await makeCourse(db, courseAdmin)
      const other = await makeCourse(db, courseAdmin)
      await asUser(db, courseAdmin)
      const open = (await db.query<{ id: string }>(
        `insert into intakes (course_id, name, status) values ($1, 'Jan 2027', 'open') returning id`, [id],
      )).rows[0].id
      const closed = (await db.query<{ id: string }>(
        `insert into intakes (course_id, name, status) values ($1, 'Jul 2026', 'closed') returning id`, [id],
      )).rows[0].id
      const foreign = (await db.query<{ id: string }>(
        `insert into intakes (course_id, name, status) values ($1, 'Other', 'open') returning id`, [other],
      )).rows[0].id
      const expired = (await db.query<{ id: string }>(
        `insert into intakes (course_id, name, status, applications_close_at)
         values ($1, 'Expired', 'open', now() - interval '1 day') returning id`, [id],
      )).rows[0].id

      expect(await errorOf(() => submit(db, payload(id)))).toMatch(/INTAKE_REQUIRED/)
      for (const intake of [closed, foreign, expired]) {
        expect(await errorOf(() => submit(db, payload(id, { intake_id: intake })))).toMatch(/INTAKE_CLOSED/)
      }
      const app = await submit(db, payload(id, { intake_id: open }))
      expect(app.id).toBeTruthy()
    })

    it('validates the study mode against the course', async () => {
      const id = await makeCourse(db, courseAdmin, { study_modes: ['online', 'blended'] })
      expect(await errorOf(() => submit(db, payload(id)))).toMatch(/STUDY_MODE_INVALID/)
      expect(await errorOf(() => submit(db, payload(id, { study_mode: 'in_person' })))).toMatch(/STUDY_MODE_INVALID/)
      expect((await submit(db, payload(id, { study_mode: 'online' }))).id).toBeTruthy()
    })

    it('prevents duplicate live applications for the same person and course', async () => {
      const id = await makeCourse(db, courseAdmin)
      const first = await submit(db, payload(id))
      expect(await errorOf(() => submit(db, payload(id)))).toMatch(/DUPLICATE_APPLICATION/)
      await asUser(db, admissions)
      await db.query(`update applications set status = 'withdrawn' where id = $1`, [first.id])
      expect((await submit(db, payload(id))).id).toBeTruthy()
    })

    it('only accepts documents the server uploaded into this draft folder', async () => {
      const id = await makeCourse(db, courseAdmin)
      const good = `applications/${DRAFT}/id_document-1.pdf`
      const otherDraft = 'applications/99999999-2222-3333-4444-555555555555/id_document-1.pdf'
      await asSuperuser(db)
      await db.query(`insert into storage.objects (bucket_id, name) values ('application-documents', $1), ('application-documents', $2)`, [good, otherDraft])

      expect(await errorOf(() => submit(db, payload(id, { documents: [{ type: 'id_document', path: otherDraft }] }))))
        .toMatch(/DOCUMENTS_INVALID/)
      expect(await errorOf(() => submit(db, payload(id, { documents: [{ type: 'id_document', path: `applications/${DRAFT}/missing.pdf` }] }))))
        .toMatch(/DOCUMENTS_INVALID/)
      expect((await submit(db, payload(id, { documents: [{ type: 'id_document', path: good }] }))).id).toBeTruthy()
    })

    it('honours the published form open/close settings', async () => {
      const id = await makeCourse(db, courseAdmin)
      await asUser(db, superAdmin)
      await db.query(`insert into form_versions (status, config) values ('draft', '{"settings": {"applications_open": false}}')`)
      await db.query('select publish_form_draft()')
      expect(await errorOf(() => submit(db, payload(id)))).toMatch(/APPLICATIONS_CLOSED/)

      await asUser(db, superAdmin)
      await db.query(`insert into form_versions (status, config) values ('draft', $1)`, [JSON.stringify({
        settings: { applications_open: true, closes_at: new Date(Date.now() - 1000).toISOString() },
      })])
      await db.query('select publish_form_draft()')
      expect(await errorOf(() => submit(db, payload(id)))).toMatch(/APPLICATIONS_CLOSED/)

      await asUser(db, superAdmin)
      await db.query(`insert into form_versions (status, config) values ('draft', '{"settings": {"applications_open": true, "closes_at": ""}}')`)
      const published = (await db.query<{ id: string }>('select publish_form_draft() id')).rows[0].id
      const app = await submit(db, payload(id))
      await asUser(db, readOnly)
      const { rows } = await db.query<{ form_version_id: string }>('select form_version_id from applications where id = $1', [app.id])
      expect(rows[0].form_version_id).toBe(published)
      const versions = await db.query<{ status: string }>('select status from form_versions order by created_at')
      expect(versions.rows.filter((v) => v.status === 'published')).toHaveLength(1)
    })
  })

  // ── Review workflow ───────────────────────────────────────────

  describe('review workflow', () => {
    it('logs a status change once, and nothing when the status is saved unchanged', async () => {
      const id = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, admissions)
      await db.query(`update applications set status = 'under_review' where id = $1`, [app.id])
      await db.query(`update applications set status = 'under_review' where id = $1`, [app.id])
      const { rows } = await db.query<{ from_status: string; to_status: string; actor_email: string }>(
        `select from_status, to_status, actor_email from application_events where application_id = $1 and event_type = 'status_changed'`,
        [app.id],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ from_status: 'submitted', to_status: 'under_review' })
      expect(rows[0].actor_email).toMatch(/@example\.com/)
    })

    it('records edits to applicant details with before/after values', async () => {
      const id = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, admissions)
      await db.query(
        `update applications set contact_details = contact_details || '{"phone": "0110000000"}' where id = $1`, [app.id],
      )
      const { rows } = await db.query<{ details: { contact_details: { from: { phone: string }; to: { phone: string } } } }>(
        `select details from application_events where application_id = $1 and event_type = 'record_edited'`, [app.id],
      )
      expect(rows[0].details.contact_details.from.phone).toBe('0824451290')
      expect(rows[0].details.contact_details.to.phone).toBe('0110000000')
    })

    it('approval creates an active student; reversing it deactivates them', async () => {
      const id = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, admissions)
      await db.query(`update applications set status = 'approved' where id = $1`, [app.id])
      let student = (await db.query<{ status: string; course_id: string; email: string }>(
        'select status, course_id, email from students where application_id = $1', [app.id],
      )).rows[0]
      expect(student).toMatchObject({ status: 'active', course_id: id, email: 'grace@example.com' })

      await db.query(`update applications set status = 'withdrawn' where id = $1`, [app.id])
      student = (await db.query<{ status: string; course_id: string; email: string }>(
        'select status, course_id, email from students where application_id = $1', [app.id],
      )).rows[0]
      expect(student.status).toBe('inactive')

      await db.query(`update applications set status = 'approved' where id = $1`, [app.id])
      expect((await db.query('select * from students where application_id = $1', [app.id])).rows).toHaveLength(1)
    })

    it('enforces course capacity on acceptance', async () => {
      const id = await makeCourse(db, courseAdmin, { capacity: 1 })
      const a = await submit(db, payload(id))
      const b = await submit(db, payload(id, { personal_info: { first_name: 'B', last_name: 'B', id_number: '2' } }))
      await asUser(db, admissions)
      await db.query(`update applications set status = 'approved' where id = $1`, [a.id])
      expect(await errorOf(() => db.query(`update applications set status = 'approved' where id = $1`, [b.id])))
        .toMatch(/COURSE_FULL/)
      await db.query(`update applications set status = 'waitlisted' where id = $1`, [b.id])
    })

    it('reference number, submission date and course are immutable', async () => {
      const id = await makeCourse(db, courseAdmin)
      const other = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, superAdmin)
      for (const sql of [
        `update applications set student_number = 'X' where id = $1`,
        `update applications set submitted_at = now() - interval '1 year' where id = $1`,
        `update applications set course_id = '${other}' where id = $1`,
      ]) {
        expect(await errorOf(() => db.query(sql, [app.id]))).toMatch(/IMMUTABLE_FIELD/)
      }
    })
  })

  // ── Overview, logging, messages ───────────────────────────────

  describe('overview and logging', () => {
    it('course_overview shows current price and counts to staff only', async () => {
      const id = await makeCourse(db, courseAdmin, { name: 'Overview course' })
      await addPrice(db, courseAdmin, id, 900)
      const app = await submit(db, payload(id))
      await asUser(db, admissions)
      await db.query(`update applications set status = 'approved' where id = $1`, [app.id])
      await submit(db, payload(id, { personal_info: { first_name: 'Z', last_name: 'Z', id_number: '3' } }))

      await asUser(db, readOnly)
      const row = (await db.query<{ current_price: { total: number }; application_count: string; enrolled_count: string; pending_count: string }>(
        'select current_price, application_count, enrolled_count, pending_count from course_overview where id = $1', [id],
      )).rows[0]
      expect(Number(row.current_price.total)).toBe(900)
      expect(Number(row.application_count)).toBe(2)
      expect(Number(row.enrolled_count)).toBe(1)
      expect(Number(row.pending_count)).toBe(1)

      for (const who of [outsider]) {
        await asUser(db, who)
        expect((await db.query('select * from course_overview')).rows).toHaveLength(0)
      }
      await asAnon(db)
      expect(await errorOf(() => db.query('select * from course_overview'))).toMatch(/permission denied/)
      expect(await errorOf(() => db.query('select * from application_financials'))).toMatch(/permission denied/)
    })

    it('log_admin_action records the acting staff member and rejects non-staff', async () => {
      await asUser(db, admissions)
      await db.query(`select log_admin_action('export', 'applications', '{"rows": 3}')`)
      await asUser(db, outsider)
      expect(await errorOf(() => db.query(`select log_admin_action('export', 'applications', null)`))).toMatch(/FORBIDDEN/)
      await asAnon(db)
      expect(await errorOf(() => db.query(`select log_admin_action('export', 'applications', null)`))).toMatch(/permission denied/)
      await asUser(db, superAdmin)
      const { rows } = await db.query<{ actor_email: string; action: string }>(`select actor_email, action from audit_log where entity_type = 'applications'`)
      expect(rows).toHaveLength(1)
      expect(rows[0].action).toBe('export')
    })

    it('prepared WhatsApp messages appear in the application history as not tracked', async () => {
      const id = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, readOnly)
      expect(await errorOf(() => db.query(
        `insert into whatsapp_logs (application_id, applicant_name, whatsapp_number, message_body, sent_by) values ($1, 'G', '27', 'hi', 'x')`, [app.id],
      ))).toMatch(/row-level security/)
      await asUser(db, admissions)
      await db.query(
        `insert into whatsapp_logs (application_id, applicant_name, whatsapp_number, message_body, sent_by, template_name) values ($1, 'G', '27', 'hi', 'x', 'Approved')`,
        [app.id],
      )
      const ev = (await db.query<{ details: { delivery_status: string; template: string } }>(
        `select details from application_events where application_id = $1 and event_type = 'message_prepared'`, [app.id],
      )).rows
      expect(ev).toHaveLength(1)
      expect(ev[0].details).toMatchObject({ delivery_status: 'not_tracked', template: 'Approved' })
    })

    it('archiving hides nothing from history and is reversible', async () => {
      const id = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, admissions)
      await db.query(`update applications set archived_at = now(), archive_reason = 'Duplicate' where id = $1`, [app.id])
      await db.query(`update applications set archived_at = null where id = $1`, [app.id])
      const types = (await db.query<{ event_type: string }>(
        'select event_type from application_events where application_id = $1 order by created_at', [app.id],
      )).rows.map((r) => r.event_type)
      expect(types).toEqual(['submitted', 'archived', 'restored'])
    })
  })

  // ── Payments ──────────────────────────────────────────────────

  describe('payments', () => {
    it('derives payment status and balance from recorded payments', async () => {
      const id = await makeCourse(db, courseAdmin)
      await addPrice(db, courseAdmin, id, 1000)
      const app = await submit(db, payload(id))
      const status = async () => {
        await asUser(db, readOnly)
        return (await db.query<{ payment_status: string; net_paid: string }>(
          'select payment_status, net_paid from application_financials where application_id = $1', [app.id],
        )).rows[0]
      }
      expect((await status()).payment_status).toBe('unpaid')

      await asUser(db, finance)
      await db.query(`insert into payments (application_id, kind, amount, method, recorded_by) values ($1, 'payment', 400, 'eft', $2)`, [app.id, finance])
      expect((await status()).payment_status).toBe('partially_paid')

      await asUser(db, finance)
      const p2 = (await db.query<{ id: string }>(
        `insert into payments (application_id, kind, amount, method, recorded_by) values ($1, 'payment', 600, 'cash', $2) returning id`,
        [app.id, finance],
      )).rows[0].id
      expect((await status()).payment_status).toBe('paid')

      await asUser(db, finance)
      await db.query(`update payments set voided_at = now(), voided_by = $2, void_reason = 'Duplicate' where id = $1`, [p2, finance])
      expect(await status()).toMatchObject({ payment_status: 'partially_paid', net_paid: '400.00' })

      await asUser(db, finance)
      await db.query(`insert into payments (application_id, kind, amount, method, recorded_by) values ($1, 'refund', 400, 'eft', $2)`, [app.id, finance])
      expect((await status()).payment_status).toBe('refunded')
    })

    it('payments cannot be edited or deleted, only voided with a reason', async () => {
      const id = await makeCourse(db, courseAdmin)
      const app = await submit(db, payload(id))
      await asUser(db, finance)
      const pid = (await db.query<{ id: string }>(
        `insert into payments (application_id, kind, amount, method, recorded_by) values ($1, 'payment', 100, 'eft', $2) returning id`,
        [app.id, finance],
      )).rows[0].id
      expect(await errorOf(() => db.query('update payments set amount = 1 where id = $1', [pid]))).toMatch(/PAYMENT_IMMUTABLE/)
      expect(await errorOf(() => db.query('update payments set voided_at = now() where id = $1', [pid]))).toMatch(/PAYMENT_IMMUTABLE/)
      await asUser(db, superAdmin)
      expect((await db.query('delete from payments where id = $1 returning id', [pid])).rows).toHaveLength(0)
      await asSuperuser(db)
      expect(await errorOf(() => db.query('delete from payments where id = $1', [pid]))).toMatch(/PAYMENT_IMMUTABLE/)
    })
  })

  // ── Reports ───────────────────────────────────────────────────

  describe('reports', () => {
    it('summarise real records and respect permissions', async () => {
      const a = await makeCourse(db, courseAdmin, { name: 'Course A' })
      const b = await makeCourse(db, courseAdmin, { name: 'Course B' })
      await addPrice(db, courseAdmin, a, 1000)
      const x = await submit(db, payload(a))
      await submit(db, payload(a, { personal_info: { first_name: 'Y', last_name: 'Y', id_number: '2' } }))
      await submit(db, payload(b))
      await asUser(db, admissions)
      await db.query(`update applications set status = 'approved' where id = $1`, [x.id])

      await asUser(db, readOnly)
      const r = (await db.query<{ r: {
        total: number; by_status: Record<string, number>
        by_course: { course: string; total: number; approved: number }[]
        enrolments: { course: string; total: number }[]
        payments: { currency: string; due: number; outstanding: number }[]
      } }>('select admin_report() r')).rows[0].r
      expect(r.total).toBe(3)
      expect(r.by_status).toEqual({ submitted: 2, approved: 1 })
      expect(r.by_course.find((c) => c.course === 'Course A')).toMatchObject({ total: 2, approved: 1 })
      expect(r.enrolments).toEqual([{ course: 'Course A', intake: '—', total: 1 }])
      expect(Number(r.payments[0].due)).toBe(2000)

      await asUser(db, outsider)
      const empty = (await db.query<{ r: { total: number } }>('select admin_report() r')).rows[0].r
      expect(empty.total).toBe(0)
    })
  })
})

// ── Migration safety ────────────────────────────────────────────

describe('migrating an existing database', () => {
  it('stops without changing anything if a table name is taken by something else', async () => {
    const db = await createDb({ stopBefore: NEW_MIGRATION })
    await db.exec('create table payments (id serial primary key, total numeric)')
    expect(await errorOf(() => db.exec(readMigration(NEW_MIGRATION)))).toMatch(/public\.payments already exists/)
    await db.exec('rollback')
    expect((await db.query(`select to_regclass('public.kti_courses') t`)).rows[0]).toEqual({ t: null })
    expect((await db.query(`select to_regclass('public.staff_users') t`)).rows[0]).toEqual({ t: null })
  })

  it('preserves existing applications and links them to the seeded courses', async () => {
    const db = await createDb({ stopBefore: NEW_MIGRATION })
    await db.query(`
      insert into applications (programme, personal_info, contact_details, status)
      values ('Peace Building', '{"first_name": "Old", "last_name": "Applicant", "id_number": "1"}', '{"phone": "0820000000"}', 'approved'),
             ('Some Retired Course', '{"first_name": "Older", "last_name": "Applicant"}', '{}', 'rejected'),
             (null, '{"first_name": "No", "last_name": "Course"}', '{}', 'submitted')
    `)
    const before = (await db.query('select id, student_number, personal_info, status from applications order by id')).rows

    await db.exec(readMigration(NEW_MIGRATION))
    await db.exec(readMigration(NEW_MIGRATION)) // idempotent

    const after = (await db.query<{ id: string; student_number: string; personal_info: unknown; status: string; programme: string | null; course_id: string | null; course_name: string | null; course_status: string | null }>(
      `select a.id, a.student_number, a.personal_info, a.status, a.programme, a.course_id,
              c.name course_name, c.status course_status
         from applications a left join kti_courses c on c.id = a.course_id order by a.id`,
    )).rows
    expect(after.map(({ id, student_number, personal_info, status }) => ({ id, student_number, personal_info, status })))
      .toEqual(before)

    const byProgramme = Object.fromEntries(after.map((r) => [r.programme ?? 'null', r]))
    expect(byProgramme['Peace Building']).toMatchObject({ course_name: 'Peace Building', course_status: 'active' })
    expect(byProgramme['Some Retired Course']).toMatchObject({ course_name: 'Some Retired Course', course_status: 'inactive' })
    expect(byProgramme['null'].course_id).toBeNull()

    // No prices are invented for migrated kti_courses.
    expect((await db.query('select * from course_prices')).rows).toHaveLength(0)
    // Migration itself doesn't generate fake history.
    expect((await db.query(`select * from application_events where event_type <> 'submitted'`)).rows).toHaveLength(0)
  })
})
