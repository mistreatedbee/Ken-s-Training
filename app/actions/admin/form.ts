'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, friendlyDbError, requireStaffAction, type ActionResult } from '@/lib/auth'
import { normalizeConfig } from '@/lib/form-config'

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message }
  console.error('[admin/form]', err)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

/** Save (or create) the single draft. The public form is unaffected until published. */
export async function saveFormDraft(config: unknown): Promise<ActionResult> {
  try {
    const staff = await requireStaffAction('form.manage')
    const clean = normalizeConfig(config)
    const supabase = await createClient()
    const { data: draft } = await supabase.from('form_versions').select('id').eq('status', 'draft').maybeSingle()
    const { error } = draft
      ? await supabase.from('form_versions').update({ config: clean }).eq('id', draft.id)
      : await supabase.from('form_versions').insert({ status: 'draft', config: clean, created_by: staff.userId })
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    revalidatePath('/admin/form')
    revalidatePath('/admin/form/preview')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function discardFormDraft(): Promise<ActionResult> {
  try {
    await requireStaffAction('form.manage')
    const supabase = await createClient()
    const { error } = await supabase.from('form_versions').delete().eq('status', 'draft')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    revalidatePath('/admin/form')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function publishFormDraft(): Promise<ActionResult> {
  try {
    await requireStaffAction('form.manage')
    const supabase = await createClient()
    const { error } = await supabase.rpc('publish_form_draft')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    revalidatePath('/apply')
    revalidatePath('/admin/form')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
