'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WaTriggerType } from '@/lib/whatsapp'

export async function getWhatsAppTemplates() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .order('trigger_type')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function saveWhatsAppTemplate(template: {
  id?: string
  name: string
  trigger_type: string
  body: string
  active: boolean
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    if (template.id) {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({
          name: template.name,
          trigger_type: template.trigger_type,
          body: template.body,
          active: template.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', template.id)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await supabase
        .from('whatsapp_templates')
        .insert({
          name: template.name,
          trigger_type: template.trigger_type,
          body: template.body,
          active: template.active,
        })
      if (error) return { success: false, error: error.message }
    }
    revalidatePath('/admin/whatsapp')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteWhatsAppTemplate(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/whatsapp')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getWhatsAppSettings() {
  const supabase = await createClient()
  const { data } = await supabase.from('whatsapp_settings').select('*').single()
  return data ?? null
}

export async function saveWhatsAppSettings(settings: {
  auto_send_on_submission: boolean
  auto_send_on_approval: boolean
  auto_send_on_rejection: boolean
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: existing } = await supabase.from('whatsapp_settings').select('id').single()
    if (existing) {
      await supabase.from('whatsapp_settings').update(settings).eq('id', existing.id)
    } else {
      await supabase.from('whatsapp_settings').insert(settings)
    }
    revalidatePath('/admin/whatsapp')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function logWhatsAppMessage(entry: {
  application_id?: string
  applicant_name: string
  whatsapp_number: string
  template_id?: string
  template_name?: string
  message_body: string
  trigger_type: WaTriggerType
  sent_by: string
}) {
  try {
    const supabase = await createClient()
    await supabase.from('whatsapp_logs').insert({
      application_id: entry.application_id ?? null,
      applicant_name: entry.applicant_name,
      whatsapp_number: entry.whatsapp_number,
      template_id: entry.template_id ?? null,
      template_name: entry.template_name ?? null,
      message_body: entry.message_body,
      trigger_type: entry.trigger_type,
      sent_by: entry.sent_by,
    })
  } catch {
    // Silent — logging should never crash the UI
  }
}

export async function getApplicationWaLogs(applicationId: string) {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .eq('application_id', applicationId)
      .order('sent_at', { ascending: false })
    return data ?? []
  } catch {
    return []
  }
}
