import { Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { loadReport } from '@/lib/report'
import { formatMoney } from '@/lib/format'
import { PAYMENT_STATUS_META, statusLabel } from '@/lib/statuses'
import { ErrorState, PageHeader, PageShell, StatCard, fieldClass, withParams } from '@/components/admin/ui'
import { PrintButton } from './print-button'

export const metadata = { title: 'Reports — KTI Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams
  await requireStaffPage()
  const supabase = await createClient()
  const { report, pricing, error } = await loadReport(supabase, from, to)

  if (error || !report) {
    return <PageShell><PageHeader title="Reports" /><ErrorState title="Couldn't build the report" message={error?.message} /></PageShell>
  }

  const s = report.by_status
  const range = from || to ? `${from ?? 'start'} to ${to ?? 'today'}` : 'all time'

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        description={`Applications submitted: ${range}. Figures come straight from the database.`}
        actions={
          <>
            <a href={withParams('/admin/export/report', { from, to }, {})} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
              <Download className="size-4" /> Download CSV
            </a>
            <PrintButton />
          </>
        }
      />

      <form method="GET" className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 print:hidden">
        <div>
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
          <input id="from" type="date" name="from" defaultValue={from} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
          <input id="to" type="date" name="to" defaultValue={to} className={fieldClass} />
        </div>
        <button className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">Update</button>
        {(from || to) && <a href="/admin/reports" className="inline-flex h-10 items-center rounded-lg px-4 text-sm text-muted-foreground hover:bg-muted">All time</a>}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications received" value={report.total} />
        <StatCard label="Awaiting decision" value={(s.submitted ?? 0) + (s.under_review ?? 0) + (s.info_requested ?? 0)} />
        <StatCard label="Accepted" value={s.approved ?? 0} tone="success" />
        <StatCard label="Rejected / withdrawn" value={(s.rejected ?? 0) + (s.withdrawn ?? 0)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ReportTable title="Applications by status" head={['Status', 'Count', '%']}
          rows={Object.entries(s).sort((a, b) => b[1] - a[1]).map(([k, v]) => [statusLabel(k), v, pct(v, report.total)])} />
        <ReportTable title="Applications by course" head={['Course', 'Applications', 'Accepted']}
          rows={report.by_course.map((c) => [c.course, c.total, c.approved])} />
        <ReportTable title="Enrolments by course and intake" head={['Course', 'Intake', 'Accepted']}
          rows={report.enrolments.map((e) => [e.course, e.intake, e.total])} />
        <ReportTable title="Submissions by month" head={['Month', 'Applications']}
          rows={report.by_month.map((m) => [m.month, m.total])} />
        <ReportTable title="Payment summary" head={['Currency', 'Due', 'Received', 'Refunded', 'Outstanding']}
          rows={report.payments.map((p) => [p.currency, formatMoney(p.due, p.currency), formatMoney(p.paid, p.currency), formatMoney(p.refunded, p.currency), formatMoney(p.outstanding, p.currency)])}
          note="Based on fees quoted at submission and payments recorded by staff." />
        <ReportTable title="Payment status" head={['Status', 'Applications']}
          rows={Object.entries(report.payment_status).map(([k, v]) => [PAYMENT_STATUS_META[k]?.label ?? k, v])} />
        <div className="lg:col-span-2">
          <ReportTable title="Current course pricing" head={['Code', 'Course', 'Status', 'Course fee', 'Registration', 'Total']}
            rows={pricing.map((c) => [
              c.code, c.name, c.status,
              c.current_price ? formatMoney(c.current_price.tuition_fee, c.current_price.currency) : 'Not set',
              c.current_price ? formatMoney(c.current_price.registration_fee, c.current_price.currency) : '—',
              c.current_price ? formatMoney(c.current_price.total, c.current_price.currency) : '—',
            ])} />
        </div>
      </div>
    </PageShell>
  )
}

function pct(v: number, total: number) {
  return total > 0 ? `${Math.round((v / total) * 100)}%` : '—'
}

function ReportTable({ title, head, rows, note }: { title: string; head: string[]; rows: (string | number)[][]; note?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 break-inside-avoid">
      <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No data for this period.</p>
      ) : (
        <div className="-mx-6 mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                {head.map((h, i) => <th key={h} className={`px-6 py-2 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {r.map((cell, ci) => <td key={ci} className={`px-6 py-2 ${ci === 0 ? 'text-foreground' : 'text-right text-muted-foreground'}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
    </section>
  )
}
