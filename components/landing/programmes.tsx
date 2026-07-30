import Link from "next/link"
import { ArrowRight, GraduationCap } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COURSE_GROUPS = [
  {
    group: "UP-Endorsed Courses",
    courses: [
      "Pastoral Care Training (Narrative Community-Based)",
      "Starting and Sustaining Community Projects",
      "Crisis and Trauma Support",
      "Early Childhood Development",
      "Peace Building",
      "From Victims to Agents",
      "Narrative Group Counselling (offered by Prof Roelf Schoeman – Centre for Faith and Community)",
    ],
  },
  {
    group: "Other Courses",
    courses: [
      "Moderator (SAQA US 117759)",
      "Assessor (SAQA US 115753)",
      "Facilitator (SAQA US 117871)",
      "Narrative Group Counselling (offered by Apostle Kenny Mokgope)",
      "Praise and Worship Programme",
      "Diploma in Theology",
      "Ordination",
    ],
  },
]

export function Programmes() {
  return (
    <section className="bg-secondary" aria-labelledby="programmes-heading">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            Our courses
          </p>
          <h2
            id="programmes-heading"
            className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl"
          >
            What you can study
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Choose the course that fits your calling. Not sure? Our admissions team will help you decide.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {COURSE_GROUPS.map((g) => (
            <div key={g.group} className="rounded-2xl border border-border bg-card p-7">
              <h3 className="font-serif text-xl font-semibold text-card-foreground">{g.group}</h3>
              <ul className="mt-5 flex flex-col gap-4">
                {g.courses.map((course) => (
                  <li key={course} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <GraduationCap className="size-4 text-primary" />
                    </span>
                    <span className="text-base leading-relaxed text-foreground">{course}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/apply"
            className={cn(buttonVariants(), "h-11 gap-2 px-6 text-base font-semibold")}
          >
            Apply for a course
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
