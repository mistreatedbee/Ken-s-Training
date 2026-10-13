import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { formatDate, formatMoney, type PriceQuote } from '@/lib/format'
import { studyModeLabel } from '@/lib/statuses'
import {
  CourseStatusBadge, EmptyState, ErrorState, Notice, PageHeader, PageShell, withParams,
} from '@/components/admin/ui'

export const metadata = { title: 'Courses & fees — KTI Admin' }
export const dynamic = 'force-dynamic'

interface CourseRow {
  id: string
  code: string
  name: string
  category: string | null
  status: string
  accepting_applications: boolean
  application_deadline: string | null
  capacity: number | null
  study_modes: string[]
  current_price: PriceQuote | null
  application_count: number
  enrolled_count: number
  pending_count: number
  open_intake_count: number
}

const FILTERS = [
  { value: '', label: 'Active & draft' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
  { value: 'no_price', label: 'Missing fees' },
  { value: 'all', label: 'All' },
]

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ filter?: string; created?: string }> }) {
  const { filter = '' } = await searchParams
  const staff = await requireStaffPage()
  const supabase = await createClient()

  let query = supabase.from('course_overview').select('*').order('sort_order').order('name')
  if (filter === '' ) query = query.in('status', ['active', 'draft'])
  else if (['active', 'draft', 'inactive', 'archived'].includes(filter)) query = query.eq('status', filter)
  else if (filter === 'no_price') query = query.eq('status', 'active').is('current_price', null)
  const { data, error } = await query
  const courses = (data ?? []) as CourseRow[]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <PageShell>
      <PageHeader
        title="Courses & fees"
        description="Courses marked Active appear on the public application form, with their current fees."
        actions={can(staff.role, 'courses.manage') && (
          <Link href="/admin/courses/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="size-4" /> New course
          </Link>
        )}
      />

      {!can(staff.role, 'courses.manage') && (
        <div className="mb-6"><Notice>You have view-only access to courses.</Notice></div>
      )}

      <nav aria-label="Filter courses" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value || 'default'}
            href={withParams('/admin/courses', {}, { filter: f.value || undefined })}
            aria-current={filter === f.value ? 'true' : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <ErrorState title="Couldn't load courses" message={error.message} />
      ) : courses.length === 0 ? (
        <EmptyState title="No courses here" description="Try another filter, or create a new course." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Applications</th>
                <th className="px-4 py-3 text-right font-semibold">Current fees</th>
                <th className="px-4 py-3 text-right font-semibold">Applicants</th>
                <th className="px-4 py-3 text-right font-semibold">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const closedReason = c.status !== 'active' ? null
                  : !c.accepting_applications ? 'Closed'
                  : c.application_deadline && c.application_deadline < today ? 'Deadline passed'
                  : null
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/courses/${c.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">{c.name}</Link>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{c.code}</span>{c.category ? ` · ${c.category}` : ''}
                        {c.study_modes.length > 0 ? ` · ${c.study_modes.map(studyModeLabel).join(', ')}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3"><CourseStatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs">
                      {c.status !== 'active' ? <span className="text-muted-foreground">Not shown</span>
                        : closedReason ? <span className="font-medium text-amber-700">{closedReason}</span>
                        : <span className="font-medium text-success">Open{c.application_deadline ? ` until ${formatDate(c.application_deadline)}` : ''}</span>}
                      {c.open_intake_count > 0 && <p className="text-muted-foreground">{c.open_intake_count} open intake{c.open_intake_count === 1 ? '' : 's'}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.current_price ? formatMoney(c.current_price.total, c.current_price.currency) : <span className="text-amber-700">Not set</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/applications?course=${c.id}`} className="hover:text-primary hover:underline">{c.application_count}</Link>
                      {c.pending_count > 0 && <p className="text-xs text-muted-foreground">{c.pending_count} pending</p>}
                    </td>
                    <td className="px-4 py-3 text-right">{c.enrolled_count}{c.capacity ? ` / ${c.capacity}` : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  )
}
