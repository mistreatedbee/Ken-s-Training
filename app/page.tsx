import { SiteFooter } from "@/components/site-footer"
import { Hero } from "@/components/landing/hero"
import { Requirements } from "@/components/landing/requirements"
import { AnnouncementBar } from "@/components/landing/announcement-bar"
import { getSiteContent } from "@/lib/site-content-server"

// Website text is edited in Admin > Website content; always show the latest.
export const dynamic = "force-dynamic"

export default async function HomePage() {
  const content = await getSiteContent()
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar announcement={content.announcement} />
      <div id="main-content" className="flex-1">
        <Hero content={content.hero} />
        <Requirements content={content.requirements} />
      </div>
      <SiteFooter contact={content.contact} />
    </div>
  )
}
