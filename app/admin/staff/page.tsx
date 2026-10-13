import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { ROLE_META, ROLES } from '@/lib/permissions'
import { StaffManager, type StaffRow } from '@/components/admin/staff-manager'
import { DataCard, ErrorState, PageHeader, PageShell } from '@/components/admin/ui'

export const metadata = { title: 'Staff & roles — KTI Admin' }
export const dynamic = 'force-dynamic'

export default async function StaffPage() {
  const me = await requireStaffPage('staff.manage')
  const supabase = await createClient()
  const { data, error } = await supabase.from('staff_users').select('*').order('created_at')

  return (
    <PageShell>
      <PageHeader title="Staff & roles" description="Who can sign in to this dashboard, and what they can do." />
      {error ? <ErrorState message={error.message} /> : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <StaffManager staff={(data ?? []) as StaffRow[]} currentUserId={me.userId} />
          </div>
          <DataCard title="Roles">
            <dl className="flex flex-col gap-3 text-sm">
              {ROLES.map((r) => (
                <div key={r}>
                  <dt className="font-semibold">{ROLE_META[r].label}</dt>
                  <dd className="text-muted-foreground">{ROLE_META[r].description}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Permissions are enforced by the database itself, not just this screen.
            </p>
          </DataCard>
        </div>
      )}
    </PageShell>
  )
}
