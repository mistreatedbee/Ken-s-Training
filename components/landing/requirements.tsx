import { Receipt, FileCheck2, FileSignature } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const REQUIREMENTS = [
  {
    icon: Receipt,
    title: "Proof of Payment (POP)",
    description:
      "Upload your proof of payment when submitting your application, showing the registration or programme fee has been paid.",
  },
  {
    icon: FileCheck2,
    title: "ACRP Applications",
    description:
      "Applicants applying under an ACRP-linked programme should include their ACRP application documentation alongside their admission form.",
  },
  {
    icon: FileSignature,
    title: "Form 30 Applications",
    description:
      "Where a Form 30 is required for your chosen programme, please complete and attach it as part of your application documents.",
  },
]

export function Requirements() {
  return (
    <section className="border-t border-border bg-secondary/40 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Documents &amp; Forms You May Need
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Depending on your programme, you may be asked for the following as part of your application.
            Not sure what applies to you? Contact our admissions team before you apply.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {REQUIREMENTS.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="text-center">
              <CardContent className="flex flex-col items-center gap-3 p-6">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <p className="font-serif text-lg font-semibold text-foreground">{title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
