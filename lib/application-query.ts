import type { SupabaseClient } from '@supabase/supabase-js'
import { APPLICATION_STATUSES, OPEN_STATUSES, isApplicationStatus } from '@/lib/statuses'

export interface ApplicationFilters {
  q?: string
  status?: string
  course?: string
  intake?: string
  from?: string
  to?: string
  archived?: string
  sort?: string
  page?: string
}

export const SORTS: Record<string, { label: string; column: string; ascending: boolean }> = {
  newest:    { label: 'Newest first',   column: 'submitted_at',   ascending: false },
  oldest:    { label: 'Oldest first',   column: 'submitted_at',   ascending: true },
  name_asc:  { label: 'Name A–Z',       column: 'applicant_name', ascending: true },
  name_desc: { label: 'Name Z–A',       column: 'applicant_name', ascending: false },
  status:    { label: 'Status',         column: 'status',         ascending: true },
  reference: { label: 'Reference',      column: 'student_number', ascending: true },
}

export const STATUS_GROUPS: Record<string, string[]> = {
  open: OPEN_STATUSES,
  closed: ['rejected', 'withdrawn'],
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/

/** Escape LIKE wildcards so user input is matched literally. */
function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Apply list filters to an `applications` query. Used by the list page
 * and the CSV export so both always return the same records.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyApplicationFilters<Q extends { [k: string]: any }>(query: Q, f: ApplicationFilters): Q {
  let q = query
  const term = f.q?.trim().toLowerCase().slice(0, 100)
  if (term) q = q.ilike('search_text', `%${likeEscape(term)}%`)

  if (f.status && STATUS_GROUPS[f.status]) q = q.in('status', STATUS_GROUPS[f.status])
  else if (f.status && isApplicationStatus(f.status)) q = q.eq('status', f.status)

  if (f.course === 'none') q = q.is('course_id', null)
  else if (f.course && UUID.test(f.course)) q = q.eq('course_id', f.course)
  if (f.intake && UUID.test(f.intake)) q = q.eq('intake_id', f.intake)

  if (f.from && DATE.test(f.from)) q = q.gte('submitted_at', `${f.from}T00:00:00`)
  if (f.to && DATE.test(f.to)) {
    const end = new Date(`${f.to}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    q = q.lt('submitted_at', end.toISOString())
  }

  if (f.archived === 'only') q = q.not('archived_at', 'is', null)
  else if (f.archived !== 'include') q = q.is('archived_at', null)

  const sort = SORTS[f.sort ?? ''] ?? SORTS.newest
  q = q.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
  if (sort.column !== 'submitted_at') q = q.order('submitted_at', { ascending: false })
  return q
}

export const LIST_COLUMNS =
  'id, student_number, applicant_name, status, submitted_at, programme, course_id, intake_id, study_mode, contact_details, archived_at, courses:kti_courses(name), intakes(name)'

export async function countByStatus(supabase: SupabaseClient, f: ApplicationFilters) {
  // Counts for the status chips: same filters except status.
  const results = await Promise.all(
    APPLICATION_STATUSES.map(async (status) => {
      const base = supabase.from('applications').select('id', { count: 'exact', head: true })
      const { count } = await applyApplicationFilters(base, { ...f, status, sort: undefined })
      return [status, count ?? 0] as const
    }),
  )
  return Object.fromEntries(results) as Record<string, number>
}
