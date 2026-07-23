import Link from 'next/link'
import { CheckCircle2, Clock, FileText, Search, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Application } from '@/lib/types'

export const metadata = { title: 'Applications — KTI Admin' }

const STATUS_META = {
  draft:        { label: 'Draft',        variant: 'secondary' as const },
  submitted:    { label: 'Submitted',    variant: 'default' as const },
  under_review: { label: 'Under review', variant: 'warning' as const },
  approved:     { label: 'Approved',     variant: 'success' as const },
  rejected:     { label: 'Rejected',     variant: 'destructive' as const },
}

interface SearchParams { status?: string; q?: string }

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { status, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('applications')
    .select(`
      id, student_number, status, submitted_at, created_at,
      personal_info, programme_selection,
      profiles!profile_id(full_name),
      programmes(name)
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)

  const { data: applications } = await query

  // Client-side filter by name / student number
  const filtered = (applications ?? []).filter((app) => {
    if (!q) return true
    const name = ((app.profiles as { full_name?: string })?.full_name ?? '').toLowerCase()
    const sn = (app.student_number ?? '').toLowerCase()
    const search = q.toLowerCase()
    return name.includes(search) || sn.includes(search)
  })

  const counts = (applications ?? []).reduce<Record<string, number>>((acc, app) => {
    acc[app.status] = (acc[app.status] ?? 0) + 1
    return acc
  }, {})

  const statusFilters = [
    { value: 'all', label: 'All', count: (applications ?? []).length },
    { value: 'submitted', label: 'Submitted', count: counts.submitted ?? 0 },
    { value: 'under_review', label: 'Under review', count: counts.under_review ?? 0 },
    { value: 'approved', label: 'Approved', count: counts.approved ?? 0 },
    { value: 'rejected', label: 'Rejected', count: counts.rejected ?? 0 },
    { value: 'draft', label: 'Drafts', count: counts.draft ?? 0 },
  ]

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-foreground">Applications</h1>
        <p className="mt-1 text-muted-foreground">{(applications ?? []).length} total applications</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <Link
              key={f.value}
              href={`/admin?status=${f.value}${q ? `&q=${q}` : ''}`}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                (status ?? 'all') === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {f.label}
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{f.count}</span>
            </Link>
          ))}
        </div>

        {/* Search */}
        <form method="GET" className="relative">
          <input type="hidden" name="status" value={status ?? 'all'} />
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or student number…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50 sm:w-72"
          />
        </form>
      </div>

      {/* Application cards */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="mx-auto size-12 text-muted-foreground/40" />
          <p className="mt-3 font-serif text-lg font-semibold text-foreground">No applications found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((app) => {
            const meta = STATUS_META[app.status as keyof typeof STATUS_META]
            const pi = app.personal_info as { first_name?: string; last_name?: string } | null
            const name =
              (app.profiles as { full_name?: string })?.full_name ??
              (pi ? `${pi.first_name ?? ''} ${pi.last_name ?? ''}`.trim() : 'Unknown')
            const programme = (app.programmes as { name?: string })?.name ?? '—'

            return (
              <Link key={app.id} href={`/admin/applications/${app.id}`}>
                <Card className="transition hover:shadow-md hover:border-primary/40 cursor-pointer">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-4">
                      <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                        {name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{name}</p>
                        <p className="text-sm text-muted-foreground">{programme}</p>
                        <p className="text-xs text-muted-foreground font-mono">{app.student_number}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(app.created_at).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
