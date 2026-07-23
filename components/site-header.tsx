import Link from 'next/link'
import { LogIn, ArrowRight, LayoutDashboard, Shield } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

export async function SiteHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    role = data?.role ?? null
  }

  const isAdmin = role === 'admin' || role === 'reviewer'

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-foreground" aria-label="Ken's Training Institute home">
          <BrandLogo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main">
          {user ? (
            <>
              {isAdmin ? (
                <Link href="/admin" className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 gap-2 text-base')}>
                  <Shield className="size-5" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              ) : (
                <Link href="/dashboard" className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 gap-2 text-base')}>
                  <LayoutDashboard className="size-5" />
                  <span className="hidden sm:inline">My application</span>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 gap-2 text-base')}>
                <LogIn className="size-5" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
              <Link href="/apply" className={cn(buttonVariants(), 'h-11 gap-2 px-5 text-base font-semibold')}>
                Apply now
                <ArrowRight className="size-5" />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
