import { BookOpenText, Cross, ScrollText } from "lucide-react"

const PROGRAMMES = [
  {
    icon: Cross,
    title: "Certificate in Theology",
    text: "A one-year foundation in Scripture, faith, and ministry. Perfect for beginners.",
  },
  {
    icon: BookOpenText,
    title: "Diploma in Ministry",
    text: "A two-year programme preparing you to lead and serve in your church and community.",
  },
  {
    icon: ScrollText,
    title: "Bachelor of Theology",
    text: "A full degree for deeper study, teaching, and pastoral leadership.",
  },
]

export function Programmes() {
  return (
    <section className="bg-secondary" aria-labelledby="programmes-heading">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="programmes-heading"
            className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl"
          >
            What you can study
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Choose the programme that fits your calling. You can ask us for help deciding.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROGRAMMES.map((p) => (
            <article key={p.title} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
                <p.icon className="size-7" />
              </span>
              <h3 className="font-serif text-xl font-semibold text-card-foreground">{p.title}</h3>
              <p className="text-base leading-relaxed text-muted-foreground">{p.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
