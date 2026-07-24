'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, Save, Settings2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { saveWhatsAppTemplate, deleteWhatsAppTemplate, saveWhatsAppSettings } from '@/app/actions/whatsapp'
import type { WhatsAppTemplate, WhatsAppSettings } from '@/lib/types'

const TRIGGER_OPTIONS = [
  { value: 'submission',   label: 'Application Submitted' },
  { value: 'approved',     label: 'Application Approved' },
  { value: 'rejected',     label: 'Application Rejected' },
  { value: 'under_review', label: 'Now Under Review' },
  { value: 'manual',       label: 'Manual / General' },
]

const TRIGGER_COLOURS: Record<string, string> = {
  submission:   'bg-primary/10 text-primary',
  approved:     'bg-success/15 text-success',
  rejected:     'bg-destructive/15 text-destructive',
  under_review: 'bg-amber-500/15 text-amber-700',
  manual:       'bg-muted text-muted-foreground',
}

const PLACEHOLDERS = [
  '{{ApplicantName}}',
  '{{ProgrammeName}}',
  '{{ApplicationID}}',
  '{{ApplicationStatus}}',
  '{{SubmissionDate}}',
]

type EditState = Partial<WhatsAppTemplate> & { name: string; trigger_type: string; body: string; active: boolean }

const BLANK: EditState = { name: '', trigger_type: 'manual', body: '', active: true }

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EditState
  onSave: (t: EditState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<EditState>(initial)
  const [saving, setSaving] = useState(false)

  const patch = (key: keyof EditState, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const insertPlaceholder = (ph: string) =>
    patch('body', form.body + ph)

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) return
    setSaving(true)
    const result = await saveWhatsAppTemplate(form)
    setSaving(false)
    if (result.success) onSave(form)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-muted-foreground">Template name</label>
          <input
            value={form.name}
            onChange={(e) => patch('name', e.target.value)}
            placeholder="e.g. Approval Congratulations"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-muted-foreground">Trigger</label>
          <select
            value={form.trigger_type}
            onChange={(e) => patch('trigger_type', e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-semibold text-muted-foreground">Message body</label>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((ph) => (
              <button
                key={ph}
                type="button"
                onClick={() => insertPlaceholder(ph)}
                className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                {ph}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={form.body}
          onChange={(e) => patch('body', e.target.value)}
          rows={8}
          placeholder="Hello {{ApplicantName}},..."
          className="w-full resize-y rounded-xl border border-input bg-background p-3 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use *bold* text in WhatsApp by wrapping words with asterisks.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => patch('active', e.target.checked)}
            className="size-4 rounded border-input"
          />
          Active
        </label>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <X className="size-4" /> Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.body.trim()} className="gap-2">
            <Save className="size-4" /> {saving ? 'Saving…' : 'Save template'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function WhatsAppTemplates({
  initialTemplates,
  initialSettings,
}: {
  initialTemplates: WhatsAppTemplate[]
  initialSettings: WhatsAppSettings | null
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(initialTemplates)
  const [settings, setSettings] = useState<WhatsAppSettings>(
    initialSettings ?? { id: 1, auto_send_on_submission: false, auto_send_on_approval: false, auto_send_on_rejection: false },
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const flash = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    const result = await saveWhatsAppSettings({
      auto_send_on_submission: settings.auto_send_on_submission,
      auto_send_on_approval: settings.auto_send_on_approval,
      auto_send_on_rejection: settings.auto_send_on_rejection,
    })
    setSavingSettings(false)
    if (result.success) flash('Settings saved.', true)
    else flash(result.error, false)
  }

  const handleTemplateSaved = () => {
    setCreating(false)
    setEditingId(null)
    flash('Template saved. Refresh the page to see the full list.', true)
  }

  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) { flash('Default templates cannot be deleted.', false); return }
    if (!confirm('Delete this template?')) return
    const result = await deleteWhatsAppTemplate(id)
    if (result.success) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      flash('Template deleted.', true)
    } else {
      flash(result.error, false)
    }
  }

  const toggleActive = async (template: WhatsAppTemplate) => {
    const updated = { ...template, active: !template.active }
    const result = await saveWhatsAppTemplate(updated)
    if (result.success) {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)))
    } else {
      flash(result.error, false)
    }
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div
          role="status"
          className={cn(
            'rounded-2xl border px-4 py-3 text-base font-medium',
            toast.ok
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-destructive/30 bg-destructive/10 text-destructive',
          )}
        >
          {toast.msg}
        </div>
      )}

      {/* Auto-send settings */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Settings2 className="size-5 text-muted-foreground" />
          <h2 className="font-serif text-lg font-bold text-foreground">Automatic notifications</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          When enabled, WhatsApp opens with the matching message pre-filled after a status change.
          The admin still clicks Send inside WhatsApp.
        </p>

        <div className="space-y-4">
          {[
            { key: 'auto_send_on_submission' as const, label: 'When an application is submitted',   trigger: 'submission' },
            { key: 'auto_send_on_approval'   as const, label: 'When an application is approved',    trigger: 'approved' },
            { key: 'auto_send_on_rejection'  as const, label: 'When an application is rejected',    trigger: 'rejected' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4 transition hover:bg-muted/40"
            >
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">
                  Uses the active{' '}
                  <span className="font-semibold">
                    {TRIGGER_OPTIONS.find((o) => o.value === item.trigger)?.label}
                  </span>{' '}
                  template.
                </p>
              </div>
              <div className="relative shrink-0">
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  className="sr-only"
                />
                <div className={cn('flex h-6 w-11 items-center rounded-full transition-colors', settings[item.key] ? 'bg-success' : 'bg-muted')}>
                  <div className={cn('mx-0.5 size-5 rounded-full bg-white shadow transition-transform', settings[item.key] ? 'translate-x-5' : 'translate-x-0')} />
                </div>
              </div>
            </label>
          ))}
        </div>

        <Button onClick={handleSaveSettings} disabled={savingSettings} className="mt-5 gap-2">
          <Check className="size-4" /> {savingSettings ? 'Saving…' : 'Save settings'}
        </Button>
      </Card>

      {/* Templates list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-foreground">Message templates</h2>
          <Button onClick={() => { setCreating(true); setEditingId(null) }} className="gap-2">
            <Plus className="size-4" /> New template
          </Button>
        </div>

        {creating && (
          <div className="mb-4">
            <TemplateForm initial={BLANK} onSave={handleTemplateSaved} onCancel={() => setCreating(false)} />
          </div>
        )}

        <div className="space-y-3">
          {templates.length === 0 && !creating && (
            <Card className="py-12 text-center text-base text-muted-foreground">
              No templates yet. Click &quot;New template&quot; to create one.
            </Card>
          )}
          {templates.map((t) =>
            editingId === t.id ? (
              <TemplateForm
                key={t.id}
                initial={t}
                onSave={handleTemplateSaved}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={t.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{t.name}</span>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', TRIGGER_COLOURS[t.trigger_type] ?? 'bg-muted text-muted-foreground')}>
                        {TRIGGER_OPTIONS.find((o) => o.value === t.trigger_type)?.label ?? t.trigger_type}
                      </span>
                      {t.is_default && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Default</span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {t.body.slice(0, 120)}{t.body.length > 120 ? '…' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => toggleActive(t)}
                      className={cn('rounded-full px-3 py-1 text-xs font-semibold transition', t.active ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                    >
                      {t.active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => { setEditingId(t.id); setCreating(false) }}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.is_default)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={t.is_default ? 'Default templates cannot be deleted' : 'Delete'}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
