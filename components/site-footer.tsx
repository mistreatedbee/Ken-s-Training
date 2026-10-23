import Link from "next/link"
import { Phone, Mail, MapPin } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { telHref, type SiteContent } from "@/lib/site-content"

export function SiteFooter({ contact }: { contact: SiteContent["contact"] }) {
  return (
    <footer className="border-t border-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <BrandLogo className="text-sidebar-foreground" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed opacity-80">
            {contact.footer_blurb}
          </p>
        </div>

        <div>
          <h2 className="font-serif text-lg font-semibold">Contact us</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {contact.phone && (
              <li className="flex items-center gap-3">
                <Phone className="size-5 shrink-0 text-sidebar-primary" />
                <a href={telHref(contact.phone)} className="hover:underline">{contact.phone}</a>
              </li>
            )}
            {contact.email && (
              <li className="flex items-center gap-3">
                <Mail className="size-5 shrink-0 text-sidebar-primary" />
                <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
              </li>
            )}
            {contact.address && (
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-sidebar-primary" />
                <span className="whitespace-pre-line">{contact.address}</span>
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="font-serif text-lg font-semibold">Quick links</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li>
              <Link href="/apply" className="hover:underline">
                Start an application
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:underline">
                Staff &amp; admin sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sidebar-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/login"
            className="rounded-lg border border-sidebar-border px-3 py-1.5 text-xs font-medium opacity-60 transition hover:opacity-100"
          >
            Admin login
          </Link>
          <p className="text-xs opacity-70">
            © {new Date().getFullYear()} Ken&apos;s Training Institute. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
