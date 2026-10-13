import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { formatDateTime, formatMoney, type PriceQuote } from '@/lib/format'
import { statusLabel } from '@/lib/statuses'
import {
  CourseStatusBadge, ErrorState, Notice, PageHeader, PageShell, StatCard,
} from '@/components/admin/ui'

export const metadata = { title: 'Dashboard — KTI Admin' }
export const dynamic = 'force-dynamic'

interface Report {
  total: number
  archived: number
  by_status: Record<string, number>
}

interface CourseRow {
  id: string
  name: string
  code: string
  status: string
  accepting_applications: boolean
  application_deadline: string | null
  capacity: number | null
  current_price: PriceQuote | null
  application_count: number
  enrolled_count: number
  pending_count: number
}

interface EventRow {
  id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  actor_email: string | null
  created_at: string
  application_id: string
  applications: { applicant_name: string | null; student_number: string | null } | null
}

function describeEvent(e: EventRow) {
  switch (e.event_type) {
    case 'submitted': return 'submitted an application'
    case 'status_changed': return `changed status ${statusLabel(e.from_status ?? '')} → ${statusLabel(e.to_status ?? '')}`
    case 'record_edited': return 'edited applicant details'
    case 'note_added': return 'added a note'
    case 'archived': return 'archived the application'
    case 'restored': return 'restored the application'
    case 'payment_recorded': return 'recorded a payment'
    case 'payment_voided': return 'voided a payment'
    case 'message_prepared': return 'prepared a WhatsApp message'
    default: return e.event_type
  }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams
  await requireStaffPage()
  const supabase = await createClient()

  const [reportRes, coursesRes, eventsRes, studentsRes] = await Promise.all([
    supabase.rpc('admin_report'),
    supabase.from('course_overview')
      .select('id, name, code, status, accepting_applications, application_deadline, capacity, current_price, application_count, enrolled_count, pending_count')
      .in('status', ['active', 'inactive', 'draft'])
      .order('sort_order').order('name'),
    supabase.from('application_events')
      .select('id, event_type, from_status, to_status, actor_email, created_at, application_id, applications(applicant_name, student_number)')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const loadError = reportRes.error ?? coursesRes.error ?? eventsRes.error ?? studentsRes.error
  if (loadError) {
    console.error('[Admin dashboard] query failed:', loadError)
    return (
      <PageShell>
        <PageHeader title="Dashboard" />
        <ErrorState title="Couldn't load the dashboard" message={loadError.message} />
      </PageShell>
    )
  }

  const report = reportRes.data as Report
  const s = report.by_status ?? {}
  const courses = (coursesRes.data ?? []) as CourseRow[]
  const events = (eventsRes.data ?? []) as unknown as EventRow[]
  const active = courses.filter((c) => c.status === 'active')
  const openNow = active.filter((c) => c.accepting_applications && (!c.application_deadline || c.application_deadline >= new Date().toISOString().slice(0, 10)))
  const noPrice = active.filter((c) => !c.current_price)

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="An overview of applications, courses and admissions activity."
        actions={
          <form action="/admin/applications" method="GET" className="relative w-full sm:w-80">
            <label htmlFor="dash-q" className="sr-only">Search applications</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="dash-q"
              name="q"
              placeholder="Search name, email, reference…"
              className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </form>
        }
      />

      {denied && <div className="mb-6"><Notice tone="warning">You don&apos;t have permission to open that page.</Notice></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total applicants" value={report.total} href="/admin/applications" />
        <StatCard label="New — awaiting review" value={s.submitted ?? 0} href="/admin/applications?status=submitted" tone={(s.submitted ?? 0) > 0 ? 'warning' : 'default'} />
        <StatCard label="In review / info requested" value={(s.under_review ?? 0) + (s.info_requested ?? 0)} href="/admin/applications?status=open" />
        <StatCard label="Accepted" value={s.approved ?? 0} href="/admin/applications?status=approved" tone="success" />
        <StatCard label="Rejected / withdrawn" value={(s.rejected ?? 0) + (s.withdrawn ?? 0)} href="/admin/applications?status=closed" />
        <StatCard label="Waitlisted" value={s.waitlisted ?? 0} href="/admin/applications?status=waitlisted" />
        <StatCard label="Active enrolments" value={studentsRes.count ?? 0} href="/admin/students" hint="Students with an active record" />
        <StatCard label="Courses open for applications" value={`${openNow.length} / ${active.length}`} href="/admin/courses" hint="Open / active courses" />
      </div>

      {noPrice.length > 0 && (
        <div className="mt-6">
          <Notice tone="warning">
            {noPrice.length} active course{noPrice.length === 1 ? ' has' : 's have'} no fees set, so applicants see
            &ldquo;Fees to be confirmed&rdquo;.{' '}
            <Link href="/admin/courses?filter=no_price" className="font-semibold underline">Set fees</Link>
          </Notice>
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-5">
        <section className="rounded-2xl border border-border bg-card p-6 xl:col-span-3" aria-labelledby="courses-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="courses-heading" className="font-serif text-xl font-semibold">Courses &amp; pricing</h2>
            <Link href="/admin/courses" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Manage <ArrowRight className="size-4" />
            </Link>
          </div>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No courses yet.</p>
          ) : (
            <div className="-mx-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-2 font-semibold">Course</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 text-right font-semibold">Current fees</th>
                    <th className="px-2 py-2 text-right font-semibold">Pending</th>
                    <th className="px-6 py-2 text-right font-semibold">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.slice(0, 12).map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-6 py-2.5">
                        <Link href={`/admin/courses/${c.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{c.name}</Link>
                        {c.status === 'active' && !c.accepting_applications && <span className="ml-2 text-xs text-muted-foreground">(closed)</span>}
                      </td>
                      <td className="px-2 py-2.5"><CourseStatusBadge status={c.status} /></td>
                      <td className="px-2 py-2.5 text-right">
                        {c.current_price ? formatMoney(c.current_price.total, c.current_price.currency) : <span className="text-amber-700">Not set</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right">{c.pending_count}</td>
                      <td className="px-6 py-2.5 text-right">{c.enrolled_count}{c.capacity ? ` / ${c.capacity}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {courses.length > 12 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Showing 12 of {courses.length}. <Link href="/admin/courses" className="text-primary hover:underline">See all courses</Link>
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 xl:col-span-2" aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="mb-4 font-serif text-xl font-semibold">Recent activity</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {events.map((e) => (
                <li key={e.id} className="text-sm">
                  <Link href={`/admin/applications/${e.application_id}`} className="group block rounded-lg p-2 -m-2 hover:bg-muted">
                    <p className="text-foreground">
                      <span className="font-medium">{e.event_type === 'submitted' ? (e.applications?.applicant_name || 'Applicant') : (e.actor_email ?? 'System')}</span>{' '}
                      {describeEvent(e)}
                      {e.event_type !== 'submitted' && e.applications?.applicant_name && (
                        <> for <span className="font-medium">{e.applications.applicant_name}</span></>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.created_at)}{e.applications?.student_number ? ` · ${e.applications.student_number}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </PageShell>
  )
}
