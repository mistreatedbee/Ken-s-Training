import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, PageShell, Pagination } from '@/components/admin/ui'

export const metadata = { title: 'Audit log — KTI Admin' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const ENTITY_LABEL: Record<string, string> = {
  kti_courses: 'Course', course_prices: 'Course price', intakes: 'Intake', staff_users: 'Staff',
  form_versions: 'Application form', payments: 'Payment', applications: 'Applications', report: 'Report',
}

function summarise(changes: unknown): string {
  if (!changes || typeof changes !== 'object') return ''
  const entries = Object.entries(changes as Record<string, unknown>)
  const isDiff = entries.every(([, v]) => v && typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object))
  if (isDiff) {
    return entries.map(([k, v]) => {
      const d = v as { from: unknown; to: unknown }
      const show = (x: unknown) => (typeof x === 'object' ? JSON.stringify(x) : String(x))
      return `${k}: ${show(d.from)} → ${show(d.to)}`
    }).join('; ')
  }
  const c = changes as Record<string, unknown>
  return ['name', 'code', 'email', 'role', 'tuition_fee', 'amount', 'kind', 'status', 'rows']
    .filter((k) => k in c).map((k) => `${k}: ${String(c[k])}`).join('; ')
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  const { page: pageParam, type } = await searchParams
  await requireStaffPage('audit.view')
  const page = Math.max(1, Number(pageParam) || 1)
  const supabase = await createClient()
  let q = supabase.from('audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (type && ENTITY_LABEL[type]) q = q.eq('entity_type', type)
  const { data, error, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  return (
    <PageShell>
      <PageHeader title="Audit log" description="Changes to courses, prices, intakes, the form, staff and payments, plus data exports. Application decisions are in each application's history." />
      <nav aria-label="Filter audit log" className="mb-4 flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(ENTITY_LABEL)].map(([k, label]) => (
          <a key={k || 'all'} href={k ? `/admin/audit?type=${k}` : '/admin/audit'}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${(type ?? '') === k ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
            {label}
          </a>
        ))}
      </nav>
      {error ? <ErrorState message={error.message} /> : !data?.length ? <EmptyState title="Nothing logged yet" /> : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Who</th>
                <th className="px-4 py-3 font-semibold">What</th>
                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-border align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">{r.actor_email}</td>
                  <td className="whitespace-nowrap px-4 py-3">{ENTITY_LABEL[r.entity_type] ?? r.entity_type} · {r.action}</td>
                  <td className="max-w-xl break-words px-4 py-3 text-xs text-muted-foreground">{summarise(r.changes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination base="/admin/audit" params={type ? { type } : {}} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
    </PageShell>
  )
}
