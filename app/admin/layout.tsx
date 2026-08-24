import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/admin-sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminEmail = user.email ?? 'Admin'

  return (
    <div className="flex min-h-screen">
      <AdminSidebar adminEmail={adminEmail} />

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto bg-secondary pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
