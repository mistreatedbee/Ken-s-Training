import { Users, BookOpen, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Students — KTI Admin' }

export default async function StudentsPage() {
  const supabase = await createClient()

  const [studentsResult] = await Promise.allSettled([
    supabase
      .from('students')
      .select('*')
      .order('joined_date', { ascending: false }),
  ])

  if (studentsResult.status === 'rejected') {
    return (
      <div className="px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">Students</h1>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800">Database migration required</p>
            <p className="mt-1 text-sm text-amber-700">
              Run{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                supabase/migrations/20260729_remove_church_add_students.sql
              </code>{' '}
              in your Supabase SQL Editor to enable the Students module.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const students = studentsResult.value.data ?? []

  // Group by programme
  const grouped = new Map<string, typeof students>()
  for (const s of students) {
    const key = s.programme?.trim() || 'Uncategorised'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(s)
  }

  // Sort: named programmes first, Uncategorised last
  const sorted = [...grouped.entries()].sort(([a], [b]) => {
    if (a === 'Uncategorised') return 1
    if (b === 'Uncategorised') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-foreground">Students</h1>
        <p className="mt-1 text-muted-foreground">
          {students.length} student{students.length !== 1 ? 's' : ''} across {sorted.length} programme{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Users className="mx-auto size-12 text-muted-foreground/40" />
          <p className="mt-3 font-serif text-lg font-semibold text-foreground">No students yet</p>
          <p className="mt-1 text-muted-foreground">
            Approved applicants will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sorted.map(([programme, group]) => (
            <div key={programme}>
              <div className="mb-4 flex items-center gap-3 border-b border-border pb-2">
                <BookOpen className="size-5 text-primary" />
                <h2 className="font-serif text-xl font-semibold text-foreground">{programme}</h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary">
                  {group.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {group.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="flex items-center gap-4">
                        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                          {student.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{student.full_name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{student.student_number}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant={student.status === 'active' ? 'success' : student.status === 'suspended' ? 'warning' : 'default'}>
                          {student.status}
                        </Badge>
                        {student.phone && (
                          <a
                            href={`https://wa.me/${student.phone.replace(/\D/g, '').replace(/^0/, '27')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#25D366] hover:underline"
                          >
                            {student.phone}
                          </a>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Joined {new Date(student.joined_date).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
