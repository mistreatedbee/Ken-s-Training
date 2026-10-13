import { requireStaffPage } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/admin-sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage()

  return (
    <div className="flex min-h-screen">
      <AdminSidebar adminEmail={staff.email} role={staff.role} />

      {/* Main content */}
      <main id="main-content" className="min-w-0 flex-1 overflow-auto bg-secondary pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
