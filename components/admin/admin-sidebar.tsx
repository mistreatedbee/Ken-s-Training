'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, FileText, LogOut, Menu, MessageCircle, Users, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin',           label: 'Applications', icon: FileText },
  { href: '/admin/students',  label: 'Students',     icon: Users },
  { href: '/admin/whatsapp',  label: 'WhatsApp',     icon: MessageCircle },
  { href: '/admin/reports',   label: 'Reports',      icon: BarChart3 },
]

interface Props {
  adminEmail: string
}

export function AdminSidebar({ adminEmail }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const initials = adminEmail.slice(0, 2).toUpperCase()

  // Close the drawer on navigation
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" aria-label="Home" className="min-w-0">
          <BrandLogo
            src="/kti-header-logo.png"
            imgWidth={1536}
            imgHeight={1024}
            className="text-sidebar-foreground"
            imgClassName="h-7 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out',
          'lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sidebar-border px-5 py-4">
          <Link href="/" aria-label="Home">
            <BrandLogo
              src="/kti-header-logo.png"
              imgWidth={1536}
              imgHeight={1024}
              className="text-sidebar-foreground"
              imgClassName="h-9 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Admin navigation">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
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
    </>
  )
}
