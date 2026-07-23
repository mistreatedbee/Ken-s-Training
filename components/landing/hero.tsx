import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Clock, HandHeart } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Hero() {
  return (
    <section className="bg-secondary">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent/20 px-4 py-1.5 text-sm font-semibold text-accent-foreground">
            <HandHeart className="size-4" />
            Applications are open
          </span>
          <h1 className="text-balance font-serif text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            Study theology. Answer your calling.
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Applying to Ken&apos;s Training Institute is simple. We guide you through one clear step at a time. No
            experience with computers needed.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/apply" className={cn(buttonVariants(), "h-14 gap-2 px-6 text-lg font-semibold")}>
              Start your application
              <ArrowRight className="size-5" />
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline" }), "h-14 px-6 text-lg")}
            >
              Continue where you left off
            </Link>
          </div>
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <Clock className="size-5 shrink-0 text-primary" />
            It takes about 15 minutes. You can save and finish later.
          </p>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl border border-border shadow-lg">
            <Image
              src="/kti-hero.png"
              alt="Students of different ages smiling together outside the Ken's Training Institute campus"
              width={720}
              height={560}
              className="h-full w-full object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}
