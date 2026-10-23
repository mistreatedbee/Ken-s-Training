import { beforeEach, describe, expect, it } from 'vitest'
import { asAnon, asService, asSuperuser, asUser, createDb, createUser, errorOf, readMigration, type Db } from './harness'

describe('website content and student management', () => {
  let db: Db
  let superAdmin: string
  let admissions: string
  let readOnly: string
  let outsider: string

  beforeEach(async () => {
    db = await createDb()
    superAdmin = await createUser(db, 'super_admin')
    admissions = await createUser(db, 'admissions')
    readOnly = await createUser(db, 'read_only')
    outsider = await createUser(db)
  })

  describe('website content', () => {
    it('is readable by the public', async () => {
      await asAnon(db)
      const { rows } = await db.query('select id from kti_site_content')
      expect(rows).toEqual([{ id: 'site' }])
    })

    it('can only be changed by a super admin, and changes are audited', async () => {
      for (const who of [admissions, readOnly, outsider]) {
        await asUser(db, who)
        const res = await db.query(`update kti_site_content set content = '{"hero": {"badge": "hacked"}}' returning id`)
        expect(res.rows).toHaveLength(0)
      }
      await asAnon(db)
      expect(await errorOf(() => db.query(`update kti_site_content set content = '{}'`))).toMatch(/permission denied/)

      await asUser(db, superAdmin)
      const res = await db.query(`update kti_site_content set content = '{"hero": {"badge": "Now enrolling"}}' returning id`)
      expect(res.rows).toHaveLength(1)
      const audit = await db.query<{ action: string }>(`select action from audit_log where entity_type = 'kti_site_content'`)
      expect(audit.rows.map((r) => r.action)).toEqual(['update'])
    })

    it('cannot get a second row or be deleted', async () => {
      await asUser(db, superAdmin)
      expect(await errorOf(() => db.query(`insert into kti_site_content (id) values ('other')`))).toBeTruthy()
      expect((await db.query('delete from kti_site_content returning id')).rows).toHaveLength(0)
    })
  })

  describe('students', () => {
    async function addManual(who: string, name = 'Manual Student') {
      await asUser(db, who)
      const num = (await db.query<{ n: string }>('select kti_next_student_number() n')).rows[0].n
      const row = (await db.query<{ id: string }>(
        `insert into students (student_number, full_name, phone, status) values ($1, $2, '0820000000', 'active') returning id`,
        [num, name],
      )).rows[0]
      return { id: row.id, num }
    }

    it('admissions can add students by hand with a unique student number', async () => {
      const a = await addManual(admissions)
      const b = await addManual(superAdmin, 'Second')
      expect(a.num).toMatch(/^KTI-\d{4}-\d{4}$/)
      expect(b.num).not.toBe(a.num)
    })

    it('numbers for hand-added students never clash with online applications', async () => {
      await asSuperuser(db)
      const app = (await db.query<{ student_number: string }>(
        `insert into applications (personal_info, status) values ('{"first_name": "A"}', 'submitted') returning student_number`,
      )).rows[0]
      const manual = await addManual(admissions)
      expect(manual.num).not.toBe(app.student_number)
    })

    it('read-only staff and outsiders cannot add students or get numbers', async () => {
      for (const who of [readOnly, outsider]) {
        await asUser(db, who)
        expect(await errorOf(() => db.query('select kti_next_student_number()'))).toMatch(/FORBIDDEN/)
        expect(await errorOf(() => db.query(
          `insert into students (student_number, full_name, phone) values ('X-1', 'X', '0')`,
        ))).toMatch(/row-level security/)
      }
      await asAnon(db)
      expect(await errorOf(() => db.query('select kti_next_student_number()'))).toMatch(/permission denied/)
    })

    it('supports the completed status and notes; edits are audited', async () => {
      const s = await addManual(admissions)
      await asUser(db, admissions)
      await db.query(`update students set status = 'completed', notes = 'Graduated Nov 2026' where id = $1`, [s.id])
      expect(await errorOf(() => db.query(`update students set status = 'expelled' where id = $1`, [s.id]))).toMatch(/check constraint/)
      await asUser(db, superAdmin)
      const audit = await db.query<{ action: string }>(
        `select action from audit_log where entity_type = 'students' and entity_id = $1 order by created_at`, [s.id],
      )
      expect(audit.rows.map((r) => r.action)).toEqual(['insert', 'update'])
    })

    it('only hand-added students can be removed; online applicants are kept', async () => {
      const manual = await addManual(admissions)
      await asSuperuser(db)
      const app = (await db.query<{ id: string }>(
        `insert into applications (personal_info, contact_details, status) values ('{"first_name": "On", "last_name": "Line"}', '{"phone": "0821111111"}', 'submitted') returning id`,
      )).rows[0]
      await db.query(`update applications set status = 'approved' where id = $1`, [app.id])

      await asUser(db, admissions)
      const del = await db.query('delete from students where application_id = $1 returning id', [app.id])
      expect(del.rows).toHaveLength(0)
      expect((await db.query('delete from students where id = $1 returning id', [manual.id])).rows).toHaveLength(1)

      await asUser(db, readOnly)
      expect((await db.query('select id from students')).rows).toHaveLength(1)
    })
  })

  it('migration is safe to run twice', async () => {
    await asSuperuser(db)
    await db.exec(readMigration('20261023_site_content_and_students.sql'))
    await asService(db)
    expect((await db.query('select count(*)::int n from kti_site_content')).rows[0]).toEqual({ n: 1 })
  })
})
