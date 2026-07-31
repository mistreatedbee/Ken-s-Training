import { SiteFooter } from "@/components/site-footer"
import { Hero } from "@/components/landing/hero"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div id="main-content" className="flex-1">
        <Hero />
      </div>
      <SiteFooter />
    </div>
  )
}
