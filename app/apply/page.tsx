import { ApplicationWizard } from '@/components/application/wizard'
import { getPublicCatalog } from '@/lib/catalog'

export const metadata = { title: "Apply — Ken's Training Institute" }

// Courses, prices and form settings are managed in the admin dashboard;
// always render with the latest values.
export const dynamic = 'force-dynamic'

export default async function ApplyPage() {
  const { form, courses } = await getPublicCatalog()
  return (
    <div className="min-h-screen bg-secondary px-4 py-10 sm:px-6">
      <ApplicationWizard form={form} courses={courses} />
    </div>
  )
}
