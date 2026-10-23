import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { StudentsManager, type StudentRow } from '@/components/admin/students-manager'
import { ErrorState, PageHeader, PageShell } from '@/components/admin/ui'

export const metadata = { title: 'Students — KTI Admin' }
export const dynamic = 'force-dynamic'

export default async function StudentsPage() {
  const staff = await requireStaffPage()
  const supabase = await createClient()

  const [studentsRes, coursesRes] = await Promise.all([
    supabase.from('students').select('*, courses:kti_courses(name)').order('joined_date', { ascending: false }),
    supabase.from('kti_courses').select('id, name, status').order('sort_order').order('name'),
  ])

  return (
    <PageShell>
      <PageHeader
        title="Students"
        description="Everyone accepted onto a course, plus students added by hand. Search, update details and status, and keep notes."
      />
      {studentsRes.error ? (
        <ErrorState title="Couldn't load students" message={studentsRes.error.message} />
      ) : (
        <StudentsManager
          students={(studentsRes.data ?? []) as StudentRow[]}
          courses={coursesRes.data ?? []}
          canEdit={can(staff.role, 'applications.update')}
          canExport={can(staff.role, 'applications.export')}
        />
      )}
    </PageShell>
  )
}
