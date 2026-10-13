import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaff } from '@/lib/auth'
import { loadReport } from '@/lib/report'
import { statusLabel } from '@/lib/statuses'
import { toCsv } from '@/lib/format'

/** Aggregate report (no personal data) — available to all staff. */
export async function GET(request: NextRequest) {
  const staff = await getStaff()
  if (!staff) return new NextResponse('Not signed in as staff', { status: 401 })
  const from = request.nextUrl.searchParams.get('from') ?? undefined
  const to = request.nextUrl.searchParams.get('to') ?? undefined
  const supabase = await createClient()
  const { report, pricing, error } = await loadReport(supabase, from, to)
  if (error || !report) return new NextResponse(`Report failed: ${error?.message}`, { status: 500 })

  const rows: unknown[][] = [
    ['KTI admissions report'], ['Period', `${from ?? 'start'} to ${to ?? 'today'}`], ['Generated', new Date().toISOString()], [],
    ['Applications by status'], ['Status', 'Count'],
    ...Object.entries(report.by_status).map(([k, v]) => [statusLabel(k), v]), ['Total', report.total], [],
    ['Applications by course'], ['Course', 'Applications', 'Accepted'],
    ...report.by_course.map((c) => [c.course, c.total, c.approved]), [],
    ['Enrolments by course and intake'], ['Course', 'Intake', 'Accepted'],
    ...report.enrolments.map((e) => [e.course, e.intake, e.total]), [],
    ['Submissions by month'], ['Month', 'Applications'],
    ...report.by_month.map((m) => [m.month, m.total]), [],
    ['Payments'], ['Currency', 'Due', 'Received', 'Refunded', 'Outstanding'],
    ...report.payments.map((p) => [p.currency, p.due, p.paid, p.refunded, p.outstanding]), [],
    ['Current course pricing'], ['Code', 'Course', 'Status', 'Currency', 'Course fee', 'Registration fee', 'Total'],
    ...pricing.map((c) => [c.code, c.name, c.status, c.current_price?.currency, c.current_price?.tuition_fee, c.current_price?.registration_fee, c.current_price?.total]),
  ]

  await supabase.rpc('log_admin_action', { p_action: 'export', p_entity_type: 'report', p_details: { from, to } })

  return new NextResponse('﻿' + toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kti-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
