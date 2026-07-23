import { createClient } from '@/lib/supabase/server'
import { PrintButton } from './print-button'

export const metadata = { title: 'Reports — KTI Admin' }

export default async function AdminReportsPage() {
  const supabase = await createClient()

  const { data: applications } = await supabase
    .from('applications')
    .select('status, programme, submitted_at')

  const apps = applications ?? []

  const byStatus = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  const byProgramme = apps.reduce<Record<string, number>>((acc, a) => {
    const name = a.programme ?? 'Not specified'
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {})

  const byMonth = apps
    .filter((a) => a.submitted_at)
    .reduce<Record<string, number>>((acc, a) => {
      const m = new Date(a.submitted_at!).toLocaleString('en-ZA', { month: 'short', year: 'numeric' })
      acc[m] = (acc[m] ?? 0) + 1
      return acc
    }, {})

  const statusLabels: Record<string, string> = {
    submitted: 'Submitted',
    under_review: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-muted-foreground">Overview of application data</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total applications" value={apps.length} />
        <MetricCard label="Under review" value={byStatus.under_review ?? 0} />
        <MetricCard label="Approved" value={byStatus.approved ?? 0} />
        <MetricCard label="Rejected" value={byStatus.rejected ?? 0} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ReportTable
          title="Applications by status"
          rows={Object.entries(byStatus).map(([k, v]) => [statusLabels[k] ?? k, v])}
        />
        <ReportTable
          title="Applications by programme"
          rows={Object.entries(byProgramme).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])}
        />
        <ReportTable
          title="Submissions by month"
          rows={Object.entries(byMonth).sort().map(([k, v]) => [k, v])}
        />
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl font-bold text-foreground">{value}</p>
    </div>
  )
}

function ReportTable({ title, rows }: { title: string; rows: [string, number][] }) {
  const total = rows.reduce((s, [, v]) => s + v, 0)
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {rows.map(([label, count]) => (
              <tr key={label} className="border-b border-border last:border-0">
                <td className="py-2 text-muted-foreground">{label}</td>
                <td className="py-2 text-right font-medium text-foreground">{count}</td>
                <td className="py-2 pl-4 text-right text-muted-foreground">
                  {total > 0 ? `${Math.round((count / total) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
