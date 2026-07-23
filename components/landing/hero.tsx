import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Clock, ShieldCheck, Users } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TRUST = [
  { icon: Users, label: "500+ graduates" },
  { icon: ShieldCheck, label: "Accredited programmes" },
  { icon: Clock, label: "Study at your own pace" },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-secondary">
      {/* Decorative top border in gold */}
      <div className="h-1 w-full bg-accent" />

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
        {/* Copy */}
        <div className="flex flex-col gap-7">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-4 py-1.5 text-sm font-semibold text-accent-foreground">
            <span className="size-2 rounded-full bg-accent" />
            Applications are open for 2026
          </div>

          <h1 className="text-balance font-serif text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
            Study theology.<br />
            <span className="text-primary">Answer your calling.</span>
          </h1>

          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Applying to Ken&apos;s Training Institute is simple — we guide you one clear step at a time.
            No computer experience needed.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/apply" className={cn(buttonVariants(), "h-14 gap-2 px-7 text-lg font-semibold shadow-md")}>
              Start your application
              <ArrowRight className="size-5" />
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
            {TRUST.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="size-4 shrink-0 text-primary" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Image */}
        <div className="relative">
          {/* Gold accent ring behind image */}
          <div className="absolute -right-4 -top-4 h-full w-full rounded-3xl border-2 border-accent/30" />
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-xl">
            <Image
              src="/kti-hero.png"
              alt="Students of different ages smiling together outside the Ken's Training Institute campus"
              width={720}
              height={560}
              className="h-full w-full object-cover"
              priority
            />
            {/* Overlay caption */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-6 py-5">
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
