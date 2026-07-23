import Link from "next/link"
import { Phone, Mail } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <BrandLogo className="text-sidebar-foreground" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed opacity-80">
            Equipping people of faith for ministry and service. Everyone is welcome to apply.
          </p>
        </div>

        <div>
          <h2 className="font-serif text-lg font-semibold">Contact us</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <Phone className="size-5 shrink-0 text-sidebar-primary" />
              <a href="tel:+27732047642" className="hover:underline">
                +27 73 204 7642
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="size-5 shrink-0 text-sidebar-primary" />
              <a href="mailto:kenstraining04@gmail.com" className="hover:underline">
                kenstraining04@gmail.com
              </a>
            </li>
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
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-xs opacity-70 sm:px-6">
          © {new Date().getFullYear()} Ken&apos;s Training Institute. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
