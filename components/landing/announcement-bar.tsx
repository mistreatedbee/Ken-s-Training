import Link from 'next/link'
import { Megaphone } from 'lucide-react'
import { safeLink, type SiteContent } from '@/lib/site-content'

export function AnnouncementBar({ announcement }: { announcement: SiteContent['announcement'] }) {
  if (!announcement.enabled || !announcement.text.trim()) return null
  const href = safeLink(announcement.link_url)
  return (
    <div role="status" className="bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">
      <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Megaphone className="size-4 shrink-0" aria-hidden="true" />
        <span>{announcement.text}</span>
        {href && announcement.link_label && (
          <Link href={href} className="font-semibold underline underline-offset-2">
            {announcement.link_label}
          </Link>
        )}
      </span>
    </div>
  )
}
