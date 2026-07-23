import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <Link href="/" className="inline-block" aria-label="Home">
          <BrandLogo />
        </Link>
        <div className="mt-6">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-2xl">
            ⚠️
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Authentication error</h1>
          <p className="mt-3 text-muted-foreground">
            Something went wrong with your sign-in link. It may have expired or already been used.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/login" className={cn(buttonVariants(), 'h-11 text-base')}>
              Try signing in again
            </Link>
            <Link href="/forgot-password" className={cn(buttonVariants({ variant: 'outline' }), 'h-11 text-base')}>
              Reset your password
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
