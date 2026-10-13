'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { DataCard, Field, Notice, fieldClass, textareaClass } from '@/components/admin/ui'
import { addApplicationNote, updateApplicantDetails } from '@/app/actions/admin/applications'
import { recordPayment, voidPayment } from '@/app/actions/admin/payments'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import type { FieldConfig } from '@/lib/form-config'

// ── Applicant details editor ────────────────────────────────────

export function ApplicantEditor({
  applicationId, sections, values,
}: {
  applicationId: string
  sections: { title: string; fields: FieldConfig[] }[]
  values: Record<string, string | boolean | null>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(values)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pending, start] = useTransition()

  function save() {
    // Send only what changed, so untouched legacy values are left alone.
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== values[k]))
    if (Object.keys(changed).length === 0) { setMessage({ tone: 'success', text: 'No changes to save.' }); return }
    start(async () => {
      const res = await updateApplicantDetails(applicationId, changed)
      if (!res.ok) {
        setErrors(res.errors ?? {})
        setMessage({ tone: 'error', text: res.error })
        return
      }
      setErrors({})
      setMessage({ tone: 'success', text: 'Applicant details updated. The change is recorded in the history.' })
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <Button variant="outline" onClick={() => { setDraft(values); setOpen(true); setMessage(null) }} className="h-10 gap-2 self-start">
          <Pencil className="size-4" /> Edit applicant details
        </Button>
      </div>
    )
  }

  return (
    <DataCard title="Edit applicant details">
      <div className="flex flex-col gap-6">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {sections.map((section) => (
          <fieldset key={section.title} className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((f) => {
                const v = draft[f.key]
                const id = `edit-${f.key}`
                const set = (val: string | boolean | null) => setDraft((d) => ({ ...d, [f.key]: val }))
                return (
                  <Field key={f.key} label={f.label} htmlFor={id} error={errors[f.key]} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    {f.type === 'textarea' ? (
                      <textarea id={id} rows={3} className={textareaClass} value={typeof v === 'string' ? v : ''} onChange={(e) => set(e.target.value)} />
                    ) : f.type === 'select' || f.type === 'radio' ? (
                      <select id={id} className={fieldClass} value={typeof v === 'string' ? v : ''} onChange={(e) => set(e.target.value)}>
                        <option value="">—</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        {typeof v === 'string' && v && !f.options.includes(v) && <option value={v}>{v} (legacy value)</option>}
                      </select>
                    ) : f.type === 'yesno' ? (
                      <select id={id} className={fieldClass} value={v === true ? 'yes' : v === false ? 'no' : ''} onChange={(e) => set(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}>
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <input id={id} type={f.type} className={fieldClass} value={typeof v === 'string' ? v : ''} onChange={(e) => set(e.target.value)} />
                    )}
                  </Field>
                )
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending} className="h-10 gap-2 px-5">
            {pending && <Loader2 className="size-4 animate-spin" />} Save changes
          </Button>
          <Button variant="outline" onClick={() => { setOpen(false); setErrors({}); setMessage(null) }} disabled={pending} className="h-10 px-5">
            Cancel
          </Button>
        </div>
      </div>
    </DataCard>
  )
}

// ── Notes ───────────────────────────────────────────────────────

export interface NoteRow { id: string; body: string; author_email: string | null; created_at: string }

export function NotesPanel({ applicationId, notes, canAdd }: { applicationId: string; notes: NoteRow[]; canAdd: boolean }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function add() {
    setError(null)
    start(async () => {
      const res = await addApplicationNote(applicationId, body)
      if (!res.ok) { setError(res.error); return }
      setBody('')
      router.refresh()
    })
  }

  return (
    <DataCard title="Internal notes">
      <div className="flex flex-col gap-4">
        {canAdd && (
          <div className="flex flex-col gap-2">
            <label htmlFor="new-note" className="sr-only">New note</label>
            <Textarea id="new-note" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note for the admissions team (not visible to the applicant)…" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button onClick={add} disabled={pending || !body.trim()} size="sm" className="h-9 gap-2 self-end px-4">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add note
            </Button>
          </div>
        )}
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-muted/50 p-3">
                <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.author_email ?? 'Unknown'} · {formatDateTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DataCard>
  )
}

// ── Payments ────────────────────────────────────────────────────

export interface PaymentRow {
  id: string
  kind: 'payment' | 'refund'
  amount: string
  currency: string
  method: string
  reference: string | null
  received_on: string
  note: string | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

export interface Financials {
  currency: string | null
  amount_due: string | null
  amount_paid: string
  amount_refunded: string
  net_paid: string
  payment_status: string
}

const METHOD_LABEL: Record<string, string> = { eft: 'EFT / bank transfer', cash: 'Cash', card_external: 'Card (external machine)', other: 'Other' }

export function PaymentsPanel({
  applicationId, payments, financials, canManage, statusBadge,
}: {
  applicationId: string
  payments: PaymentRow[]
  financials: Financials | null
  canManage: boolean
  statusBadge: React.ReactNode
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ kind: 'payment' as 'payment' | 'refund', amount: '', method: 'eft', reference: '', receivedOn: today, note: '' })
  const [voiding, setVoiding] = useState<PaymentRow | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pending, start] = useTransition()
  const currency = financials?.currency ?? 'ZAR'
  const due = financials?.amount_due ? Number(financials.amount_due) : null
  const outstanding = due !== null ? due - Number(financials?.net_paid ?? 0) : null

  function submit() {
    setMessage(null)
    start(async () => {
      const res = await recordPayment({ applicationId, ...form })
      if (!res.ok) { setMessage({ tone: 'error', text: res.error }); return }
      setMessage({ tone: 'success', text: `${form.kind === 'refund' ? 'Refund' : 'Payment'} recorded.` })
      setAdding(false)
      setForm({ ...form, amount: '', reference: '', note: '' })
      router.refresh()
    })
  }

  function confirmVoid() {
    if (!voiding) return
    start(async () => {
      const res = await voidPayment(voiding.id, applicationId, voidReason)
      if (!res.ok) { setMessage({ tone: 'error', text: res.error }); return }
      setVoiding(null)
      setVoidReason('')
      setMessage({ tone: 'success', text: 'Payment voided.' })
      router.refresh()
    })
  }

  return (
    <DataCard title="Fees & payments" actions={statusBadge}>
      <div className="flex flex-col gap-4">
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Fees due</dt><dd className="font-semibold">{due !== null ? formatMoney(due, currency) : 'No fee recorded'}</dd></div>
          <div><dt className="text-muted-foreground">Paid</dt><dd className="font-semibold">{formatMoney(financials?.amount_paid ?? 0, currency)}</dd></div>
          <div><dt className="text-muted-foreground">Refunded</dt><dd className="font-semibold">{formatMoney(financials?.amount_refunded ?? 0, currency)}</dd></div>
          <div><dt className="text-muted-foreground">Outstanding</dt><dd className="font-semibold">{outstanding !== null ? formatMoney(Math.max(outstanding, 0), currency) : '—'}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Payments are recorded manually by staff (no online payment provider is connected). Card numbers are never stored.
        </p>

        {payments.length > 0 && (
          <ul className="flex flex-col gap-2">
            {payments.map((p) => (
              <li key={p.id} className={`rounded-xl border border-border p-3 text-sm ${p.voided_at ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-medium ${p.voided_at ? 'line-through' : ''}`}>
                      {p.kind === 'refund' ? 'Refund' : 'Payment'} · {formatMoney(p.amount, p.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABEL[p.method] ?? p.method} · {formatDate(p.received_on)}{p.reference ? ` · Ref ${p.reference}` : ''}
                    </p>
                    {p.note && <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>}
                    {p.voided_at && <p className="mt-1 text-xs text-destructive">Voided: {p.void_reason}</p>}
                  </div>
                  {canManage && !p.voided_at && (
                    <Button variant="ghost" size="sm" onClick={() => setVoiding(p)} className="h-8 text-xs text-muted-foreground">Void</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canManage && (adding ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type" htmlFor="pay-kind">
                <select id="pay-kind" className={fieldClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'payment' | 'refund' })}>
                  <option value="payment">Payment received</option>
                  <option value="refund">Refund paid out</option>
                </select>
              </Field>
              <Field label={`Amount (${currency})`} htmlFor="pay-amount" required>
                <input id="pay-amount" type="number" min="0.01" step="0.01" inputMode="decimal" className={fieldClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </Field>
              <Field label="Method" htmlFor="pay-method">
                <select id="pay-method" className={fieldClass} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Date" htmlFor="pay-date" required>
                <input id="pay-date" type="date" max={today} className={fieldClass} value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} />
              </Field>
              <Field label="Reference" htmlFor="pay-ref" hint="Bank or receipt reference" className="sm:col-span-2">
                <input id="pay-ref" className={fieldClass} maxLength={120} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </Field>
              <Field label="Note" htmlFor="pay-note" className="sm:col-span-2">
                <input id="pay-note" className={fieldClass} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={pending || !form.amount} className="h-10 gap-2 px-4">
                {pending && <Loader2 className="size-4 animate-spin" />} Record {form.kind}
              </Button>
              <Button variant="outline" onClick={() => setAdding(false)} disabled={pending} className="h-10 px-4">Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)} className="h-10 gap-2 self-start">
            <Plus className="size-4" /> Record payment or refund
          </Button>
        ))}
      </div>

      <ConfirmDialog
        open={!!voiding}
        title="Void this payment?"
        description="The payment stays in the record, marked as voided, and no longer counts towards the balance. This can't be undone."
        confirmLabel="Void payment"
        destructive
        busy={pending}
        onConfirm={confirmVoid}
        onCancel={() => { setVoiding(null); setVoidReason('') }}
      >
        <Field label="Reason" htmlFor="void-reason" required>
          <input id="void-reason" className={fieldClass} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </DataCard>
  )
}
