import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { DEFAULT_FORM_CONFIG, normalizeConfig } from '@/lib/form-config'
import { formatDateTime } from '@/lib/format'
import { FormEditor } from '@/components/admin/form-editor'
import { ErrorState, Notice, PageHeader, PageShell } from '@/components/admin/ui'

export const metadata = { title: 'Application form — KTI Admin' }
export const dynamic = 'force-dynamic'

export default async function FormSettingsPage() {
  const staff = await requireStaffPage()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('form_versions')
    .select('id, status, config, updated_at, published_at')
    .in('status', ['draft', 'published'])
  if (error) {
    return <PageShell><PageHeader title="Application form" /><ErrorState message={error.message} /></PageShell>
  }
  const draft = data?.find((v) => v.status === 'draft')
  const published = data?.find((v) => v.status === 'published')
  const base = draft?.config ?? published?.config ?? DEFAULT_FORM_CONFIG

  return (
    <PageShell>
      <PageHeader
        title="Application form"
        description="Change the questions, documents, dates and messages on the public application form. Courses and fees are managed under Courses & fees."
      />
      <div className="mb-6 flex flex-col gap-2">
        <Notice>
          {published
            ? <>Live version published {formatDateTime(published.published_at)}.</>
            : <>The form is using the built-in defaults (nothing has been published yet).</>}
          {draft && <> You have unpublished changes (last saved {formatDateTime(draft.updated_at)}).</>}
        </Notice>
        {!can(staff.role, 'form.manage') && <Notice tone="warning">Only super administrators can change the form. You can view and preview it.</Notice>}
      </div>
      <FormEditor initial={normalizeConfig(base)} hasDraft={!!draft} canEdit={can(staff.role, 'form.manage')} />
    </PageShell>
  )
}
