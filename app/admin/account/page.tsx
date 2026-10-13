import { requireStaffPage } from '@/lib/auth'
import { ROLE_META } from '@/lib/permissions'
import { ChangePasswordForm } from '@/components/admin/change-password'
import { DataCard, PageHeader, PageShell, Row } from '@/components/admin/ui'

export const metadata = { title: 'My account — KTI Admin' }

export default async function AccountPage() {
  const me = await requireStaffPage()
  return (
    <PageShell>
      <PageHeader title="My account" />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <DataCard title="Details">
          <dl className="flex flex-col gap-3">
            <Row label="Email">{me.email}</Row>
            {me.fullName && <Row label="Name">{me.fullName}</Row>}
            <Row label="Role">{ROLE_META[me.role].label}</Row>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">{ROLE_META[me.role].description}</p>
        </DataCard>
        <DataCard title="Change password">
          <ChangePasswordForm />
        </DataCard>
      </div>
    </PageShell>
  )
}
