'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Eye, Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { DataCard, Field, Notice, fieldClass, textareaClass } from '@/components/admin/ui'
import { discardFormDraft, publishFormDraft, saveFormDraft } from '@/app/actions/admin/form'
import {
  CORE_FIELDS, FIELD_TYPES, REQUIRED_STEPS, makeCustomKey,
  type DocumentConfig, type FieldConfig, type FieldType, type FormConfig, type StepConfig,
} from '@/lib/form-config'

type Msg = { tone: 'success' | 'error' | 'warning'; text: string } | null

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)

export function FormEditor({ initial, hasDraft, canEdit }: { initial: FormConfig; hasDraft: boolean; canEdit: boolean }) {
  const router = useRouter()
  const [config, setConfig] = useState<FormConfig>(initial)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [confirm, setConfirm] = useState<null | 'publish' | 'discard'>(null)
  const [pending, start] = useTransition()

  const update = (fn: (c: FormConfig) => FormConfig) => { setConfig((c) => fn(structuredClone(c))); setDirty(true); setMsg(null) }
  const updateStep = (i: number, fn: (s: StepConfig) => void) => update((c) => { fn(c.steps[i]); return c })

  function save(after?: () => void) {
    start(async () => {
      const res = await saveFormDraft(config)
      if (!res.ok) { setMsg({ tone: 'error', text: res.error }); return }
      setDirty(false)
      setMsg({ tone: 'success', text: 'Draft saved. Applicants still see the published form until you publish.' })
      router.refresh()
      after?.()
    })
  }

  function preview() {
    if (!canEdit) { window.open('/admin/form/preview?version=published', '_blank'); return }
    save(() => window.open('/admin/form/preview', '_blank'))
  }

  function publish() {
    start(async () => {
      if (dirty) {
        const saved = await saveFormDraft(config)
        if (!saved.ok) { setConfirm(null); setMsg({ tone: 'error', text: saved.error }); return }
      }
      const res = await publishFormDraft()
      setConfirm(null)
      if (!res.ok) { setMsg({ tone: 'error', text: res.error }); return }
      setDirty(false)
      setMsg({ tone: 'success', text: 'Published. The public application form now uses this version.' })
      router.refresh()
    })
  }

  function discard() {
    start(async () => {
      const res = await discardFormDraft()
      setConfirm(null)
      if (!res.ok) { setMsg({ tone: 'error', text: res.error }); return }
      setDirty(false)
      setMsg({ tone: 'success', text: 'Draft discarded.' })
      router.refresh()
      window.location.reload()
    })
  }

  const s = config.settings

  return (
    <div className="flex flex-col gap-6 pb-24">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <fieldset disabled={!canEdit || pending} className="flex flex-col gap-6">
        <DataCard title="Opening & closing">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-primary" checked={s.applications_open}
                onChange={(e) => update((c) => { c.settings.applications_open = e.target.checked; return c })} />
              Accept applications
            </label>
            <Field label="Opens at" htmlFor="f-open" hint="Blank = open now">
              <input id="f-open" type="datetime-local" className={fieldClass} value={toLocal(s.opens_at)}
                onChange={(e) => update((c) => { c.settings.opens_at = fromLocal(e.target.value); return c })} />
            </Field>
            <Field label="Closes at" htmlFor="f-close" hint="Blank = no closing date">
              <input id="f-close" type="datetime-local" className={fieldClass} value={toLocal(s.closes_at)}
                onChange={(e) => update((c) => { c.settings.closes_at = fromLocal(e.target.value); return c })} />
            </Field>
            <Field label="Message shown when closed" htmlFor="f-closed-msg" className="sm:col-span-2">
              <textarea id="f-closed-msg" rows={2} className={textareaClass} value={s.closed_message}
                onChange={(e) => update((c) => { c.settings.closed_message = e.target.value; return c })} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Individual courses can also be closed, given deadlines or intakes under Courses &amp; fees.</p>
        </DataCard>

        <DataCard title="Welcome & course step">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Welcome heading" htmlFor="f-wt" className="sm:col-span-2">
              <input id="f-wt" className={fieldClass} value={config.welcome.title.replace(/\n/g, ' ')}
                onChange={(e) => update((c) => { c.welcome.title = e.target.value; return c })} />
            </Field>
            <Field label="Welcome text" htmlFor="f-wi" className="sm:col-span-2">
              <textarea id="f-wi" rows={2} className={textareaClass} value={config.welcome.intro}
                onChange={(e) => update((c) => { c.welcome.intro = e.target.value; return c })} />
            </Field>
            <Field label="Course step title" htmlFor="f-ct">
              <input id="f-ct" className={fieldClass} value={config.course_step.title}
                onChange={(e) => update((c) => { c.course_step.title = e.target.value; return c })} />
            </Field>
            <Field label="Course question" htmlFor="f-cl">
              <input id="f-cl" className={fieldClass} value={config.course_step.label}
                onChange={(e) => update((c) => { c.course_step.label = e.target.value; return c })} />
            </Field>
            <Field label="Course help text" htmlFor="f-ch" className="sm:col-span-2">
              <textarea id="f-ch" rows={2} className={textareaClass} value={config.course_step.helper}
                onChange={(e) => update((c) => { c.course_step.helper = e.target.value; return c })} />
            </Field>
          </div>
        </DataCard>

        {config.steps.map((step, si) => (
          <StepEditor
            key={step.key}
            step={step}
            onChange={(fn) => updateStep(si, fn)}
            allKeys={config.steps.flatMap((x) => x.fields.map((f) => f.key))}
          />
        ))}

        <DocumentsEditor
          docs={config.documents}
          intro={config.documents_step.intro}
          onIntro={(v) => update((c) => { c.documents_step.intro = v; return c })}
          onChange={(docs) => update((c) => { c.documents = docs; return c })}
        />

        <DataCard title="Declaration">
          <div className="flex flex-col gap-4">
            <Field label="Declaration text" htmlFor="f-decl">
              <textarea id="f-decl" rows={4} className={textareaClass} value={config.declaration.text}
                onChange={(e) => update((c) => { c.declaration.text = e.target.value; return c })} />
            </Field>
            <Field label="Acceptance question" htmlFor="f-acc">
              <input id="f-acc" className={fieldClass} value={config.declaration.accept_label}
                onChange={(e) => update((c) => { c.declaration.accept_label = e.target.value; return c })} />
            </Field>
          </div>
        </DataCard>

        <DataCard title="Confirmation after submission">
          <div className="flex flex-col gap-4">
            <Field label="Heading" htmlFor="f-cft">
              <input id="f-cft" className={fieldClass} value={config.confirmation.title}
                onChange={(e) => update((c) => { c.confirmation.title = e.target.value; return c })} />
            </Field>
            <Field label="Message" htmlFor="f-cfm" hint="The applicant's reference number is always shown below this.">
              <textarea id="f-cfm" rows={3} className={textareaClass} value={config.confirmation.message}
                onChange={(e) => update((c) => { c.confirmation.message = e.target.value; return c })} />
            </Field>
            <Field label="What happens next (one step per line)" htmlFor="f-cfn">
              <textarea id="f-cfn" rows={4} className={textareaClass} value={config.confirmation.next_steps.join('\n')}
                onChange={(e) => update((c) => { c.confirmation.next_steps = e.target.value.split('\n'); return c })} />
            </Field>
          </div>
        </DataCard>
      </fieldset>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
          {dirty && <span className="mr-auto text-sm text-amber-700">Unsaved changes</span>}
          {canEdit && hasDraft && (
            <Button variant="ghost" onClick={() => setConfirm('discard')} disabled={pending} className="h-10 px-4">Discard draft</Button>
          )}
          <Button variant="outline" onClick={preview} disabled={pending} className="h-10 gap-2 px-4">
            <Eye className="size-4" /> Preview
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => save()} disabled={pending || !dirty} className="h-10 gap-2 px-4">
                {pending && <Loader2 className="size-4 animate-spin" />} Save draft
              </Button>
              <Button onClick={() => setConfirm('publish')} disabled={pending || (!dirty && !hasDraft)} className="h-10 px-4">
                Publish
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'publish'}
        title="Publish this form?"
        description="Applicants will see these changes immediately. Applications already submitted keep the answers they gave. Tip: preview first."
        confirmLabel="Publish"
        busy={pending}
        onConfirm={publish}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title="Discard unpublished changes?"
        description="The draft is deleted and the editor goes back to the published form."
        confirmLabel="Discard"
        destructive
        busy={pending}
        onConfirm={discard}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

