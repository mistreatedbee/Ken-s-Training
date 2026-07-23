import Link from "next/link"
import { Phone, ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function HelpCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
        <h2 className="text-balance font-serif text-3xl font-bold sm:text-4xl">Ready to begin your journey?</h2>
        <p className="max-w-2xl text-pretty text-lg leading-relaxed opacity-90">
          Start your application today. If you need help at any point, our friendly admissions team is here for you.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/apply"
            className={cn(buttonVariants({ variant: "secondary" }), "h-14 gap-2 px-6 text-lg font-semibold")}
          >
            Start your application
            <ArrowRight className="size-5" />
          </Link>
          <a
            href="tel:+27732047642"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-14 gap-2 border-primary-foreground/30 bg-transparent px-6 text-lg text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
            )}
          >
            <Phone className="size-5" />
            Call us for help
          </a>
        </div>
      </div>
    </section>
  )
}
