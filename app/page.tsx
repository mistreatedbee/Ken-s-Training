import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Programmes } from "@/components/landing/programmes"
import { HelpCta } from "@/components/landing/help-cta"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <Hero />
        <HowItWorks />
        <Programmes />
        <HelpCta />
      </main>
      <SiteFooter />
    </div>
  )
}
