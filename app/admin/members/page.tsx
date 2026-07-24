import { Users, BookOpen, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Members — KTI Admin' }

export default async function MembersPage() {
  const supabase = await createClient()

  const [membersResult] = await Promise.allSettled([
    supabase
      .from('members')
      .select('*')
      .order('joined_date', { ascending: false }),
  ])

  if (membersResult.status === 'rejected') {
    return (
      <div className="px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">Members</h1>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800">Database migration required</p>
            <p className="mt-1 text-sm text-amber-700">
              Run{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                supabase/migrations/20240102_whatsapp_members.sql
              </code>{' '}
              in your Supabase SQL Editor to enable the Members module.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const members = membersResult.value.data ?? []

  // Group by programme
  const grouped = new Map<string, typeof members>()
  for (const m of members) {
    const key = m.programme?.trim() || 'Uncategorised'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(m)
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
        <h1 className="font-serif text-3xl font-bold text-foreground">Members</h1>
        <p className="mt-1 text-muted-foreground">
          {members.length} member{members.length !== 1 ? 's' : ''} across {sorted.length} programme{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Users className="mx-auto size-12 text-muted-foreground/40" />
          <p className="mt-3 font-serif text-lg font-semibold text-foreground">No members yet</p>
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
                {group.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="flex items-center gap-4">
                        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                          {member.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{member.full_name}</p>
                          <p className="text-sm text-muted-foreground">{member.church ?? '—'}</p>
                          <p className="font-mono text-xs text-muted-foreground">{member.member_number}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant={member.status === 'active' ? 'success' : member.status === 'suspended' ? 'warning' : 'default'}>
                          {member.status}
                        </Badge>
                        {member.phone && (
                          <a
                            href={`https://wa.me/${member.phone.replace(/\D/g, '').replace(/^0/, '27')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#25D366] hover:underline"
                          >
                            {member.phone}
                          </a>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Joined {new Date(member.joined_date).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
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
