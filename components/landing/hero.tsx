import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Check } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TRUST = [
  "Accredited Programmes",
  "Flexible Learning",
  "Christian-Based Education",
]

export function Hero() {
  return (
    <main className="relative flex flex-col items-center overflow-hidden bg-background px-4 pb-24 pt-20 text-center">
      {/* Radial glow behind logo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(52,68,132,0.09),transparent)]"
      />

      {/* Gold top accent line */}
      <div className="absolute left-0 right-0 top-0 h-1 bg-accent" />

      {/* Badge */}
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent-foreground">
        <span className="size-2 shrink-0 rounded-full bg-accent" />
        Applications are open for 2026
      </div>

      {/* Logo */}
      <div className="rounded-2xl border border-border bg-card px-8 py-5 shadow-2xl ring-4 ring-primary/10">
        <Image
          src="/kti-logo.png"
          alt="Ken's Training Institute"
          width={1894}
          height={830}
          className="h-28 w-auto object-contain sm:h-36"
          priority
        />
      </div>

      {/* Headline */}
      <h1 className="mt-8 max-w-2xl font-serif text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
        Ken&apos;s Training{" "}
        <span className="text-accent">Institute</span>
      </h1>

      {/* Tagline */}
      <p className="mt-3 text-lg font-semibold text-primary sm:text-xl">
        Equipping People Through Knowledge, Faith and Purpose
      </p>

      {/* Description */}
      <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
        Ken&apos;s Training Institute provides structured theological programmes
        designed to equip individuals with knowledge, skills, and spiritual
        development — preparing them to serve with confidence and purpose.
      </p>

      {/* CTA */}
      <Link
        href="/apply"
        className={cn(
          buttonVariants(),
          "mt-10 h-16 gap-3 px-12 text-xl font-bold shadow-lg",
        )}
      >
        Start Your Application
        <ArrowRight className="size-6" />
      </Link>

      {/* Trust indicators */}
      <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
        {TRUST.map((label) => (
          <span
            key={label}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <Check className="size-4 shrink-0 text-accent" strokeWidth={2.5} />
            {label}
          </span>
        ))}
      </div>
    </main>
  )
}
