'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataCard, Field, Notice, fieldClass, textareaClass } from '@/components/admin/ui'
import { saveSiteContent } from '@/app/actions/admin/website'
import type { SiteContent } from '@/lib/site-content'

type Msg = { tone: 'success' | 'error'; text: string } | null

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="h-8 gap-1 text-muted-foreground">
      <RotateCcw className="size-3.5" /> Reset to original
    </Button>
  )
}

export function WebsiteEditor({ initial, defaults }: { initial: SiteContent; defaults: SiteContent }) {
  const router = useRouter()
  const [c, setC] = useState<SiteContent>(initial)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()

  const update = (fn: (draft: SiteContent) => void) => {
    setC((prev) => { const next = structuredClone(prev); fn(next); return next })
    setDirty(true)
    setMsg(null)
  }

  function save() {
    start(async () => {
      const res = await saveSiteContent(c)
      if (!res.ok) { setMsg({ tone: 'error', text: res.error }); return }
      setDirty(false)
      setMsg({ tone: 'success', text: 'Saved. The website now shows your changes.' })
      router.refresh()
    })
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6 pb-24">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <DataCard title="Announcement banner" actions={<ResetButton onClick={() => update((d) => { d.announcement = structuredClone(defaults.announcement) })} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-muted-foreground sm:col-span-2">
            A strip across the top of the homepage — use it for news such as closing dates or new intakes.
          </p>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-primary" checked={c.announcement.enabled}
              onChange={(e) => update((d) => { d.announcement.enabled = e.target.checked })} />
            Show the announcement
          </label>
          <Field label="Message" htmlFor="ann-text" className="sm:col-span-2">
            <input id="ann-text" className={fieldClass} maxLength={300} value={c.announcement.text}
              placeholder="e.g. Applications for the January intake close on 30 November"
              onChange={(e) => update((d) => { d.announcement.text = e.target.value })} />
          </Field>
          <Field label="Link text (optional)" htmlFor="ann-ll">
            <input id="ann-ll" className={fieldClass} maxLength={60} value={c.announcement.link_label}
              placeholder="e.g. Apply now" onChange={(e) => update((d) => { d.announcement.link_label = e.target.value })} />
          </Field>
          <Field label="Link address (optional)" htmlFor="ann-lu" hint="e.g. /apply or https://…">
            <input id="ann-lu" className={fieldClass} maxLength={500} value={c.announcement.link_url}
              onChange={(e) => update((d) => { d.announcement.link_url = e.target.value })} />
          </Field>
        </div>
      </DataCard>

      <DataCard title="Homepage — top section" actions={<ResetButton onClick={() => update((d) => { d.hero = structuredClone(defaults.hero) })} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Small badge above the logo" htmlFor="h-badge" hint="Leave empty to hide" className="sm:col-span-2">
            <input id="h-badge" className={fieldClass} maxLength={120} value={c.hero.badge}
              onChange={(e) => update((d) => { d.hero.badge = e.target.value })} />
          </Field>
          <Field label="Heading" htmlFor="h-t1">
            <input id="h-t1" className={fieldClass} maxLength={80} value={c.hero.title_main}
              onChange={(e) => update((d) => { d.hero.title_main = e.target.value })} />
          </Field>
          <Field label="Heading — highlighted word(s)" htmlFor="h-t2" hint="Shown in gold after the heading">
            <input id="h-t2" className={fieldClass} maxLength={80} value={c.hero.title_accent}
              onChange={(e) => update((d) => { d.hero.title_accent = e.target.value })} />
          </Field>
          <Field label="Tagline" htmlFor="h-tag" className="sm:col-span-2">
            <input id="h-tag" className={fieldClass} maxLength={200} value={c.hero.tagline}
              onChange={(e) => update((d) => { d.hero.tagline = e.target.value })} />
          </Field>
          <Field label="Description" htmlFor="h-desc" className="sm:col-span-2">
            <textarea id="h-desc" rows={3} className={textareaClass} maxLength={1000} value={c.hero.description}
              onChange={(e) => update((d) => { d.hero.description = e.target.value })} />
          </Field>
          <Field label="Button text" htmlFor="h-btn">
            <input id="h-btn" className={fieldClass} maxLength={60} value={c.hero.button_label}
              onChange={(e) => update((d) => { d.hero.button_label = e.target.value })} />
          </Field>
          <Field label="Highlights under the button (one per line)" htmlFor="h-hl" hint="Up to 6">
            <textarea id="h-hl" rows={3} className={textareaClass} value={c.hero.highlights.join('\n')}
              onChange={(e) => update((d) => { d.hero.highlights = e.target.value.split('\n') })} />
          </Field>
        </div>
      </DataCard>

      <DataCard title="Homepage — documents & requirements" actions={<ResetButton onClick={() => update((d) => { d.requirements = structuredClone(defaults.requirements) })} />}>
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={c.requirements.enabled}
              onChange={(e) => update((d) => { d.requirements.enabled = e.target.checked })} />
            Show this section on the homepage
          </label>
          <Field label="Section heading" htmlFor="r-title">
            <input id="r-title" className={fieldClass} maxLength={160} value={c.requirements.title}
              onChange={(e) => update((d) => { d.requirements.title = e.target.value })} />
          </Field>
          <Field label="Introduction" htmlFor="r-intro">
            <textarea id="r-intro" rows={2} className={textareaClass} maxLength={1000} value={c.requirements.intro}
              onChange={(e) => update((d) => { d.requirements.intro = e.target.value })} />
          </Field>
          <ol className="flex flex-col gap-3">
            {c.requirements.items.map((item, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0}
                    onClick={() => update((d) => { d.requirements.items = move(d.requirements.items, i, i - 1) })}><ArrowUp className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === c.requirements.items.length - 1}
                    onClick={() => update((d) => { d.requirements.items = move(d.requirements.items, i, i + 1) })}><ArrowDown className="size-4" /></Button>
                </div>
                <div className="grid flex-1 gap-3">
                  <Field label="Title" htmlFor={`ri-t-${i}`}>
                    <input id={`ri-t-${i}`} className={fieldClass} maxLength={120} value={item.title}
                      onChange={(e) => update((d) => { d.requirements.items[i].title = e.target.value })} />
                  </Field>
                  <Field label="Description" htmlFor={`ri-d-${i}`}>
                    <textarea id={`ri-d-${i}`} rows={2} className={textareaClass} maxLength={1000} value={item.description}
                      onChange={(e) => update((d) => { d.requirements.items[i].description = e.target.value })} />
                  </Field>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.title || 'item'}`}
                  onClick={() => update((d) => { d.requirements.items.splice(i, 1) })}><Trash2 className="size-4" /></Button>
              </li>
            ))}
          </ol>
          <Button variant="outline" size="sm" className="h-9 gap-1 self-start"
            onClick={() => update((d) => { d.requirements.items.push({ title: '', description: '' }) })}>
            <Plus className="size-4" /> Add item
          </Button>
        </div>
      </DataCard>

      <DataCard title="Contact details (website footer)" actions={<ResetButton onClick={() => update((d) => { d.contact = structuredClone(defaults.contact) })} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Short description" htmlFor="c-blurb" className="sm:col-span-2">
            <textarea id="c-blurb" rows={2} className={textareaClass} maxLength={400} value={c.contact.footer_blurb}
              onChange={(e) => update((d) => { d.contact.footer_blurb = e.target.value })} />
          </Field>
          <Field label="Phone number" htmlFor="c-phone" hint="Leave empty to hide">
            <input id="c-phone" type="tel" className={fieldClass} maxLength={40} value={c.contact.phone}
              onChange={(e) => update((d) => { d.contact.phone = e.target.value })} />
          </Field>
          <Field label="Email address" htmlFor="c-email" hint="Leave empty to hide">
            <input id="c-email" type="email" className={fieldClass} maxLength={200} value={c.contact.email}
              onChange={(e) => update((d) => { d.contact.email = e.target.value })} />
          </Field>
          <Field label="Physical address (optional)" htmlFor="c-addr" className="sm:col-span-2">
            <textarea id="c-addr" rows={2} className={textareaClass} maxLength={300} value={c.contact.address}
              onChange={(e) => update((d) => { d.contact.address = e.target.value })} />
          </Field>
        </div>
      </DataCard>

      <p className="text-sm text-muted-foreground">
        Course details and fees are edited under <a href="/admin/courses" className="text-primary hover:underline">Courses &amp; fees</a>;
        the application form questions under <a href="/admin/form" className="text-primary hover:underline">Application form</a>.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3">
          {dirty && <span className="mr-auto text-sm text-amber-700">Unsaved changes</span>}
          <Button onClick={save} disabled={pending || !dirty} className="h-10 gap-2 px-5">
            {pending && <Loader2 className="size-4 animate-spin" />} Save &amp; publish
          </Button>
        </div>
      </div>
    </div>
  )
}
