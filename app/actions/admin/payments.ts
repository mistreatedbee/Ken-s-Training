'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, friendlyDbError, requireStaffAction, type ActionResult } from '@/lib/auth'

const UUID = /^[0-9a-f-]{36}$/
const METHODS = ['eft', 'cash', 'card_external', 'other']

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message }
  console.error('[admin/payments]', err)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

export interface PaymentInput {
  applicationId: string
  kind: 'payment' | 'refund'
  amount: string
  method: string
  reference: string
  receivedOn: string
  note: string
}

/**
 * Record a payment or refund that was received/made outside the system
 * (EFT, cash, external card machine). No card details are ever stored,
 * and nothing here claims money was processed by a payment provider.
 */
export async function recordPayment(input: PaymentInput): Promise<ActionResult> {
  try {
    const staff = await requireStaffAction('payments.manage')
    if (!UUID.test(input.applicationId)) return { ok: false, error: 'Invalid application.' }
    if (input.kind !== 'payment' && input.kind !== 'refund') return { ok: false, error: 'Choose payment or refund.' }
    if (!METHODS.includes(input.method)) return { ok: false, error: 'Choose a payment method.' }
    const amount = Number(input.amount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, error: 'Enter an amount greater than zero.' }
    if (Math.round(amount * 100) !== amount * 100) return { ok: false, error: 'Amounts can have at most two decimal places.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn) || new Date(input.receivedOn) > new Date()) {
      return { ok: false, error: 'Enter a valid date that is not in the future.' }
    }

    const supabase = await createClient()
    const { data: app } = await supabase.from('applications').select('price_snapshot').eq('id', input.applicationId).single()
    const currency = (app?.price_snapshot as { currency?: string } | null)?.currency ?? 'ZAR'

    const { error } = await supabase.from('payments').insert({
      application_id: input.applicationId,
      kind: input.kind,
      amount,
      currency,
      method: input.method,
      reference: input.reference.trim().slice(0, 120) || null,
      received_on: input.receivedOn,
      note: input.note.trim().slice(0, 1000) || null,
      recorded_by: staff.userId,
    })
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    revalidatePath(`/admin/applications/${input.applicationId}`)
    revalidatePath('/admin/payments')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function voidPayment(paymentId: string, applicationId: string, reason: string): Promise<ActionResult> {
  try {
    const staff = await requireStaffAction('payments.manage')
    if (!UUID.test(paymentId)) return { ok: false, error: 'Invalid payment.' }
    if (!reason.trim()) return { ok: false, error: 'Please give a reason for voiding this payment.' }
    const supabase = await createClient()
    const { data, error } = await supabase.from('payments')
      .update({ voided_at: new Date().toISOString(), voided_by: staff.userId, void_reason: reason.trim().slice(0, 500) })
      .eq('id', paymentId).is('voided_at', null).select('id')
    if (error) return { ok: false, error: friendlyDbError(error.message) }
    if (!data?.length) return { ok: false, error: 'This payment was already voided.' }
    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath('/admin/payments')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
