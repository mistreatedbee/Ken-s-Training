import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, FileText, LogOut } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin',          label: 'Applications', icon: FileText },
  { href: '/admin/reports',  label: 'Reports',      icon: BarChart3 },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminEmail = user.email ?? 'Admin'
  const initials = adminEmail.slice(0, 2).toUpperCase()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <Link href="/" aria-label="Home">
            <BrandLogo className="text-sidebar-foreground" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Admin navigation">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-foreground',
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {initials}
            </div>
            <p className="min-w-0 truncate text-sm font-medium text-sidebar-foreground">{adminEmail}</p>
          </div>
          <form action="/auth/signout" method="POST">
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto bg-secondary">
        {children}
      </main>
    </div>
  )
}
