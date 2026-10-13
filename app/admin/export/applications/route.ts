import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaff } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { applyApplicationFilters, type ApplicationFilters } from '@/lib/application-query'
import { statusLabel, studyModeLabel } from '@/lib/statuses'
import { toCsv } from '@/lib/format'

const MAX_ROWS = 10000

export async function GET(request: NextRequest) {
  const staff = await getStaff()
  if (!staff) return new NextResponse('Not signed in as staff', { status: 401 })
  if (!can(staff.role, 'applications.export')) return new NextResponse('You do not have permission to export records', { status: 403 })

  const filters = Object.fromEntries(request.nextUrl.searchParams.entries()) as ApplicationFilters
  const supabase = await createClient()

  const { data, error } = await applyApplicationFilters(
    supabase.from('applications').select(
      'id, student_number, applicant_name, status, submitted_at, reviewed_at, programme, study_mode, ' +
      'personal_info, contact_details, next_of_kin, education, custom_answers, price_snapshot, rejection_reason, archived_at, ' +
      'courses:kti_courses(code, name), intakes(name)',
    ),
    filters,
  ).limit(MAX_ROWS)

  if (error) return new NextResponse(`Export failed: ${error.message}`, { status: 500 })

  const ids = (data ?? []).map((r) => (r as unknown as { id: string }).id)
  const fin = new Map<string, { amount_paid: string; net_paid: string; payment_status: string }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data: f } = await supabase
      .from('application_financials')
      .select('application_id, amount_paid, net_paid, payment_status')
      .in('application_id', ids.slice(i, i + 200))
    for (const row of f ?? []) fin.set(row.application_id, row)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  const customKeys = [...new Set(rows.flatMap((r) => Object.keys(r.custom_answers ?? {})))].sort()

  const header = [
    'Reference', 'Applicant', 'Status', 'Submitted', 'Decision date', 'Course code', 'Course', 'Intake', 'Study mode',
    'ID / passport', 'Date of birth', 'Gender', 'Nationality', 'Phone', 'WhatsApp', 'Email', 'Address', 'City', 'Province',
    'Next of kin', 'Next of kin phone', 'Highest qualification', 'Institution', 'Year completed',
    'Currency', 'Fees due (at submission)', 'Net paid', 'Payment status', 'Decision reason', 'Archived',
    ...customKeys,
  ]

  const body = rows.map((r) => {
    const pi = r.personal_info ?? {}
    const cd = r.contact_details ?? {}
    const kin = r.next_of_kin ?? {}
    const edu = r.education ?? {}
    const f = fin.get(r.id)
    return [
      r.student_number, r.applicant_name, statusLabel(r.status), r.submitted_at?.slice(0, 10), r.reviewed_at?.slice(0, 10),
      r.courses?.code, r.courses?.name ?? r.programme, r.intakes?.name, r.study_mode ? studyModeLabel(r.study_mode) : '',
      pi.id_number, pi.date_of_birth, pi.gender, pi.nationality, cd.phone, cd.whatsapp, cd.email,
      cd.physical_address, cd.physical_city, cd.physical_province,
      kin.full_name, kin.phone, edu.highest_qualification, edu.institution, edu.year_completed,
      r.price_snapshot?.currency, r.price_snapshot?.total, f?.net_paid, f?.payment_status, r.rejection_reason,
      r.archived_at ? 'Yes' : 'No',
      ...customKeys.map((k) => {
        const v = r.custom_answers?.[k]
        return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v
      }),
    ]
  })

  await supabase.rpc('log_admin_action', {
    p_action: 'export',
    p_entity_type: 'applications',
    p_details: { filters, rows: rows.length },
  })

  // BOM so Excel opens UTF-8 correctly.
  const csv = '﻿' + toCsv([header, ...body])
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kti-applications-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
