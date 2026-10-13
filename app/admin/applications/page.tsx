import Link from 'next/link'
import { Download, MessageCircle, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { formatDate } from '@/lib/format'
import { APPLICATION_STATUSES, STATUS_META } from '@/lib/statuses'
import { buildWhatsAppUrl, isValidWhatsAppNumber } from '@/lib/whatsapp'
import {
  LIST_COLUMNS, SORTS, applyApplicationFilters, countByStatus, type ApplicationFilters,
} from '@/lib/application-query'
import {
  EmptyState, ErrorState, PageHeader, PageShell, Pagination, StatusBadge, fieldClass, withParams,
} from '@/components/admin/ui'

export const metadata = { title: 'Applications — KTI Admin' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

interface Row {
  id: string
  student_number: string | null
  applicant_name: string | null
  status: string
  submitted_at: string
  programme: string | null
  archived_at: string | null
  contact_details: { phone?: string; whatsapp?: string; email?: string } | null
  courses: { name: string } | null
  intakes: { name: string } | null
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<ApplicationFilters> }) {
  const filters = await searchParams
  const staff = await requireStaffPage()
  const supabase = await createClient()
  const page = Math.max(1, Number(filters.page) || 1)

  const listQuery = applyApplicationFilters(
    supabase.from('applications').select(LIST_COLUMNS, { count: 'exact' }),
    filters,
  ).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const [listRes, coursesRes, intakesRes, counts] = await Promise.all([
    listQuery,
    supabase.from('kti_courses').select('id, name, status').order('sort_order').order('name'),
    filters.course
      ? supabase.from('intakes').select('id, name').eq('course_id', filters.course).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    countByStatus(supabase, filters),
  ])

  const params = Object.fromEntries(
    Object.entries(filters).filter(([k, v]) => k !== 'page' && typeof v === 'string' && v !== ''),
  ) as Record<string, string>

  const rows = (listRes.data ?? []) as unknown as Row[]
  const total = listRes.count ?? 0
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const exportHref = withParams('/admin/export/applications', params, {})

  const chips = [
    { value: '', label: 'All', count: allCount },
    ...APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, count: counts[s] ?? 0 })),
  ]

  return (
    <PageShell>
      <PageHeader
        title="Applications"
        description={`${total} matching application${total === 1 ? '' : 's'}`}
        actions={can(staff.role, 'applications.export') && (
          <a href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            <Download className="size-4" /> Export CSV
          </a>
        )}
      />

      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = (filters.status ?? '') === c.value
          return (
            <Link
              key={c.value || 'all'}
              href={withParams('/admin/applications', params, { status: c.value || undefined })}
              aria-current={active ? 'true' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.label}
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-xs">{c.count}</span>
            </Link>
          )
        })}
      </nav>

      <form method="GET" className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <div className="relative sm:col-span-2">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
          <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-muted-foreground" />
          <input id="q" name="q" defaultValue={filters.q} placeholder="Name, email, phone, ID or reference" className={`${fieldClass} pl-9`} />
        </div>
        <div>
          <label htmlFor="course" className="mb-1 block text-xs font-medium text-muted-foreground">Course</label>
          <select id="course" name="course" defaultValue={filters.course ?? ''} className={fieldClass}>
            <option value="">All courses</option>
            {(coursesRes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.status !== 'active' ? ` (${c.status})` : ''}</option>
            ))}
            <option value="none">No course recorded</option>
          </select>
        </div>
        <div>
          <label htmlFor="intake" className="mb-1 block text-xs font-medium text-muted-foreground">Intake</label>
          <select id="intake" name="intake" defaultValue={filters.intake ?? ''} className={fieldClass} disabled={!filters.course}>
            <option value="">{filters.course ? 'All intakes' : 'Choose a course first'}</option>
            {(intakesRes.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-muted-foreground">Submitted from</label>
          <input id="from" type="date" name="from" defaultValue={filters.from} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-muted-foreground">Submitted to</label>
          <input id="to" type="date" name="to" defaultValue={filters.to} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="sort" className="mb-1 block text-xs font-medium text-muted-foreground">Sort by</label>
          <select id="sort" name="sort" defaultValue={filters.sort ?? 'newest'} className={fieldClass}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="archived" className="mb-1 block text-xs font-medium text-muted-foreground">Archived</label>
          <select id="archived" name="archived" defaultValue={filters.archived ?? ''} className={fieldClass}>
            <option value="">Hide archived</option>
            <option value="include">Include archived</option>
            <option value="only">Archived only</option>
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          <Link href="/admin/applications" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted-foreground hover:bg-muted">
            Clear
          </Link>
          <button className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Apply filters
          </button>
        </div>
      </form>

      {listRes.error ? (
        <ErrorState title="Couldn't load applications" message={listRes.error.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No applications found"
          description={Object.keys(params).length ? 'Try changing or clearing the filters.' : 'Submitted applications will appear here.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Applicant</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((app) => {
                const wa = app.contact_details?.whatsapp || app.contact_details?.phone || ''
                return (
                  <tr key={app.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/applications/${app.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                        {app.applicant_name || 'Unknown applicant'}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{app.student_number}</p>
                      {app.contact_details?.email && <p className="text-xs text-muted-foreground">{app.contact_details.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{app.courses?.name ?? app.programme ?? '—'}</p>
                      {app.intakes?.name && <p className="text-xs text-muted-foreground">{app.intakes.name}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(app.submitted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={app.status} />
                        {app.archived_at && <span className="text-xs text-muted-foreground">Archived</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isValidWhatsAppNumber(wa) && (
                        <a
                          href={buildWhatsAppUrl(wa)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open WhatsApp chat with ${app.applicant_name ?? 'applicant'}`}
                          className="inline-flex items-center rounded-lg px-2 py-1.5 text-[#25D366] hover:bg-[#25D366]/10"
                        >
                          <MessageCircle className="size-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination base="/admin/applications" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </PageShell>
  )
}
