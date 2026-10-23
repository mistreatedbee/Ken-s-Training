'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, friendlyDbError, requireStaffAction } from '@/lib/auth'

export type StudentResult = { ok: true } | { ok: false; error: string; errors?: Record<string, string> }

export interface StudentInput {
  full_name: string
  phone: string
  email: string
  id_number: string
  course_id: string
  status: string
  joined_date: string
  notes: string
}

const UUID = /^[0-9a-f-]{36}$/
const STATUSES = ['active', 'inactive', 'suspended', 'completed']

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message }
  console.error('[admin/students]', err)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

async function validate(input: StudentInput) {
  const errors: Record<string, string> = {}
  const full_name = input.full_name.trim()
  if (full_name.length < 2 || full_name.length > 200) errors.full_name = 'Enter the student’s full name.'
  const phone = input.phone.trim()
  if (phone && (phone.replace(/\D/g, '').length < 9 || phone.length > 30)) errors.phone = 'Enter a valid phone number.'
  const email = input.email.trim().toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email address.'
  if (!STATUSES.includes(input.status)) errors.status = 'Choose a status.'
  if (input.joined_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.joined_date)) errors.joined_date = 'Enter a valid date.'
  if (input.course_id && !UUID.test(input.course_id)) errors.course_id = 'Choose a course.'
  if (input.notes.length > 5000) errors.notes = 'Notes must be under 5000 characters.'

  let programme: string | null = null
  if (input.course_id && !errors.course_id) {
    const supabase = await createClient()
    const { data } = await supabase.from('kti_courses').select('name').eq('id', input.course_id).maybeSingle()
    if (!data) errors.course_id = 'Choose a course.'
    else programme = data.name
  }
  return {
    errors,
    row: {
      full_name,
      phone: phone || null,
      email: email || null,
      id_number: input.id_number.trim().slice(0, 30) || null,
      course_id: input.course_id || null,
      programme,
      status: input.status,
      notes: input.notes.trim() || null,
      ...(input.joined_date ? { joined_date: input.joined_date } : {}),
    },
  }
}

function refresh() {
  revalidatePath('/admin/students')
  revalidatePath('/admin')
}

/** Add a student who didn't come through the online form. */
export async function addStudent(input: StudentInput): Promise<StudentResult> {
  try {
    await requireStaffAction('applications.update')
    const { errors, row } = await validate(input)
    if (Object.keys(errors).length) return { ok: false, error: 'Please fix the highlighted fields.', errors }
    const supabase = await createClient()
    const { data: number, error: numErr } = await supabase.rpc('kti_next_student_number')
    if (numErr || !number) return { ok: false, error: friendlyDbError(numErr?.message) }
    const { error } = await supabase.from('students').insert({ ...row, student_number: number as string })
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refresh()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function updateStudent(id: string, input: StudentInput): Promise<StudentResult> {
  try {
    await requireStaffAction('applications.update')
    if (!UUID.test(id)) return { ok: false, error: 'Invalid student.' }
    const { errors, row } = await validate(input)
    if (Object.keys(errors).length) return { ok: false, error: 'Please fix the highlighted fields.', errors }
    const supabase = await createClient()
    const { data, error } = await supabase.from('students').update(row).eq('id', id).select('id')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    if (!data?.length) return { ok: false, error: 'Student not found, or you don’t have permission to edit students.' }
    refresh()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Only students added by hand can be removed; others are set inactive instead. */
export async function removeStudent(id: string): Promise<StudentResult> {
  try {
    await requireStaffAction('applications.update')
    if (!UUID.test(id)) return { ok: false, error: 'Invalid student.' }
    const supabase = await createClient()
    const { data, error } = await supabase.from('students').delete().eq('id', id).is('application_id', null).select('id')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    if (!data?.length) {
      return { ok: false, error: 'Students who applied online can’t be deleted (their record is kept). Set them to Inactive instead.' }
    }
    refresh()
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
