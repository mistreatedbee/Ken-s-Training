import { Receipt, FileCheck2, FileSignature } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { SiteContent } from "@/lib/site-content"

const ICONS = [Receipt, FileCheck2, FileSignature]

export function Requirements({ content }: { content: SiteContent["requirements"] }) {
  if (!content.enabled || content.items.length === 0) return null
  return (
    <section className="border-t border-border bg-secondary/40 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
            {content.title}
          </h2>
          {content.intro && (
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{content.intro}</p>
          )}
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {content.items.map(({ title, description }, i) => {
            const Icon = ICONS[i % ICONS.length]
            return (
            <Card key={`${i}-${title}`} className="text-center">
              <CardContent className="flex flex-col items-center gap-3 p-6">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <p className="font-serif text-lg font-semibold text-foreground">{title}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
