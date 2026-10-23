import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { DEFAULT_SITE_CONTENT, normalizeSiteContent } from '@/lib/site-content'
import { formatDateTime } from '@/lib/format'
import { WebsiteEditor } from '@/components/admin/website-editor'
import { ErrorState, PageHeader, PageShell } from '@/components/admin/ui'

export const metadata = { title: 'Website content — KTI Admin' }
export const dynamic = 'force-dynamic'

export default async function WebsiteContentPage() {
  await requireStaffPage('content.manage')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('kti_site_content')
    .select('content, updated_at')
    .eq('id', 'site')
    .maybeSingle()

  return (
    <PageShell>
      <PageHeader
        title="Website content"
        description={
          <>
            Change the text on the public website. Saved changes appear on the site straight away.
            {data?.updated_at && <> Last saved {formatDateTime(data.updated_at)}.</>}
          </>
        }
        actions={
          <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            View website
          </a>
        }
      />
      {error || !data ? (
        <ErrorState
          title="Website content isn't set up yet"
          message={error?.message ?? 'Run migration 20261023_site_content_and_students.sql in the Supabase SQL Editor.'}
        />
      ) : (
        <WebsiteEditor initial={normalizeSiteContent(data.content)} defaults={DEFAULT_SITE_CONTENT} />
      )}
    </PageShell>
  )
}
