/**
 * Public website text, editable in Admin > Website content.
 * Stored as one JSON document in `kti_site_content`; anything missing
 * falls back to these defaults (the text the site shipped with).
 */

export interface SiteContent {
  announcement: { enabled: boolean; text: string; link_label: string; link_url: string }
  hero: {
    badge: string
    title_main: string
    title_accent: string
    tagline: string
    description: string
    button_label: string
    highlights: string[]
  }
  requirements: {
    enabled: boolean
    title: string
    intro: string
    items: { title: string; description: string }[]
  }
  contact: {
    footer_blurb: string
    phone: string
    email: string
    address: string
  }
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  announcement: { enabled: false, text: '', link_label: '', link_url: '' },
  hero: {
    badge: 'Applications are open for 2026',
    title_main: "Ken's Training",
    title_accent: 'Institute',
    tagline: 'Equipping People Through Knowledge, Faith and Purpose',
    description:
      "Ken's Training Institute provides structured theological programmes designed to equip individuals with knowledge, skills, and spiritual development — preparing them to serve with confidence and purpose.",
    button_label: 'Start Your Application',
    highlights: ['Accredited Programmes', 'Flexible Learning', 'Christian-Based Education'],
  },
  requirements: {
    enabled: true,
    title: 'Documents & Forms You May Need',
    intro:
      'Depending on your programme, you may be asked for the following as part of your application. Not sure what applies to you? Contact our admissions team before you apply.',
    items: [
      {
        title: 'Proof of Payment (POP)',
        description:
          'Upload your proof of payment when submitting your application, showing the registration or programme fee has been paid.',
      },
      {
        title: 'ACRP Applications',
        description:
          'Applicants applying under an ACRP-linked programme should include their ACRP application documentation alongside their admission form.',
      },
      {
        title: 'Form 30 Applications',
        description:
          'Where a Form 30 is required for your chosen programme, please complete and attach it as part of your application documents.',
      },
    ],
  },
  contact: {
    footer_blurb: 'Equipping people of faith for ministry and service. Everyone is welcome to apply.',
    phone: '+27 73 204 7642',
    email: 'kenstraining04@gmail.com',
    address: '',
  },
}

function text(v: unknown, max: number, fallback: string): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback
}

function bool(v: unknown, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback
}

function list(v: unknown, maxItems: number, maxLen: number, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback
  return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems)
}

/** Only allow links to this site or to http(s)/tel/mailto addresses. */
export function safeLink(url: string): string {
  const u = url.trim()
  if (!u) return ''
  if (u.startsWith('/') && !u.startsWith('//')) return u
  if (/^(https?:\/\/|tel:|mailto:)/i.test(u)) return u
  return ''
}

/** Turn anything stored (or submitted by the editor) into complete, safe content. */
export function normalizeSiteContent(input: unknown): SiteContent {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>
  const d = DEFAULT_SITE_CONTENT
  const a = raw.announcement ?? {}
  const h = raw.hero ?? {}
  const r = raw.requirements ?? {}
  const c = raw.contact ?? {}

  const items = Array.isArray(r.items)
    ? r.items
        .filter((i: any) => i && typeof i === 'object')
        .map((i: any) => ({ title: text(i.title, 120, '').trim(), description: text(i.description, 1000, '').trim() }))
        .filter((i: { title: string }) => i.title)
        .slice(0, 12)
    : d.requirements.items

  return {
    announcement: {
      enabled: bool(a.enabled, d.announcement.enabled),
      text: text(a.text, 300, d.announcement.text),
      link_label: text(a.link_label, 60, d.announcement.link_label),
      link_url: safeLink(text(a.link_url, 500, d.announcement.link_url)),
    },
    hero: {
      badge: text(h.badge, 120, d.hero.badge),
      title_main: text(h.title_main, 80, d.hero.title_main),
      title_accent: text(h.title_accent, 80, d.hero.title_accent),
      tagline: text(h.tagline, 200, d.hero.tagline),
      description: text(h.description, 1000, d.hero.description),
      button_label: text(h.button_label, 60, d.hero.button_label).trim() || d.hero.button_label,
      highlights: list(h.highlights, 6, 80, d.hero.highlights),
    },
    requirements: {
      enabled: bool(r.enabled, d.requirements.enabled),
      title: text(r.title, 160, d.requirements.title),
      intro: text(r.intro, 1000, d.requirements.intro),
      items,
    },
    contact: {
      footer_blurb: text(c.footer_blurb, 400, d.contact.footer_blurb),
      phone: text(c.phone, 40, d.contact.phone),
      email: text(c.email, 200, d.contact.email),
      address: text(c.address, 300, d.contact.address),
    },
  }
}

/** "+27 73 204 7642" → "tel:+27732047642" */
export function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}