function StepEditor({
  step, onChange, allKeys,
}: { step: StepConfig; onChange: (fn: (s: StepConfig) => void) => void; allKeys: string[] }) {
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<FieldType>('text')
  const required = REQUIRED_STEPS.includes(step.key)

  return (
    <DataCard
      title={`Step: ${step.title}`}
      actions={
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={step.enabled} disabled={required}
            onChange={(e) => onChange((s) => { s.enabled = e.target.checked })} />
          {required ? 'Always shown' : 'Show this step'}
        </label>
      }
    >
      <div className={`flex flex-col gap-4 ${step.enabled ? '' : 'opacity-60'}`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Step title" htmlFor={`st-${step.key}`}>
            <input id={`st-${step.key}`} className={fieldClass} value={step.title} onChange={(e) => onChange((s) => { s.title = e.target.value })} />
          </Field>
          <Field label="Short label (progress bar)" htmlFor={`ss-${step.key}`}>
            <input id={`ss-${step.key}`} className={fieldClass} value={step.short} maxLength={40} onChange={(e) => onChange((s) => { s.short = e.target.value })} />
          </Field>
          <Field label="Intro text" htmlFor={`si-${step.key}`}>
            <input id={`si-${step.key}`} className={fieldClass} value={step.intro} onChange={(e) => onChange((s) => { s.intro = e.target.value })} />
          </Field>
        </div>

        <ol className="flex flex-col gap-3">
          {step.fields.map((f, i) => (
            <FieldEditor
              key={f.key}
              field={f}
              first={i === 0}
              last={i === step.fields.length - 1}
              onMove={(d) => onChange((s) => { s.fields = move(s.fields, i, i + d) })}
              onChange={(fn) => onChange((s) => { fn(s.fields[i]) })}
              onRemove={() => onChange((s) => { s.fields.splice(i, 1) })}
            />
          ))}
        </ol>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
          <Field label="New question" htmlFor={`nq-${step.key}`} className="min-w-[200px] flex-1">
            <input id={`nq-${step.key}`} className={fieldClass} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Which church do you attend?" />
          </Field>
          <Field label="Answer type" htmlFor={`nt-${step.key}`}>
            <select id={`nt-${step.key}`} className={fieldClass} value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Button
            variant="outline"
            disabled={!newLabel.trim()}
            className="h-10 gap-1.5"
            onClick={() => {
              const key = makeCustomKey(newLabel, allKeys)
              onChange((s) => {
                s.fields.push({
                  key, type: newType, label: newLabel.trim(), helper: '', placeholder: '', required: false, enabled: true,
                  options: newType === 'select' || newType === 'radio' ? ['Option 1', 'Option 2'] : [],
                })
              })
              setNewLabel('')
            }}
          >
            <Plus className="size-4" /> Add question
          </Button>
        </div>
      </div>
    </DataCard>
  )
}

function FieldEditor({
  field, first, last, onMove, onChange, onRemove,
}: {
  field: FieldConfig
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onChange: (fn: (f: FieldConfig) => void) => void
  onRemove: () => void
}) {
  const core = CORE_FIELDS[field.key]
  const locked = !!core?.locked
  const id = `fe-${field.key}`
  const typeLabel = FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type

  return (
    <li className={`rounded-xl border border-border p-3 ${field.enabled ? 'bg-background' : 'bg-muted/40'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Move "${field.label}" up`} disabled={first} onClick={() => onMove(-1)}><ArrowUp className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Move "${field.label}" down`} disabled={last} onClick={() => onMove(1)}><ArrowDown className="size-4" /></Button>
        </div>
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
          <Field label="Question" htmlFor={`${id}-l`}>
            <input id={`${id}-l`} className={fieldClass} value={field.label} onChange={(e) => onChange((f) => { f.label = e.target.value })} />
          </Field>
          <Field label="Help text" htmlFor={`${id}-h`}>
            <input id={`${id}-h`} className={fieldClass} value={field.helper} onChange={(e) => onChange((f) => { f.helper = e.target.value })} />
          </Field>
          {field.type !== 'yesno' && field.type !== 'radio' && field.type !== 'date' && (
            <Field label={field.type === 'select' ? 'Dropdown prompt' : 'Example / placeholder'} htmlFor={`${id}-p`}>
              <input id={`${id}-p`} className={fieldClass} value={field.placeholder} onChange={(e) => onChange((f) => { f.placeholder = e.target.value })} />
            </Field>
          )}
          {(field.type === 'select' || field.type === 'radio') && (
            <Field label="Options (one per line)" htmlFor={`${id}-o`} className="md:col-span-2">
              <textarea id={`${id}-o`} rows={3} className={textareaClass} value={field.options.join('\n')}
                onChange={(e) => onChange((f) => { f.options = e.target.value.split('\n') })} />
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-xs text-muted-foreground">{typeLabel}{core ? '' : ' · custom'}</span>
          {locked ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" /> Always required</span>
          ) : (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-primary" checked={field.enabled} onChange={(e) => onChange((f) => { f.enabled = e.target.checked })} />
                Shown
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-primary" checked={field.required} onChange={(e) => onChange((f) => { f.required = e.target.checked })} />
                Required
              </label>
            </>
          )}
          {!core && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={onRemove}>
              <Trash2 className="size-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

function DocumentsEditor({
  docs, intro, onIntro, onChange,
}: { docs: DocumentConfig[]; intro: string; onIntro: (v: string) => void; onChange: (docs: DocumentConfig[]) => void }) {
  const [label, setLabel] = useState('')
  const set = (i: number, patch: Partial<DocumentConfig>) => onChange(docs.map((d, j) => (j === i ? { ...d, ...patch } : d)))

  return (
    <DataCard title="Required documents">
      <div className="flex flex-col gap-4">
        <Field label="Instructions" htmlFor="doc-intro">
          <input id="doc-intro" className={fieldClass} value={intro} onChange={(e) => onIntro(e.target.value)} />
        </Field>
        <ul className="flex flex-col gap-3">
          {docs.map((d, i) => (
            <li key={d.type} className="flex flex-wrap items-start gap-3 rounded-xl border border-border p-3">
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
                <Field label="Document" htmlFor={`doc-l-${d.type}`}>
                  <input id={`doc-l-${d.type}`} className={fieldClass} value={d.label} onChange={(e) => set(i, { label: e.target.value })} />
                </Field>
                <Field label="Hint" htmlFor={`doc-h-${d.type}`}>
                  <input id={`doc-h-${d.type}`} className={fieldClass} value={d.hint} onChange={(e) => set(i, { hint: e.target.value })} />
                </Field>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-primary" checked={d.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} /> Shown
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-primary" checked={d.required} onChange={(e) => set(i, { required: e.target.checked })} /> Required
                </label>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={() => onChange(docs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Add a document" htmlFor="doc-new" className="min-w-[200px] flex-1">
            <input id="doc-new" className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Proof of payment" />
          </Field>
          <Button
            variant="outline"
            className="h-10 gap-1.5"
            disabled={!label.trim()}
            onClick={() => {
              const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'document'
              let type = base
              let n = 2
              while (docs.some((d) => d.type === type)) type = `${base}_${n++}`
              onChange([...docs, { type, label: label.trim(), hint: '', required: false, enabled: true }])
              setLabel('')
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Accepted files: PDF, JPG or PNG up to 5 MB.</p>
      </div>
    </DataCard>
  )
}
