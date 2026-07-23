import { UserPlus, FileText, Upload, CheckCircle2 } from "lucide-react"

const STEPS = [
  {
    icon: UserPlus,
    number: "01",
    title: "Create an account",
    text: "Sign up with your email and a password. It takes less than two minutes and keeps your progress safe.",
  },
  {
    icon: FileText,
    number: "02",
    title: "Fill in your details",
    text: "Answer simple questions about yourself, one page at a time. You can save and come back later.",
  },
  {
    icon: Upload,
    number: "03",
    title: "Upload your documents",
    text: "Attach your ID, a photo, and your matric certificate. You can use your phone camera.",
  },
  {
    icon: CheckCircle2,
    number: "04",
    title: "Submit and wait",
    text: "Send your application. We will review it and contact you within 5 working days.",
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="how-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent-foreground">
          The application process
        </p>
        <h2 id="how-heading" className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl">
          Apply in four easy steps
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          You do not need to do everything at once. Take your time — your progress is always saved.
        </p>
      </div>

      <ol className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Connecting line (desktop only) */}
        <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-border lg:block" aria-hidden />

        {STEPS.map((step) => (
          <li key={step.number} className="relative flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
            {/* Step number badge */}
            <div className="flex items-center gap-3">
              <span className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card">
                <step.icon className="size-6 text-primary" />
              </span>
              <span className="font-mono text-2xl font-bold text-border">{step.number}</span>
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-card-foreground">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Time reassurance */}
      <p className="mt-8 text-center text-base font-medium text-muted-foreground">
        The whole process takes about <span className="font-semibold text-foreground">15 minutes</span> to complete.
      </p>
    </section>
  )
}
