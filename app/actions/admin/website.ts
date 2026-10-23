'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, friendlyDbError, requireStaffAction, type ActionResult } from '@/lib/auth'
import { normalizeSiteContent } from '@/lib/site-content'

/** Save the public website text. Goes live immediately. */
export async function saveSiteContent(content: unknown): Promise<ActionResult> {
  try {
    const staff = await requireStaffAction('content.manage')
    const clean = normalizeSiteContent(content)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('kti_site_content')
      .update({ content: clean, updated_by: staff.userId })
      .eq('id', 'site')
      .select('id')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    if (!data?.length) {
      return { ok: false, error: 'Website content table is missing — run migration 20261023_site_content_and_students.sql.' }
    }
    revalidatePath('/')
    revalidatePath('/admin/website')
    return { ok: true }
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message }
    console.error('[website]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
