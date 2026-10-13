'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'
import { PermissionError, friendlyDbError, requireStaffAction, type ActionResult } from '@/lib/auth'
import { isRole } from '@/lib/permissions'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UUID = /^[0-9a-f-]{36}$/

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message }
  console.error('[admin/staff]', err)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

function tempPassword() {
  return randomBytes(12).toString('base64url')
}

async function findUserByEmail(email: string) {
  const admin = createServiceClient()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
  return null
}

/**
 * Give someone a staff role. If they don't have an account yet, one is
 * created with a one-time temporary password that is shown once to the
 * super admin (no email provider is configured). The staff row itself is
 * written with the super admin's own session, so RLS still applies.
 */
export async function addStaffMember(input: { email: string; fullName: string; role: string }): Promise<ActionResult<{ tempPassword: string | null }>> {
  try {
    await requireStaffAction('staff.manage')
    const email = input.email.trim().toLowerCase()
    if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' }
    if (!isRole(input.role)) return { ok: false, error: 'Choose a role.' }

    let user = await findUserByEmail(email)
    let password: string | null = null
    if (!user) {
      password = tempPassword()
      const { data, error } = await createServiceClient().auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: input.fullName.trim() },
      })
      if (error || !data.user) return { ok: false, error: error?.message ?? 'Could not create the account.' }
      user = data.user
    }

    const supabase = await createClient()
    const { error } = await supabase.from('staff_users').upsert({
      user_id: user.id, email, full_name: input.fullName.trim().slice(0, 120) || null, role: input.role, active: true,
    })
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    revalidatePath('/admin/staff')
    return { ok: true, data: { tempPassword: password } }
  } catch (err) {
    return fail(err)
  }
}

export async function updateStaffMember(userId: string, patch: { role?: string; active?: boolean }): Promise<ActionResult> {
  try {
    await requireStaffAction('staff.manage')
    if (!UUID.test(userId)) return { ok: false, error: 'Invalid request.' }
    const row: Record<string, unknown> = {}
    if (patch.role !== undefined) {
      if (!isRole(patch.role)) return { ok: false, error: 'Choose a role.' }
      row.role = patch.role
    }
    if (patch.active !== undefined) row.active = !!patch.active
    const supabase = await createClient()
    const { error } = await supabase.from('staff_users').update(row).eq('user_id', userId)
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    revalidatePath('/admin/staff')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Set a new one-time password for a staff member who is locked out. */
export async function resetStaffPassword(userId: string): Promise<ActionResult<{ tempPassword: string }>> {
  try {
    const me = await requireStaffAction('staff.manage')
    if (!UUID.test(userId)) return { ok: false, error: 'Invalid request.' }
    if (userId === me.userId) return { ok: false, error: 'Change your own password from My account.' }
    const supabase = await createClient()
    const { data: target } = await supabase.from('staff_users').select('user_id').eq('user_id', userId).maybeSingle()
    if (!target) return { ok: false, error: 'Only staff accounts can be reset here.' }
    const password = tempPassword()
    const { error } = await createServiceClient().auth.admin.updateUserById(userId, { password })
    if (error) return { ok: false, error: error.message }
    await supabase.rpc('log_admin_action', { p_action: 'password_reset', p_entity_type: 'staff_users', p_details: { user_id: userId } })
    return { ok: true, data: { tempPassword: password } }
  } catch (err) {
    return fail(err)
  }
}
