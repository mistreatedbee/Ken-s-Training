import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-foreground" aria-label="Ken's Training Institute home">
          <BrandLogo />
        </Link>
        <Link
          href="/apply"
          className={cn(buttonVariants(), 'h-11 gap-2 px-5 text-base font-semibold')}
        >
          Apply now
          <ArrowRight className="size-5" />
        </Link>
      </div>
    </header>
  )
}
