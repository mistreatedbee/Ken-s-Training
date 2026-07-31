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
    <section className="relative overflow-hidden bg-background">
      {/* Subtle gold bloom behind image */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_55%_at_80%_25%,rgba(212,165,39,0.07),transparent)]"
      />
      {/* Subtle navy glow top-left behind headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_45%_at_5%_0%,rgba(52,68,132,0.07),transparent)]"
      />

      {/* Gold top accent line */}
      <div className="h-1 w-full bg-accent" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-24">

        {/* ── Left: Copy ── */}
        <div className="flex flex-col gap-8">

          {/* Badge */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent-foreground">
            <span className="size-2 shrink-0 rounded-full bg-accent" />
            Applications are open for 2026
          </div>

          {/* Headline */}
          <h1 className="text-balance font-serif text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
            Equipping People Through Knowledge,{" "}
            <span className="text-accent">Faith and Purpose</span>
          </h1>

          {/* Description */}
          <p className="max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            Ken&apos;s Training Institute provides structured theological
            programmes designed to equip individuals with knowledge, skills, and
            spiritual development — preparing them to serve with confidence and
            purpose.
          </p>

          {/* CTA */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/apply"
              className={cn(
                buttonVariants(),
                "h-14 gap-2 px-8 text-lg font-semibold shadow-md",
              )}
            >
              Start Your Application
              <ArrowRight className="size-5" />
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
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
        </div>

        {/* ── Right: Image ── */}
        <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
          {/* Gold accent ring offset behind image */}
          <div className="absolute -right-3 -top-3 h-full w-full rounded-3xl border-2 border-accent/35" />
          {/* Soft gold glow bloom */}
          <div
            aria-hidden
            className="absolute -right-10 -top-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] rounded-full bg-[rgba(212,165,39,0.05)] blur-3xl"
          />

          <div className="relative overflow-hidden rounded-3xl border border-border shadow-2xl">
            <Image
              src="/kti-hero.png"
              alt="Students engaged in training and spiritual development at Ken's Training Institute"
              width={720}
              height={560}
              className="h-full w-full object-cover"
              priority
            />
            {/* Gradient overlay quote */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-6 py-6">
              <p className="font-serif text-base font-semibold italic text-white/90">
                &ldquo;Equipping people of faith for ministry and service.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
