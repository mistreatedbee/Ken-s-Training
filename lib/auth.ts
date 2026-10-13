import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, isRole, type Permission, type Role } from '@/lib/permissions'

export interface StaffSession {
  userId: string
  email: string
  fullName: string | null
  role: Role
}

/** The signed-in staff member, or null (not signed in / not staff / deactivated). */
export async function getStaff(): Promise<StaffSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('staff_users')
    .select('role, active, full_name, email')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!data || !data.active || !isRole(data.role)) return null
  return { userId: user.id, email: data.email ?? user.email ?? '', fullName: data.full_name, role: data.role }
}

/** For server components/pages: redirect away unless signed-in staff (with the permission, if given). */
export async function requireStaffPage(permission?: Permission): Promise<StaffSession> {
  const staff = await getStaff()
  if (!staff) redirect('/no-access')
  if (permission && !can(staff.role, permission)) redirect('/admin?denied=1')
  return staff
}

export class PermissionError extends Error {}

/** For server actions: throw unless signed-in staff with the permission. */
export async function requireStaffAction(permission?: Permission): Promise<StaffSession> {
  const staff = await getStaff()
  if (!staff) throw new PermissionError('You are not signed in as staff.')
  if (permission && !can(staff.role, permission)) {
    throw new PermissionError('You do not have permission to do that.')
  }
  return staff
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string }

/** Map Postgres / RLS errors raised by our triggers to admin-friendly messages. */
export function friendlyDbError(message: string | undefined): string {
  if (!message) return 'Something went wrong. Please try again.'
  const known: [RegExp, string][] = [
    [/COURSE_FULL: (.*)/, '$1'],
    [/INTAKE_FULL: (.*)/, '$1'],
    [/PRICE_IMMUTABLE: (.*)/, '$1'],
    [/PAYMENT_IMMUTABLE: (.*)/, '$1'],
    [/IMMUTABLE_FIELD: (.*)/, '$1'],
    [/LAST_SUPER_ADMIN: (.*)/, '$1'],
    [/NO_DRAFT: (.*)/, '$1'],
    [/FORBIDDEN: (.*)/, '$1'],
    [/row-level security/, 'You do not have permission to do that.'],
    [/permission denied/, 'You do not have permission to do that.'],
    [/duplicate key value violates unique constraint "kti_courses_code_key"/, 'Another course already uses that code.'],
    [/duplicate key value violates unique constraint "kti_courses_name_unique"/, 'Another course already has that name.'],
    [/duplicate key value violates unique constraint "intakes_course_id_name_key"/, 'This course already has an intake with that name.'],
    [/violates foreign key constraint/, 'This record is still in use and cannot be removed. Archive it instead.'],
    [/violates check constraint/, 'Some values are not valid. Please check the form.'],
  ]
  for (const [re, msg] of known) {
    const m = message.match(re)
    if (m) return msg.replace('$1', m[1] ?? '')
  }
  console.error('[db]', message)
  return 'Something went wrong. Please try again.'
}
