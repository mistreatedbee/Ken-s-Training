import Link from "next/link"
import { BookOpenText, Cross, ScrollText, ArrowRight, Clock } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PROGRAMMES = [
  {
    icon: Cross,
    title: "Certificate in Theology",
    duration: "1 year",
    level: "Foundation",
    text: "A foundation in Scripture, faith, and Christian ministry. Ideal for beginners seeking to grow in their understanding of the faith and serve their community.",
    highlight: false,
  },
  {
    icon: BookOpenText,
    title: "Diploma in Ministry",
    duration: "2 years",
    level: "Intermediate",
    text: "A deeper two-year programme preparing you to lead and serve effectively in your church and community with practical ministry skills.",
    highlight: true,
  },
  {
    icon: ScrollText,
    title: "Bachelor of Theology",
    duration: "3 years",
    level: "Degree",
    text: "A full undergraduate degree for those called to pastoral leadership, teaching, or academic theological study across all disciplines.",
    highlight: false,
  },
]

export function Programmes() {
  return (
    <section className="bg-secondary" aria-labelledby="programmes-heading">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            Our programmes
          </p>
          <h2
            id="programmes-heading"
            className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl"
          >
            What you can study
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Choose the programme that fits your calling. Not sure? Our admissions team will help you decide.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PROGRAMMES.map((p) => (
            <article
              key={p.title}
              className={cn(
                "relative flex flex-col gap-5 rounded-2xl border p-7 transition-shadow hover:shadow-md",
                p.highlight
                  ? "border-primary bg-primary text-primary-foreground shadow-lg"
                  : "border-border bg-card",
              )}
            >
              {p.highlight && (
                <span className="absolute right-5 top-5 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-accent-foreground">
                  Most popular
                </span>
              )}

              <span
                className={cn(
                  "flex size-14 items-center justify-center rounded-full",
                  p.highlight ? "bg-primary-foreground/15" : "bg-primary/10",
                )}
              >
                <p.icon
                  className={cn("size-7", p.highlight ? "text-primary-foreground" : "text-primary")}
                />
              </span>

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-full px-3 py-0.5 text-xs font-semibold",
                    p.highlight
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-accent/20 text-accent-foreground",
                  )}
                >
                  {p.level}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    p.highlight ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  <Clock className="size-3.5" />
                  {p.duration}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                <h3
                  className={cn(
                    "font-serif text-xl font-semibold",
                    p.highlight ? "text-primary-foreground" : "text-card-foreground",
                  )}
                >
                  {p.title}
                </h3>
                <p
                  className={cn(
                    "flex-1 text-base leading-relaxed",
                    p.highlight ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {p.text}
                </p>
              </div>

              <Link
                href="/apply"
                className={cn(
                  buttonVariants({ variant: p.highlight ? "secondary" : "outline" }),
                  "mt-1 h-11 gap-2 text-base font-semibold",
                  !p.highlight && "border-border",
                )}
              >
                Apply for this programme
                <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
