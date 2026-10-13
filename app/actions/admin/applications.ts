'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, friendlyDbError, requireStaffAction, type ActionResult } from '@/lib/auth'
import { CORE_FIELDS, normalizeConfig, validateField, type FieldConfig } from '@/lib/form-config'
import { REASON_REQUIRED, STATUS_META, isApplicationStatus, type ApplicationStatus } from '@/lib/statuses'

const UUID = /^[0-9a-f-]{36}$/

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message }
  console.error('[admin/applications]', err)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

function refresh(id: string) {
  revalidatePath(`/admin/applications/${id}`)
  revalidatePath('/admin/applications')
  revalidatePath('/admin')
  revalidatePath('/admin/students')
}

/**
 * Change an application's status. Saving the same status again is a
 * no-op (`changed: false`) so no duplicate history or notification.
 */
export async function updateApplicationStatus(
  id: string,
  status: string,
  reason?: string,
): Promise<ActionResult<{ changed: boolean; status: ApplicationStatus }>> {
  try {
    await requireStaffAction('applications.update')
    if (!UUID.test(id) || !isApplicationStatus(status)) return { ok: false, error: 'Invalid request.' }
    const why = reason?.trim().slice(0, 2000) ?? ''
    if (REASON_REQUIRED.includes(status) && !why) {
      return { ok: false, error: `Please give a reason for "${STATUS_META[status].label}".` }
    }

    const supabase = await createClient()
    const { data: current, error: readErr } = await supabase
      .from('applications').select('status').eq('id', id).single()
    if (readErr || !current) return { ok: false, error: 'Application not found.' }
    if (current.status === status) return { ok: true, data: { changed: false, status } }

    const patch: Record<string, unknown> = { status }
    if (status === 'rejected') patch.rejection_reason = why

    const { data: updated, error } = await supabase
      .from('applications').update(patch).eq('id', id).eq('status', current.status).select('id')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    if (!updated?.length) {
      return { ok: false, error: 'This application was changed by someone else. Please refresh and try again.' }
    }

    if (why) {
      const staff = await requireStaffAction()
      await supabase.from('application_notes').insert({
        application_id: id,
        body: `${STATUS_META[status].label}: ${why}`,
        author_id: staff.userId,
        author_email: staff.email,
      })
    }

    refresh(id)
    return { ok: true, data: { changed: true, status } }
  } catch (err) {
    return fail(err)
  }
}

export async function addApplicationNote(id: string, body: string): Promise<ActionResult> {
  try {
    const staff = await requireStaffAction('applications.update')
    const text = body.trim()
    if (!UUID.test(id) || !text) return { ok: false, error: 'Please write a note first.' }
    if (text.length > 5000) return { ok: false, error: 'Notes must be under 5000 characters.' }
    const supabase = await createClient()
    const { error } = await supabase.from('application_notes').insert({
      application_id: id, body: text, author_id: staff.userId, author_email: staff.email,
    })
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refresh(id)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function archiveApplication(id: string, reason: string): Promise<ActionResult> {
  try {
    const staff = await requireStaffAction('applications.update')
    if (!UUID.test(id)) return { ok: false, error: 'Invalid request.' }
    const supabase = await createClient()
    const { error } = await supabase.from('applications').update({
      archived_at: new Date().toISOString(),
      archived_by: staff.userId,
      archive_reason: reason.trim().slice(0, 1000) || null,
    }).eq('id', id).is('archived_at', null)
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refresh(id)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function restoreApplication(id: string): Promise<ActionResult> {
  try {
    await requireStaffAction('applications.update')
    if (!UUID.test(id)) return { ok: false, error: 'Invalid request.' }
    const supabase = await createClient()
    const { error } = await supabase.from('applications')
      .update({ archived_at: null, archived_by: null, archive_reason: null }).eq('id', id)
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refresh(id)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

type Column = 'personal_info' | 'contact_details' | 'next_of_kin' | 'education' | 'personal_statement'

/**
 * Edit applicant details. Values are validated against the field
 * definitions (type/format/options) and merged into the existing JSONB
 * so fields not shown in the editor are preserved. Every change is
 * recorded with before/after values by a database trigger.
 */
export async function updateApplicantDetails(
  id: string,
  values: Record<string, string | boolean | null>,
): Promise<{ ok: true } | { ok: false; error: string; errors?: Record<string, string> }> {
  try {
    await requireStaffAction('applications.update')
    if (!UUID.test(id)) return { ok: false, error: 'Invalid request.' }
    const supabase = await createClient()

    const [{ data: app, error: readErr }, { data: version }] = await Promise.all([
      supabase.from('applications')
        .select('personal_info, contact_details, next_of_kin, education, personal_statement, custom_answers')
        .eq('id', id).single(),
      supabase.from('form_versions').select('config').eq('status', 'published').maybeSingle(),
    ])
    if (readErr || !app) return { ok: false, error: 'Application not found.' }

    const config = normalizeConfig(version?.config)
    const fields = new Map<string, FieldConfig>(config.steps.flatMap((s) => s.fields).map((f) => [f.key, f]))

    const patch: Record<string, Record<string, unknown>> = {}
    const errors: Record<string, string> = {}
    for (const [key, raw] of Object.entries(values)) {
      const field = fields.get(key)
      if (!field) continue
      const value = typeof raw === 'string' ? raw.trim() : raw
      // Admins may leave optional-at-the-time fields empty, but locked fields stay required.
      const err = validateField({ ...field, required: !!CORE_FIELDS[key]?.locked }, value)
      if (err) { errors[key] = err; continue }
      const core = CORE_FIELDS[key]
      const column: Column | 'custom_answers' = core ? core.column : 'custom_answers'
      patch[column] ??= { ...((app as Record<string, unknown>)[column] as Record<string, unknown> ?? {}) }
      patch[column][core?.dbKey ?? key] = value === '' ? null : value
    }
    if (Object.keys(errors).length) {
      return { ok: false, error: 'Some values are not valid. Please check the highlighted fields.', errors }
    }
    if (Object.keys(patch).length === 0) return { ok: true }

    const { error } = await supabase.from('applications').update(patch).eq('id', id)
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    refresh(id)
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Short-lived signed link to a document. Access checked by storage RLS (staff only). */
export async function getDocumentLink(path: string): Promise<ActionResult<{ url: string }>> {
  try {
    await requireStaffAction()
    if (typeof path !== 'string' || !path || path.includes('..')) return { ok: false, error: 'Invalid document.' }
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from('application-documents').createSignedUrl(path, 300)
    if (error || !data) return { ok: false, error: 'Could not open this document. It may have been removed.' }
    return { ok: true, data: { url: data.signedUrl } }
  } catch (err) {
    return fail(err)
  }
}
