import type { SupabaseClient } from '@supabase/supabase-js'
import type { PriceQuote } from '@/lib/format'

export interface AdminReport {
  total: number
  archived: number
  by_status: Record<string, number>
  by_course: { course_id: string | null; course: string; total: number; approved: number }[]
  by_month: { month: string; total: number }[]
  enrolments: { course: string; intake: string; total: number }[]
  payments: { currency: string; due: number; paid: number; refunded: number; outstanding: number }[]
  payment_status: Record<string, number>
}

export interface PricingRow {
  code: string
  name: string
  status: string
  current_price: PriceQuote | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function reportRange(from?: string, to?: string) {
  const f = from && DATE.test(from) ? `${from}T00:00:00Z` : null
  let t: string | null = null
  if (to && DATE.test(to)) {
    const d = new Date(`${to}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    t = d.toISOString()
  }
  return { p_from: f, p_to: t }
}

export async function loadReport(supabase: SupabaseClient, from?: string, to?: string) {
  const [rep, pricing] = await Promise.all([
    supabase.rpc('admin_report', reportRange(from, to)),
    supabase.from('course_overview').select('code, name, status, current_price').in('status', ['active', 'inactive', 'draft']).order('sort_order').order('name'),
  ])
  return {
    report: rep.data as AdminReport | null,
    pricing: (pricing.data ?? []) as PricingRow[],
    error: rep.error ?? pricing.error,
  }
}
