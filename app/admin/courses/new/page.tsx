import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireStaffPage } from '@/lib/auth'
import { CourseForm } from '@/components/admin/course-editor'
import { DataCard, PageHeader, PageShell } from '@/components/admin/ui'

export const metadata = { title: 'New course — KTI Admin' }

export default async function NewCoursePage() {
  await requireStaffPage('courses.manage')
  return (
    <PageShell>
      <Link href="/admin/courses" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All courses
      </Link>
      <PageHeader title="New course" description="Save as Draft while you set fees and intakes, then activate it to show it on the application form." />
      <div className="max-w-3xl">
        <DataCard title="Course details">
          <CourseForm
            canEdit
            initial={{
              code: '', name: '', description: '', category: '', qualification_type: '', duration: '',
              requirements: '', study_modes: [], status: 'draft', accepting_applications: true,
              application_deadline: '', capacity: '', sort_order: '0',
            }}
          />
        </DataCard>
      </div>
    </PageShell>
  )
}
