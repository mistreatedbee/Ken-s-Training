'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { PermissionError, friendlyDbError, requireStaffAction } from '@/lib/auth'
import type { WhatsAppLog } from '@/lib/types'

const TRIGGERS = [
  'submission', 'under_review', 'info_requested', 'approved', 'waitlisted',
  'rejected', 'withdrawn', 'course_update', 'admission_instructions', 'manual',
]

type Result = { success: true } | { success: false; error: string }

function fail(err: unknown): { success: false; error: string } {
  if (err instanceof PermissionError) return { success: false, error: err.message }
  return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
}

export async function getWhatsAppTemplates() {
  await requireStaffAction()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .order('trigger_type')
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function saveWhatsAppTemplate(template: {
  id?: string
  name: string
  trigger_type: string
  body: string
  active: boolean
}): Promise<Result> {
  try {
    await requireStaffAction('templates.manage')
    const name = template.name.trim().slice(0, 120)
    const body = template.body.trim().slice(0, 4000)
    if (!name || !body) return { success: false, error: 'Name and message are required.' }
    if (!TRIGGERS.includes(template.trigger_type)) return { success: false, error: 'Invalid trigger.' }

    const supabase = await createClient()
    const row = { name, trigger_type: template.trigger_type, body, active: template.active }
    const { error } = template.id
      ? await supabase.from('whatsapp_templates').update(row).eq('id', template.id)
      : await supabase.from('whatsapp_templates').insert(row)
    if (error) return { success: false, error: friendlyDbError(error.message) }
    revalidatePath('/admin/whatsapp')
    return { success: true }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteWhatsAppTemplate(id: string): Promise<Result> {
  try {
    await requireStaffAction('templates.manage')
    const supabase = await createClient()
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id)
    if (error) return { success: false, error: friendlyDbError(error.message) }
    revalidatePath('/admin/whatsapp')
    return { success: true }
  } catch (err) {
    return fail(err)
  }
}

export async function getWhatsAppSettings() {
  await requireStaffAction()
  const supabase = await createClient()
  const { data } = await supabase.from('whatsapp_settings').select('*').maybeSingle()
  return data ?? null
}

export async function saveWhatsAppSettings(settings: {
  auto_send_on_submission: boolean
  auto_send_on_approval: boolean
  auto_send_on_rejection: boolean
}): Promise<Result> {
  try {
    await requireStaffAction('templates.manage')
    const supabase = await createClient()
    const { data: existing } = await supabase.from('whatsapp_settings').select('id').maybeSingle()
    if (!existing) return { success: false, error: 'WhatsApp settings row is missing — run the WhatsApp migration.' }
    const { error } = await supabase.from('whatsapp_settings').update({
      auto_send_on_submission: !!settings.auto_send_on_submission,
      auto_send_on_approval: !!settings.auto_send_on_approval,
      auto_send_on_rejection: !!settings.auto_send_on_rejection,
    }).eq('id', existing.id)
    if (error) return { success: false, error: friendlyDbError(error.message) }
    revalidatePath('/admin/whatsapp')
    return { success: true }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Record that an admin opened WhatsApp with a prepared message. This is
 * NOT a delivery confirmation — wa.me links can't report that.
 */
export async function logWhatsAppMessage(entry: {
  application_id?: string
  applicant_name: string
  whatsapp_number: string
  template_id?: string
  template_name?: string
  message_body: string
  trigger_type: string
  auto?: boolean
}): Promise<{ ok: boolean; log?: WhatsAppLog; error?: string }> {
  try {
    const staff = await requireStaffAction('applications.update')
    const supabase = await createClient()
    const { data, error } = await supabase.from('whatsapp_logs').insert({
      application_id: entry.application_id ?? null,
      applicant_name: entry.applicant_name.slice(0, 200),
      whatsapp_number: entry.whatsapp_number.slice(0, 20),
      template_id: entry.template_id ?? null,
      template_name: entry.template_name?.slice(0, 120) ?? null,
      message_body: entry.message_body.slice(0, 4000),
      trigger_type: TRIGGERS.includes(entry.trigger_type) ? entry.trigger_type : 'manual',
      sent_by: entry.auto ? `${staff.email} (auto)` : staff.email,
    }).select('*').single()
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    return { ok: true, log: data as WhatsAppLog }
  } catch (err) {
    console.error('[whatsapp] log failed:', err)
    return { ok: false }
  }
}
