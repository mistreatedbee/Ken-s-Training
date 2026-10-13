'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, friendlyDbError, requireStaffAction, type ActionResult } from '@/lib/auth'

const UUID = /^[0-9a-f-]{36}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MODES = ['online', 'in_person', 'blended']
const STATUSES = ['draft', 'active', 'inactive', 'archived']

type FieldErrors = Record<string, string>
type Result<T = undefined> = ActionResult<T> | { ok: false; error: string; errors?: FieldErrors }

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message }
  console.error('[admin/courses]', err)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

/** Public pages read courses live; refresh anything that shows them. */
function refreshCourses(id?: string) {
  revalidatePath('/apply')
  revalidatePath('/admin')
  revalidatePath('/admin/courses')
  if (id) revalidatePath(`/admin/courses/${id}`)
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}

export interface CourseInput {
  id?: string
  code: string
  name: string
  description: string
  category: string
  qualification_type: string
  duration: string
  requirements: string
  study_modes: string[]
  status: string
  accepting_applications: boolean
  application_deadline: string
  capacity: string
  sort_order: string
}

export async function saveCourse(input: CourseInput): Promise<Result<{ id: string }>> {
  try {
    await requireStaffAction('courses.manage')
    const errors: FieldErrors = {}
    const code = input.code.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code)) errors.code = 'Use 2–20 capital letters, numbers or dashes, e.g. KTI-017.'
    const name = input.name.trim()
    if (name.length < 2 || name.length > 200) errors.name = 'Enter a course name (2–200 characters).'
    if (!STATUSES.includes(input.status)) errors.status = 'Choose a status.'
    const modes = (input.study_modes ?? []).filter((m) => MODES.includes(m))
    if (input.application_deadline && !DATE.test(input.application_deadline)) errors.application_deadline = 'Enter a valid date.'
    let capacity: number | null = null
    if (input.capacity.trim()) {
      capacity = Number(input.capacity)
      if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Capacity must be a whole number of 1 or more (or leave blank).'
    }
    const sort = input.sort_order.trim() ? Number(input.sort_order) : 0
    if (!Number.isInteger(sort)) errors.sort_order = 'Display order must be a whole number.'
    if (Object.keys(errors).length) return { ok: false, error: 'Please fix the highlighted fields.', errors }

    const row = {
      code,
      name,
      description: text(input.description, 5000),
      category: text(input.category, 120),
      qualification_type: text(input.qualification_type, 120),
      duration: text(input.duration, 120),
      requirements: text(input.requirements, 5000),
      study_modes: modes,
      status: input.status,
      accepting_applications: !!input.accepting_applications,
      application_deadline: input.application_deadline || null,
      capacity,
      sort_order: sort,
    }

    const supabase = await createClient()
    if (input.id) {
      if (!UUID.test(input.id)) return { ok: false, error: 'Invalid course.' }
      const { data, error } = await supabase.from('kti_courses').update(row).eq('id', input.id).select('id')
      if (error) return { ok: false, error: friendlyDbError(error.message) }
      if (!data?.length) return { ok: false, error: 'Course not found, or you do not have permission to edit it.' }
      refreshCourses(input.id)
      return { ok: true, data: { id: input.id } }
    }
    const { data, error } = await supabase.from('kti_courses').insert(row).select('id').single()
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refreshCourses(data.id)
    return { ok: true, data: { id: data.id } }
  } catch (err) {
    return fail(err)
  }
}

