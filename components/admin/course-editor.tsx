'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { DataCard, Field, Notice, fieldClass, textareaClass } from '@/components/admin/ui'
import {
  addCoursePrice, deleteDraftCourse, deleteIntake, deleteScheduledPrice, saveCourse, saveIntake, setCourseStatus,
  type CourseInput, type IntakeInput,
} from '@/app/actions/admin/courses'
import { STUDY_MODES } from '@/lib/statuses'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'

type Msg = { tone: 'success' | 'error' | 'warning'; text: string } | null

// ── Course details ──────────────────────────────────────────────

export function CourseForm({ initial, canEdit }: { initial: CourseInput; canEdit: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState<CourseInput>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof CourseInput>(k: K, v: CourseInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const res = await saveCourse(form)
      if (!res.ok) {
        setErrors(('errors' in res && res.errors) || {})
        setMsg({ tone: 'error', text: res.error })
        return
      }
      setErrors({})
      if (!initial.id) { router.push(`/admin/courses/${res.data.id}?created=1`); return }
      setMsg({ tone: 'success', text: 'Course saved. The public application form now shows these details.' })
      router.refresh()
    })
  }

  const disabled = !canEdit || pending

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <Field label="Course name" htmlFor="c-name" required error={errors.name} className="sm:col-span-2">
          <input id="c-name" className={fieldClass} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} />
        </Field>
        <Field label="Course code" htmlFor="c-code" required error={errors.code} hint="Unique, e.g. KTI-017">
          <input id="c-code" className={`${fieldClass} uppercase`} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={20} />
        </Field>
        <Field label="Status" htmlFor="c-status" error={errors.status} hint="Only Active courses are shown to applicants.">
          <select id="c-status" className={fieldClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="draft">Draft — not visible</option>
            <option value="active">Active — visible</option>
            <option value="inactive">Inactive — temporarily hidden</option>
            <option value="archived">Archived — no longer offered</option>
          </select>
        </Field>
        <Field label="Category / group" htmlFor="c-cat" hint="Courses are grouped by this on the form.">
          <input id="c-cat" className={fieldClass} value={form.category} onChange={(e) => set('category', e.target.value)} maxLength={120} />
        </Field>
        <Field label="Qualification type" htmlFor="c-qual" hint="e.g. Certificate, Diploma, Short course">
          <input id="c-qual" className={fieldClass} value={form.qualification_type} onChange={(e) => set('qualification_type', e.target.value)} maxLength={120} />
        </Field>
        <Field label="Duration" htmlFor="c-dur" hint="e.g. 6 months, 2 years">
          <input id="c-dur" className={fieldClass} value={form.duration} onChange={(e) => set('duration', e.target.value)} maxLength={120} />
        </Field>
        <Field label="Display order" htmlFor="c-sort" error={errors.sort_order} hint="Lower numbers appear first.">
          <input id="c-sort" type="number" step="1" className={fieldClass} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="c-desc" className="sm:col-span-2">
          <textarea id="c-desc" rows={3} className={textareaClass} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
        </Field>
        <Field label="Entry requirements / admission criteria" htmlFor="c-req" className="sm:col-span-2">
          <textarea id="c-req" rows={3} className={textareaClass} value={form.requirements} onChange={(e) => set('requirements', e.target.value)} maxLength={5000} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Study modes</legend>
          <div className="flex flex-wrap gap-4">
            {STUDY_MODES.map((m) => (
              <label key={m.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.study_modes.includes(m.value)}
                  onChange={(e) => set('study_modes', e.target.checked ? [...form.study_modes, m.value] : form.study_modes.filter((x) => x !== m.value))}
                />
                {m.label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">If none are ticked, applicants aren&apos;t asked how they want to study.</p>
        </fieldset>
        <Field label="Application deadline" htmlFor="c-deadline" error={errors.application_deadline} hint="Last day applications are accepted (optional).">
          <input id="c-deadline" type="date" className={fieldClass} value={form.application_deadline} onChange={(e) => set('application_deadline', e.target.value)} />
        </Field>
        <Field label="Maximum enrolment capacity" htmlFor="c-cap" error={errors.capacity} hint="Accepting beyond this is blocked. Blank = no limit.">
          <input id="c-cap" type="number" min="1" step="1" className={fieldClass} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="size-4 accent-primary" checked={form.accepting_applications} onChange={(e) => set('accepting_applications', e.target.checked)} />
          Open for new applications
          <span className="text-muted-foreground">(untick to show the course as closed without hiding it)</span>
        </label>
      </fieldset>
      {canEdit && (
        <Button type="submit" disabled={pending} className="h-10 gap-2 self-start px-5">
          {pending && <Loader2 className="size-4 animate-spin" />} {initial.id ? 'Save course' : 'Create course'}
        </Button>
      )}
    </form>
  )
}

// ── Quick status actions ────────────────────────────────────────

export function CourseStatusActions({ id, status, applicationCount }: { id: string; status: string; applicationCount: number }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<null | 'inactive' | 'archived' | 'delete'>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()

  function run(action: 'active' | 'inactive' | 'archived' | 'delete') {
    setMsg(null)
    start(async () => {
      const res = action === 'delete' ? await deleteDraftCourse(id) : await setCourseStatus(id, action)
      setConfirm(null)
      if (!res.ok) { setMsg({ tone: 'error', text: res.error }); return }
      if (action === 'delete') { router.push('/admin/courses'); return }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        {status !== 'active' && (
          <Button onClick={() => run('active')} disabled={pending} className="h-9 px-4">Activate</Button>
        )}
        {status === 'active' && (
          <Button variant="outline" onClick={() => setConfirm('inactive')} disabled={pending} className="h-9 px-4">Deactivate</Button>
        )}
        {status !== 'archived' && (
          <Button variant="outline" onClick={() => setConfirm('archived')} disabled={pending} className="h-9 px-4">Archive</Button>
        )}
        {status === 'draft' && applicationCount === 0 && (
          <Button variant="destructive" onClick={() => setConfirm('delete')} disabled={pending} className="h-9 gap-1.5 px-4">
            <Trash2 className="size-4" /> Delete draft
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'delete' ? 'Delete this draft course?' : confirm === 'archived' ? 'Archive this course?' : 'Deactivate this course?'}
        description={
          confirm === 'delete'
            ? 'The draft and its prices and intakes will be permanently removed.'
            : `It will disappear from the public application form immediately. ${applicationCount} existing application${applicationCount === 1 ? '' : 's'} stay available in the dashboard.`
        }
        confirmLabel={confirm === 'delete' ? 'Delete' : confirm === 'archived' ? 'Archive' : 'Deactivate'}
        destructive={confirm === 'delete'}
        busy={pending}
        onConfirm={() => confirm && run(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

// ── Prices ──────────────────────────────────────────────────────

export interface PriceRow {
  id: string
  currency: string
  tuition_fee: string
  registration_fee: string
  other_fees: { label: string; amount: number }[]
  discount_amount: string
  discount_label: string | null
  discount_ends_at: string | null
  effective_from: string
  note: string | null
  created_at: string
}

function priceTotal(p: PriceRow, at = new Date()) {
  const discount = !p.discount_ends_at || new Date(p.discount_ends_at) > at ? Number(p.discount_amount) : 0
  return Math.max(Number(p.tuition_fee) - discount, 0) + Number(p.registration_fee) + p.other_fees.reduce((s, f) => s + Number(f.amount), 0)
}

export function PricePanel({ courseId, prices, currentPriceId, canEdit }: { courseId: string; prices: PriceRow[]; currentPriceId: string | null; canEdit: boolean }) {
  const router = useRouter()
  const latest = prices.find((p) => p.id === currentPriceId)
  const blank = {
    currency: latest?.currency ?? 'ZAR',
    tuition_fee: latest ? String(Number(latest.tuition_fee)) : '',
    registration_fee: latest ? String(Number(latest.registration_fee)) : '',
    other_fees: latest?.other_fees.map((f) => ({ label: f.label, amount: String(f.amount) })) ?? [],
    discount_amount: '', discount_label: '', discount_ends_at: '', effective_from: '', note: '',
  }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()
  const now = new Date()

  function submit() {
    setMsg(null)
    start(async () => {
      const res = await addCoursePrice({
        courseId, ...form,
        effective_from: toIso(form.effective_from),
        discount_ends_at: toIso(form.discount_ends_at),
      })
      if (!res.ok) {
        setErrors(('errors' in res && res.errors) || {})
        setMsg({ tone: 'error', text: res.error })
        return
      }
      setErrors({})
      setOpen(false)
      setMsg({
        tone: 'success',
        text: form.effective_from
          ? `New price scheduled for ${formatDateTime(form.effective_from)}.`
          : 'New price is now live on the application form. Existing applications keep the price they were quoted.',
      })
      router.refresh()
    })
  }

  function removeScheduled(id: string) {
    start(async () => {
      const res = await deleteScheduledPrice(id, courseId)
      setMsg(res.ok ? { tone: 'success', text: 'Scheduled price removed.' } : { tone: 'error', text: res.error })
      router.refresh()
    })
  }

  return (
    <DataCard
      title="Fees & price history"
      actions={canEdit && !open && (
        <Button size="sm" onClick={() => { setForm(blank); setOpen(true) }} className="h-9 gap-1.5 px-3">
          <Plus className="size-4" /> New price
        </Button>
      )}
    >
      <div className="flex flex-col gap-4">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        {!latest && !open && (
          <Notice tone="warning">No price is set. Applicants see &ldquo;Fees to be confirmed&rdquo; for this course.</Notice>
        )}

        {open && (
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Prices are never edited in place — a new price is added and the old one kept as history. Applications already
              submitted keep the fees they were quoted.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Currency" htmlFor="p-cur" error={errors.currency}>
                <input id="p-cur" className={`${fieldClass} uppercase`} maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Course fee" htmlFor="p-tuition" required error={errors.tuition_fee}>
                <input id="p-tuition" type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={form.tuition_fee} onChange={(e) => setForm({ ...form, tuition_fee: e.target.value })} />
              </Field>
              <Field label="Registration / application fee" htmlFor="p-reg" error={errors.registration_fee}>
                <input id="p-reg" type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={form.registration_fee} onChange={(e) => setForm({ ...form, registration_fee: e.target.value })} />
              </Field>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Other charges</legend>
              {form.other_fees.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <label htmlFor={`of-l-${i}`} className="sr-only">Charge name</label>
                    <input id={`of-l-${i}`} placeholder="e.g. Study materials" className={fieldClass} value={f.label} onChange={(e) => setForm({ ...form, other_fees: form.other_fees.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                  </div>
                  <div className="w-32">
                    <label htmlFor={`of-a-${i}`} className="sr-only">Amount</label>
                    <input id={`of-a-${i}`} type="number" min="0" step="0.01" placeholder="0.00" className={fieldClass} value={f.amount} onChange={(e) => setForm({ ...form, other_fees: form.other_fees.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })} />
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove charge" onClick={() => setForm({ ...form, other_fees: form.other_fees.filter((_, j) => j !== i) })} className="size-10">
                    <Trash2 className="size-4" />
                  </Button>
                  {errors[`other_${i}`] && <p role="alert" className="text-xs text-destructive">{errors[`other_${i}`]}</p>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setForm({ ...form, other_fees: [...form.other_fees, { label: '', amount: '' }] })} className="h-8 gap-1 self-start">
                <Plus className="size-3.5" /> Add charge
              </Button>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Promotional discount" htmlFor="p-disc" error={errors.discount_amount} hint="Taken off the course fee">
                <input id="p-disc" type="number" min="0" step="0.01" className={fieldClass} value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
              </Field>
              <Field label="Discount label" htmlFor="p-disc-l" hint="e.g. Early bird">
                <input id="p-disc-l" className={fieldClass} maxLength={120} value={form.discount_label} onChange={(e) => setForm({ ...form, discount_label: e.target.value })} />
              </Field>
              <Field label="Discount ends" htmlFor="p-disc-e" error={errors.discount_ends_at} hint="Blank = no end date">
                <input id="p-disc-e" type="datetime-local" className={fieldClass} value={form.discount_ends_at} onChange={(e) => setForm({ ...form, discount_ends_at: e.target.value })} />
              </Field>
              <Field label="Takes effect" htmlFor="p-eff" error={errors.effective_from} hint="Blank = immediately" className="sm:col-span-1">
                <input id="p-eff" type="datetime-local" className={fieldClass} value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
              </Field>
              <Field label="Internal note" htmlFor="p-note" className="sm:col-span-2">
                <input id="p-note" className={fieldClass} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Why the price changed" />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={pending} className="h-10 gap-2 px-4">
                {pending && <Loader2 className="size-4 animate-spin" />} Save new price
              </Button>
              <Button variant="outline" onClick={() => { setOpen(false); setErrors({}) }} disabled={pending} className="h-10 px-4">Cancel</Button>
            </div>
          </div>
        )}

        {prices.length > 0 && (
          <div className="-mx-6 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-2 font-semibold">Effective from</th>
                  <th className="px-2 py-2 text-right font-semibold">Course fee</th>
                  <th className="px-2 py-2 text-right font-semibold">Registration</th>
                  <th className="px-2 py-2 text-right font-semibold">Other</th>
                  <th className="px-2 py-2 text-right font-semibold">Total</th>
                  <th className="px-6 py-2 font-semibold"><span className="sr-only">State</span></th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => {
                  const scheduled = new Date(p.effective_from) > now
                  const current = p.id === currentPriceId
                  return (
                    <tr key={p.id} className={`border-b border-border last:border-0 ${!current && !scheduled ? 'text-muted-foreground' : ''}`}>
                      <td className="px-6 py-2.5">
                        {formatDateTime(p.effective_from)}
                        {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {formatMoney(p.tuition_fee, p.currency)}
                        {Number(p.discount_amount) > 0 && (
                          <p className="text-xs text-success">−{formatMoney(p.discount_amount, p.currency)} {p.discount_label}{p.discount_ends_at ? ` until ${formatDate(p.discount_ends_at)}` : ''}</p>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right">{formatMoney(p.registration_fee, p.currency)}</td>
                      <td className="px-2 py-2.5 text-right">{formatMoney(p.other_fees.reduce((s, f) => s + Number(f.amount), 0), p.currency)}</td>
                      <td className="px-2 py-2.5 text-right font-semibold">{formatMoney(priceTotal(p), p.currency)}</td>
                      <td className="px-6 py-2.5 text-right">
                        {current && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Current</span>}
                        {scheduled && (
                          <span className="inline-flex items-center gap-1">
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">Scheduled</span>
                            {canEdit && (
                              <Button variant="ghost" size="icon-sm" aria-label="Remove scheduled price" onClick={() => removeScheduled(p.id)} disabled={pending}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DataCard>
  )
}

// ── Intakes ─────────────────────────────────────────────────────

export interface IntakeRow {
  id: string
  name: string
  starts_on: string | null
  ends_on: string | null
  applications_open_at: string | null
  applications_close_at: string | null
  capacity: number | null
  status: string
  application_count: number
}

/** datetime-local values are in the admin's timezone; send them as UTC ISO strings. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : '')

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

export function IntakesPanel({ courseId, intakes, canEdit }: { courseId: string; intakes: IntakeRow[]; canEdit: boolean }) {
  const router = useRouter()
  const empty: IntakeInput = { courseId, name: '', starts_on: '', ends_on: '', applications_open_at: '', applications_close_at: '', capacity: '', status: 'open' }
  const [editing, setEditing] = useState<IntakeInput | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<Msg>(null)
  const [removing, setRemoving] = useState<IntakeRow | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!editing) return
    setMsg(null)
    start(async () => {
      const res = await saveIntake({
        ...editing,
        applications_open_at: toIso(editing.applications_open_at),
        applications_close_at: toIso(editing.applications_close_at),
      })
      if (!res.ok) { setErrors(('errors' in res && res.errors) || {}); setMsg({ tone: 'error', text: res.error }); return }
      setEditing(null); setErrors({})
      setMsg({ tone: 'success', text: 'Intake saved.' })
      router.refresh()
    })
  }

  function remove() {
    if (!removing) return
    start(async () => {
      const res = await deleteIntake(removing.id, courseId)
      setRemoving(null)
      setMsg(res.ok ? { tone: 'success', text: 'Intake deleted.' } : { tone: 'error', text: res.error })
      router.refresh()
    })
  }

  return (
    <DataCard
      title="Intakes"
      actions={canEdit && !editing && (
        <Button size="sm" onClick={() => setEditing(empty)} className="h-9 gap-1.5 px-3"><Plus className="size-4" /> Add intake</Button>
      )}
    >
      <div className="flex flex-col gap-4">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <p className="text-sm text-muted-foreground">
          If a course has open intakes, applicants must choose one. With no intakes, they simply apply for the course.
        </p>

        {editing && (
          <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="i-name" required error={errors.name} className="sm:col-span-2">
              <input id="i-name" className={fieldClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="January 2027" />
            </Field>
            <Field label="Classes start" htmlFor="i-start" error={errors.starts_on}>
              <input id="i-start" type="date" className={fieldClass} value={editing.starts_on} onChange={(e) => setEditing({ ...editing, starts_on: e.target.value })} />
            </Field>
            <Field label="Classes end" htmlFor="i-end" error={errors.ends_on}>
              <input id="i-end" type="date" className={fieldClass} value={editing.ends_on} onChange={(e) => setEditing({ ...editing, ends_on: e.target.value })} />
            </Field>
            <Field label="Applications open" htmlFor="i-open" error={errors.applications_open_at} hint="Blank = open now">
              <input id="i-open" type="datetime-local" className={fieldClass} value={editing.applications_open_at} onChange={(e) => setEditing({ ...editing, applications_open_at: e.target.value })} />
            </Field>
            <Field label="Applications close" htmlFor="i-close" error={errors.applications_close_at} hint="Blank = no closing date">
              <input id="i-close" type="datetime-local" className={fieldClass} value={editing.applications_close_at} onChange={(e) => setEditing({ ...editing, applications_close_at: e.target.value })} />
            </Field>
            <Field label="Capacity" htmlFor="i-cap" error={errors.capacity} hint="Blank = no limit">
              <input id="i-cap" type="number" min="1" className={fieldClass} value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} />
            </Field>
            <Field label="Status" htmlFor="i-status" error={errors.status}>
              <select id="i-status" className={fieldClass} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="planned">Planned — not yet open</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={save} disabled={pending} className="h-10 gap-2 px-4">{pending && <Loader2 className="size-4 animate-spin" />} Save intake</Button>
              <Button variant="outline" onClick={() => { setEditing(null); setErrors({}) }} disabled={pending} className="h-10 px-4">Cancel</Button>
            </div>
          </div>
        )}

        {intakes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No intakes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {intakes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{i.name} <span className="ml-1 text-xs font-normal capitalize text-muted-foreground">({i.status})</span></p>
                  <p className="text-xs text-muted-foreground">
                    {i.starts_on ? `Starts ${formatDate(i.starts_on)}` : 'Start date not set'}
                    {i.applications_close_at ? ` · Applications close ${formatDateTime(i.applications_close_at)}` : ''}
                    {` · ${i.application_count} applicant${i.application_count === 1 ? '' : 's'}`}
                    {i.capacity ? ` · capacity ${i.capacity}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing({
                      id: i.id, courseId, name: i.name, starts_on: i.starts_on ?? '', ends_on: i.ends_on ?? '',
                      applications_open_at: toLocal(i.applications_open_at), applications_close_at: toLocal(i.applications_close_at),
                      capacity: i.capacity ? String(i.capacity) : '', status: i.status,
                    })}>Edit</Button>
                    {i.application_count === 0 && (
                      <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setRemoving(i)}>Delete</Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={!!removing}
        title={`Delete intake "${removing?.name}"?`}
        description="This intake has no applicants and will be permanently removed."
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </DataCard>
  )
}
