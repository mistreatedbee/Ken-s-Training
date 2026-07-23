import { UserPlus, FileText, Upload, CheckCircle2 } from "lucide-react"

const STEPS = [
  {
    icon: UserPlus,
    title: "1. Create an account",
    text: "Sign up with your email and a password. This keeps your application safe.",
  },
  {
    icon: FileText,
    title: "2. Fill in your details",
    text: "Answer simple questions about yourself, one page at a time.",
  },
  {
    icon: Upload,
    title: "3. Add your documents",
    text: "Upload your ID, a photo, and proof of payment using your phone or computer.",
  },
  {
    icon: CheckCircle2,
    title: "4. Send and wait",
    text: "Submit your application. We will review it and let you know the outcome.",
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="how-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="how-heading" className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl">
          How to apply in four easy steps
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          You do not need to do everything at once. Take your time.
        </p>
      </div>

      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li key={step.title} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="size-7" />
            </span>
            <h3 className="font-serif text-xl font-semibold text-card-foreground">{step.title}</h3>
            <p className="text-base leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
