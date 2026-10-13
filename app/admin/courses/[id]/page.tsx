import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { can } from '@/lib/permissions'
import {
  CourseForm, CourseStatusActions, IntakesPanel, PricePanel, type IntakeRow, type PriceRow,
} from '@/components/admin/course-editor'
import { CourseStatusBadge, DataCard, Notice, PageHeader, PageShell, StatCard } from '@/components/admin/ui'
import { formatMoney, type PriceQuote } from '@/lib/format'

export const metadata = { title: 'Course — KTI Admin' }
export const dynamic = 'force-dynamic'

export default async function CoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params
  const { created } = await searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const staff = await requireStaffPage()
  const canEdit = can(staff.role, 'courses.manage')
  const supabase = await createClient()

  const [courseRes, pricesRes, intakesRes, appsRes] = await Promise.all([
    supabase.from('course_overview').select('*').eq('id', id).maybeSingle(),
    supabase.from('course_prices').select('*').eq('course_id', id).order('effective_from', { ascending: false }),
    supabase.from('intakes').select('*').eq('course_id', id).order('starts_on', { ascending: true, nullsFirst: false }),
    supabase.from('applications').select('intake_id').eq('course_id', id).not('intake_id', 'is', null),
  ])
  if (courseRes.error) throw new Error(courseRes.error.message)
  const c = courseRes.data
  if (!c) notFound()

  const quote = c.current_price as PriceQuote | null
  const perIntake = new Map<string, number>()
  for (const a of appsRes.data ?? []) perIntake.set(a.intake_id, (perIntake.get(a.intake_id) ?? 0) + 1)
  const intakes: IntakeRow[] = (intakesRes.data ?? []).map((i) => ({ ...i, application_count: perIntake.get(i.id) ?? 0 }))

  return (
    <PageShell>
      <Link href="/admin/courses" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All courses
      </Link>
      <PageHeader
        title={c.name}
        description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{c.code}</span><CourseStatusBadge status={c.status} /></span>}
        actions={canEdit && <CourseStatusActions id={c.id} status={c.status} applicationCount={c.application_count} />}
      />

      {created && <div className="mb-6"><Notice tone="success">Course created as {c.status}. Add fees and intakes below, then activate it when ready.</Notice></div>}
      {c.status === 'active' && !quote && (
        <div className="mb-6"><Notice tone="warning">This course is live but has no fees set — applicants see &ldquo;Fees to be confirmed&rdquo;.</Notice></div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current total fees" value={quote ? formatMoney(quote.total, quote.currency) : 'Not set'} />
        <StatCard label="Applications" value={c.application_count} href={`/admin/applications?course=${c.id}`} />
        <StatCard label="Awaiting decision" value={c.pending_count} href={`/admin/applications?course=${c.id}&status=open`} />
        <StatCard label="Enrolled" value={`${c.enrolled_count}${c.capacity ? ` / ${c.capacity}` : ''}`} hint={c.capacity ? 'Accepted / capacity' : 'No capacity limit'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Course details">
          <CourseForm
            canEdit={canEdit}
            initial={{
              id: c.id, code: c.code, name: c.name, description: c.description ?? '', category: c.category ?? '',
              qualification_type: c.qualification_type ?? '', duration: c.duration ?? '', requirements: c.requirements ?? '',
              study_modes: c.study_modes ?? [], status: c.status, accepting_applications: c.accepting_applications,
              application_deadline: c.application_deadline ?? '', capacity: c.capacity ? String(c.capacity) : '',
              sort_order: String(c.sort_order ?? 0),
            }}
          />
        </DataCard>
        <div className="flex min-w-0 flex-col gap-6">
          <PricePanel courseId={c.id} prices={(pricesRes.data ?? []) as PriceRow[]} currentPriceId={quote?.price_id ?? null} canEdit={canEdit} />
          <IntakesPanel courseId={c.id} intakes={intakes} canEdit={canEdit} />
        </div>
      </div>
    </PageShell>
  )
}