/** Quick status change (activate / deactivate / archive) from the course list or page. */
export async function setCourseStatus(id: string, status: string): Promise<ActionResult> {
  try {
    await requireStaffAction('courses.manage')
    if (!UUID.test(id) || !STATUSES.includes(status)) return { ok: false, error: 'Invalid request.' }
    const supabase = await createClient()
    const { error } = await supabase.from('kti_courses').update({ status }).eq('id', id)
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refreshCourses(id)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Only drafts without applications can be deleted; everything else is archived. */
export async function deleteDraftCourse(id: string): Promise<ActionResult> {
  try {
    await requireStaffAction('courses.manage')
    if (!UUID.test(id)) return { ok: false, error: 'Invalid request.' }
    const supabase = await createClient()
    const { count } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('course_id', id)
    if ((count ?? 0) > 0) return { ok: false, error: 'This course has applications, so it can only be archived.' }
    const { data, error } = await supabase.from('kti_courses').delete().eq('id', id).eq('status', 'draft').select('id')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    if (!data?.length) return { ok: false, error: 'Only draft courses can be deleted. Archive this course instead.' }
    refreshCourses()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export interface PriceInput {
  courseId: string
  currency: string
  tuition_fee: string
  registration_fee: string
  other_fees: { label: string; amount: string }[]
  discount_amount: string
  discount_label: string
  discount_ends_at: string
  effective_from: string // '' = immediately
  note: string
}

function money(v: string, field: string, errors: FieldErrors, allowEmpty = true): number {
  if (!v.trim()) {
    if (!allowEmpty) errors[field] = 'Required.'
    return 0
  }
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000 || Math.round(n * 100) !== n * 100) {
    errors[field] = 'Enter an amount of 0 or more, with at most two decimals.'
    return 0
  }
  return n
}

/** Add a new price. Prices are never edited, so history is preserved. */
export async function addCoursePrice(input: PriceInput): Promise<Result> {
  try {
    const staff = await requireStaffAction('courses.manage')
    if (!UUID.test(input.courseId)) return { ok: false, error: 'Invalid course.' }
    const errors: FieldErrors = {}
    const currency = input.currency.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) errors.currency = 'Use a 3-letter currency code, e.g. ZAR.'
    const tuition = money(input.tuition_fee, 'tuition_fee', errors, false)
    const registration = money(input.registration_fee, 'registration_fee', errors)
    const discount = money(input.discount_amount, 'discount_amount', errors)
    if (discount > tuition) errors.discount_amount = 'The discount cannot be more than the course fee.'

    const otherFees: { label: string; amount: number }[] = []
    for (const [i, f] of (input.other_fees ?? []).entries()) {
      if (!f.label.trim() && !f.amount.trim()) continue
      if (!f.label.trim()) { errors[`other_${i}`] = 'Give this fee a name.'; continue }
      const amount = money(f.amount, `other_${i}`, errors, false)
      otherFees.push({ label: f.label.trim().slice(0, 80), amount })
    }
    if (otherFees.length > 10) errors.other_fees = 'At most 10 additional fees.'

    let effective: string | null = null
    if (input.effective_from) {
      const d = new Date(input.effective_from)
      if (Number.isNaN(d.getTime())) errors.effective_from = 'Enter a valid date and time.'
      else if (d.getTime() < Date.now() - 60_000) errors.effective_from = 'Choose a future time, or leave blank to apply immediately.'
      else effective = d.toISOString()
    }
    let discountEnds: string | null = null
    if (discount > 0 && input.discount_ends_at) {
      const d = new Date(input.discount_ends_at)
      if (Number.isNaN(d.getTime())) errors.discount_ends_at = 'Enter a valid date.'
      else discountEnds = d.toISOString()
    }
    if (Object.keys(errors).length) return { ok: false, error: 'Please fix the highlighted fields.', errors }

    const supabase = await createClient()
    const { error } = await supabase.from('course_prices').insert({
      course_id: input.courseId,
      currency,
      tuition_fee: tuition,
      registration_fee: registration,
      other_fees: otherFees,
      discount_amount: discount,
      discount_label: discount > 0 ? text(input.discount_label, 120) : null,
      discount_ends_at: discountEnds,
      effective_from: effective ?? new Date().toISOString(),
      note: text(input.note, 1000),
      created_by: staff.userId,
    })
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refreshCourses(input.courseId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteScheduledPrice(priceId: string, courseId: string): Promise<ActionResult> {
  try {
    await requireStaffAction('courses.manage')
    if (!UUID.test(priceId)) return { ok: false, error: 'Invalid request.' }
    const supabase = await createClient()
    const { error } = await supabase.from('course_prices').delete().eq('id', priceId).gt('effective_from', new Date().toISOString())
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refreshCourses(courseId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export interface IntakeInput {
  id?: string
  courseId: string
  name: string
  starts_on: string
  ends_on: string
  applications_open_at: string
  applications_close_at: string
  capacity: string
  status: string
}

export async function saveIntake(input: IntakeInput): Promise<Result> {
  try {
    await requireStaffAction('courses.manage')
    if (!UUID.test(input.courseId)) return { ok: false, error: 'Invalid course.' }
    const errors: FieldErrors = {}
    const name = input.name.trim()
    if (name.length < 2 || name.length > 120) errors.name = 'Enter a name, e.g. "January 2027".'
    if (!['planned', 'open', 'closed', 'archived'].includes(input.status)) errors.status = 'Choose a status.'
    for (const k of ['starts_on', 'ends_on'] as const) {
      if (input[k] && !DATE.test(input[k])) errors[k] = 'Enter a valid date.'
    }
    if (input.starts_on && input.ends_on && input.ends_on < input.starts_on) errors.ends_on = 'End date must be after the start date.'
    const ts = (v: string, k: string) => {
      if (!v) return null
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) { errors[k] = 'Enter a valid date and time.'; return null }
      return d.toISOString()
    }
    const openAt = ts(input.applications_open_at, 'applications_open_at')
    const closeAt = ts(input.applications_close_at, 'applications_close_at')
    if (openAt && closeAt && closeAt <= openAt) errors.applications_close_at = 'Closing must be after opening.'
    let capacity: number | null = null
    if (input.capacity.trim()) {
      capacity = Number(input.capacity)
      if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Whole number of 1 or more, or blank.'
    }
    if (Object.keys(errors).length) return { ok: false, error: 'Please fix the highlighted fields.', errors }

    const row = {
      course_id: input.courseId, name,
      starts_on: input.starts_on || null, ends_on: input.ends_on || null,
      applications_open_at: openAt, applications_close_at: closeAt,
      capacity, status: input.status,
    }
    const supabase = await createClient()
    const { error } = input.id
      ? await supabase.from('intakes').update(row).eq('id', input.id)
      : await supabase.from('intakes').insert(row)
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refreshCourses(input.courseId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteIntake(id: string, courseId: string): Promise<ActionResult> {
  try {
    await requireStaffAction('courses.manage')
    if (!UUID.test(id)) return { ok: false, error: 'Invalid request.' }
    const supabase = await createClient()
    const { error } = await supabase.from('intakes').delete().eq('id', id)
    if (error) {
      return {
        ok: false,
        error: /foreign key/.test(error.message)
          ? 'Applicants have chosen this intake, so it can only be closed or archived.'
          : friendlyDbError(error.message),
      }
    }
    refreshCourses(courseId)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
