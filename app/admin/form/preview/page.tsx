import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { getPublicCatalog } from '@/lib/catalog'
import { normalizeConfig } from '@/lib/form-config'
import { ApplicationWizard } from '@/components/application/wizard'

export const metadata = { title: 'Form preview — KTI Admin' }
export const dynamic = 'force-dynamic'

export default async function FormPreviewPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { version } = await searchParams
  await requireStaffPage()
  const supabase = await createClient()
  const { courses, form: published } = await getPublicCatalog()
  let form = published
  if (version !== 'published') {
    const { data } = await supabase.from('form_versions').select('config').eq('status', 'draft').maybeSingle()
    if (data) form = normalizeConfig(data.config)
  }
  return (
    <div className="bg-secondary px-4 py-8 sm:px-6">
      <Link href="/admin/form" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to form editor
      </Link>
      <ApplicationWizard form={form} courses={courses} preview />
    </div>
  )
}
