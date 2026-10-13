import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { formatMoney } from '@/lib/format'
import { PAYMENT_STATUS_META } from '@/lib/statuses'
import {
  EmptyState, ErrorState, Notice, PageHeader, PageShell, Pagination, PaymentBadge, StatCard, StatusBadge, withParams,
} from '@/components/admin/ui'

export const metadata = { title: 'Payments — KTI Admin' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

interface Fin {
  application_id: string
  currency: string | null
  amount_due: string | null
  amount_paid: string
  amount_refunded: string
  net_paid: string
  payment_status: string
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status, page: pageParam } = await searchParams
  await requireStaffPage()
  const supabase = await createClient()
  const page = Math.max(1, Number(pageParam) || 1)

  let q = supabase.from('application_financials').select('*', { count: 'exact' }).neq('payment_status', 'no_fee')
  if (status && PAYMENT_STATUS_META[status]) q = q.eq('payment_status', status)
  const [listRes, allRes] = await Promise.all([
    q.order('application_id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('application_financials').select('currency, amount_due, net_paid, payment_status').neq('payment_status', 'no_fee'),
  ])
  if (listRes.error || allRes.error) {
    return <PageShell><PageHeader title="Payments" /><ErrorState message={(listRes.error ?? allRes.error)!.message} /></PageShell>
  }

  const rows = (listRes.data ?? []) as Fin[]
  const ids = rows.map((r) => r.application_id)
  const { data: apps } = ids.length
    ? await supabase.from('applications').select('id, applicant_name, student_number, status, programme, courses:kti_courses(name)').in('id', ids)
    : { data: [] }
  const appById = new Map((apps ?? []).map((a) => [a.id, a as unknown as {
    id: string; applicant_name: string | null; student_number: string | null; status: string; programme: string | null; courses: { name: string } | null
  }]))

  // Totals per currency across all applications with fees.
  const totals = new Map<string, { due: number; net: number }>()
  const counts: Record<string, number> = {}
  for (const f of (allRes.data ?? []) as Fin[]) {
    counts[f.payment_status] = (counts[f.payment_status] ?? 0) + 1
    const cur = f.currency ?? 'ZAR'
    const t = totals.get(cur) ?? { due: 0, net: 0 }
    t.due += Number(f.amount_due ?? 0)
    t.net += Number(f.net_paid)
    totals.set(cur, t)
  }

  return (
    <PageShell>
      <PageHeader title="Payments" description="Fees quoted at submission and payments recorded by staff." />
      <div className="mb-6">
        <Notice>
          No online payment provider is connected. Payments, refunds and voids are recorded manually by finance staff on each
          application, and every change is logged. Card details are never stored.
        </Notice>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...totals.entries()].map(([cur, t]) => (
          <StatCard key={cur} label={`Outstanding (${cur})`} value={formatMoney(Math.max(t.due - t.net, 0), cur)} hint={`${formatMoney(t.net, cur)} received of ${formatMoney(t.due, cur)} due`} />
        ))}
        <StatCard label="Fully paid" value={counts.paid ?? 0} href="/admin/payments?status=paid" tone="success" />
        <StatCard label="Unpaid / partially paid" value={(counts.unpaid ?? 0) + (counts.partially_paid ?? 0)} href="/admin/payments?status=unpaid" tone="warning" />
      </div>

      <nav aria-label="Filter by payment status" className="mb-4 flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(PAYMENT_STATUS_META).filter(([k]) => k !== 'no_fee').map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <Link key={k || 'all'} href={withParams('/admin/payments', {}, { status: k || undefined })}
            aria-current={(status ?? '') === k ? 'true' : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${(status ?? '') === k ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
            {label}{k ? ` (${counts[k] ?? 0})` : ''}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title="No matching records" description="Applications appear here once a course has fees and someone applies." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Applicant</th>
                <th className="px-4 py-3 font-semibold">Application</th>
                <th className="px-4 py-3 text-right font-semibold">Due</th>
                <th className="px-4 py-3 text-right font-semibold">Paid (net)</th>
                <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const a = appById.get(f.application_id)
                const cur = f.currency ?? 'ZAR'
                return (
                  <tr key={f.application_id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/applications/${f.application_id}`} className="font-semibold hover:text-primary hover:underline">{a?.applicant_name || 'Unknown'}</Link>
                      <p className="font-mono text-xs text-muted-foreground">{a?.student_number}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{a?.courses?.name ?? a?.programme ?? '—'}</p>
                      {a && <StatusBadge status={a.status} />}
                    </td>
                    <td className="px-4 py-3 text-right">{formatMoney(f.amount_due, cur)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(f.net_paid, cur)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(Math.max(Number(f.amount_due ?? 0) - Number(f.net_paid), 0), cur)}</td>
                    <td className="px-4 py-3"><PaymentBadge status={f.payment_status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination base="/admin/payments" params={status ? { status } : {}} page={page} pageSize={PAGE_SIZE} total={listRes.count ?? 0} />
    </PageShell>
  )
}
