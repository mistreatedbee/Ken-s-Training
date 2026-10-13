'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive, ArchiveRestore, ChevronDown, ChevronUp, ClipboardCopy, Loader2, MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { DataCard, Notice, fieldClass } from '@/components/admin/ui'
import {
  archiveApplication, restoreApplication, updateApplicationStatus,
} from '@/app/actions/admin/applications'
import { logWhatsAppMessage } from '@/app/actions/whatsapp'
import {
  buildWhatsAppUrl, formatWhatsAppNumber, isValidWhatsAppNumber, replacePlaceholders,
} from '@/lib/whatsapp'
import {
  APPLICATION_STATUSES, REASON_REQUIRED, STATUS_META, STATUS_TEMPLATE_TRIGGER,
  type ApplicationStatus,
} from '@/lib/statuses'
import { formatDateTime } from '@/lib/format'
import type { WhatsAppLog, WhatsAppSettings, WhatsAppTemplate } from '@/lib/types'

interface Props {
  applicationId: string
  reference: string
  currentStatus: ApplicationStatus
  archived: boolean
  canUpdate: boolean
  applicantName: string
  applicantWhatsapp: string
  programmeName: string
  submissionDate: string
  initialWaLogs: WhatsAppLog[]
  waTemplates: WhatsAppTemplate[]
  waSettings: WhatsAppSettings | null
}

const AUTO_SETTING: Partial<Record<ApplicationStatus, keyof WhatsAppSettings>> = {
  approved: 'auto_send_on_approval',
  rejected: 'auto_send_on_rejection',
}

/** Decisions that deserve an explicit confirmation step. */
const CONFIRM: ApplicationStatus[] = ['approved', 'rejected', 'withdrawn']

export function AdminApplicationActions(props: Props) {
  const {
    applicationId, reference, currentStatus, archived, canUpdate, applicantName, applicantWhatsapp,
    programmeName, submissionDate, initialWaLogs, waTemplates, waSettings,
  } = props
  const router = useRouter()
  const [status, setStatus] = useState<ApplicationStatus>(currentStatus)
  const [target, setTarget] = useState<ApplicationStatus>(currentStatus)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(waTemplates[0]?.id ?? '')
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>(initialWaLogs)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const ctx = useMemo(() => ({
    applicantName, programmeName, applicationId: reference || applicationId,
    applicationStatus: STATUS_META[status].label, submissionDate,
  }), [applicantName, programmeName, reference, applicationId, status, submissionDate])

  const selectedTemplate = waTemplates.find((t) => t.id === selectedTemplateId) ?? null
  const messagePreview = selectedTemplate ? replacePlaceholders(selectedTemplate.body, ctx) : ''
  const waNumberValid = isValidWhatsAppNumber(applicantWhatsapp)
  const needsReason = REASON_REQUIRED.includes(target)

  async function prepareMessage(template: WhatsAppTemplate, body: string, trigger: string, auto: boolean) {
    window.open(buildWhatsAppUrl(applicantWhatsapp, body), '_blank', 'noopener,noreferrer')
    const res = await logWhatsAppMessage({
      application_id: applicationId,
      applicant_name: applicantName,
      whatsapp_number: formatWhatsAppNumber(applicantWhatsapp),
      template_id: template.id,
      template_name: template.name,
      message_body: body,
      trigger_type: trigger,
      auto,
    })
    if (res.ok && res.log) setWaLogs((prev) => [res.log!, ...prev])
  }

  function saveStatus() {
    setMessage(null)
    startTransition(async () => {
      const res = await updateApplicationStatus(applicationId, target, reason)
      setConfirming(false)
      if (!res.ok) { setMessage({ tone: 'error', text: res.error }); return }
      if (!res.data.changed) {
        setMessage({ tone: 'info', text: 'Status unchanged — nothing was saved and no message was prepared.' })
        return
      }
      setStatus(res.data.status)
      setReason('')
      setMessage({ tone: 'success', text: `Status updated to "${STATUS_META[res.data.status].label}".` })
      router.refresh()

      // Only after a real status change, and only if enabled in settings.
      const setting = AUTO_SETTING[res.data.status]
      const trigger = STATUS_TEMPLATE_TRIGGER[res.data.status]
      if (setting && waSettings?.[setting] && waNumberValid && trigger) {
        const template = waTemplates.find((t) => t.active && t.trigger_type === trigger)
        if (template) {
          const body = replacePlaceholders(template.body, { ...ctx, applicationStatus: STATUS_META[res.data.status].label })
          await prepareMessage(template, body, trigger, true)
        }
      }
    })
  }

  function onSave() {
    if (target === status) {
      setMessage({ tone: 'info', text: 'That is already the current status.' })
      return
    }
    if (needsReason && !reason.trim()) {
      setMessage({ tone: 'error', text: `Please give a reason for "${STATUS_META[target].label}".` })
      return
    }
    if (CONFIRM.includes(target)) setConfirming(true)
    else saveStatus()
  }

  function toggleArchive() {
    setMessage(null)
    startTransition(async () => {
      const res = archived ? await restoreApplication(applicationId) : await archiveApplication(applicationId, archiveReason)
      setArchiveOpen(false)
      if (!res.ok) { setMessage({ tone: 'error', text: res.error }); return }
      setMessage({ tone: 'success', text: archived ? 'Application restored.' : 'Application archived. It remains in the records and reports.' })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <DataCard title="Decision">
        <div className="flex flex-col gap-4">
          {message && <Notice tone={message.tone === 'info' ? 'info' : message.tone}>{message.text}</Notice>}

          {!canUpdate ? (
            <p className="text-sm text-muted-foreground">You have view-only access to this application.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="status-select" className="text-sm font-medium">Application status</label>
                <select
                  id="status-select"
                  value={target}
                  onChange={(e) => { setTarget(e.target.value as ApplicationStatus); setMessage(null) }}
                  className={fieldClass}
                  disabled={pending}
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}{s === status ? ' (current)' : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{STATUS_META[target].description}</p>
              </div>

              {target !== status && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="status-reason" className="text-sm font-medium">
                    {target === 'info_requested' ? 'What information is needed?' : 'Reason / note'}
                    {needsReason && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
                  </label>
                  <Textarea
                    id="status-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={target === 'info_requested' ? 'e.g. Please send a certified copy of your matric certificate.' : 'Optional for this status'}
                  />
                  <p className="text-xs text-muted-foreground">Saved as an internal note in the application history.</p>
                </div>
              )}

              <Button onClick={onSave} disabled={pending || target === status} className="h-10 gap-2">
                {pending && <Loader2 className="size-4 animate-spin" />}
                Save status
              </Button>

              <div className="border-t border-border pt-4">
                {archived ? (
                  <Button variant="outline" onClick={toggleArchive} disabled={pending} className="h-10 w-full gap-2">
                    <ArchiveRestore className="size-4" /> Restore from archive
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => setArchiveOpen(true)} disabled={pending} className="h-10 w-full gap-2 text-muted-foreground">
                    <Archive className="size-4" /> Archive application
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DataCard>

      <ConfirmDialog
        open={confirming}
        title={`Mark as "${STATUS_META[target].label}"?`}
        description={
          target === 'approved'
            ? `${applicantName} will be accepted and a student record will be created.`
            : `This records an admission decision for ${applicantName}. It is logged in the application history.`
        }
        confirmLabel={`Yes, mark ${STATUS_META[target].label.toLowerCase()}`}
        destructive={target !== 'approved'}
        busy={pending}
        onConfirm={saveStatus}
        onCancel={() => setConfirming(false)}
      />

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this application?"
        description="Archived applications are hidden from the default list but are never deleted. You can restore it at any time."
        confirmLabel="Archive"
        busy={pending}
        onConfirm={toggleArchive}
        onCancel={() => setArchiveOpen(false)}
      >
        <label htmlFor="archive-reason" className="text-sm font-medium">Reason (optional)</label>
        <Textarea id="archive-reason" rows={2} value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} />
      </ConfirmDialog>

      <DataCard title="WhatsApp">
        <div className="flex flex-col gap-4">
          {!waNumberValid && <Notice tone="warning">No valid WhatsApp number on this application.</Notice>}

          {waTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates configured. <a href="/admin/whatsapp" className="font-medium text-primary hover:underline">Set up templates →</a>
            </p>
          ) : (
            <>
              <div>
                <label htmlFor="wa-template" className="mb-1.5 block text-sm font-medium text-muted-foreground">Template</label>
                <select id="wa-template" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className={fieldClass}>
                  {waTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {messagePreview && (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{messagePreview}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!messagePreview}
                  className="gap-2"
                  onClick={async () => {
                    await navigator.clipboard.writeText(messagePreview)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  <ClipboardCopy className="size-3.5" /> {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  disabled={!waNumberValid || !messagePreview || !canUpdate}
                  className="flex-1 gap-2 bg-[#25D366] text-white hover:bg-[#1ebe57]"
                  onClick={() => selectedTemplate && prepareMessage(selectedTemplate, messagePreview, 'manual', false)}
                >
                  <MessageCircle className="size-3.5" /> Open in WhatsApp
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Opens WhatsApp with the message ready to send. Whether it is actually sent and delivered can&apos;t be
                tracked here.
              </p>
            </>
          )}
        </div>
      </DataCard>

      {waLogs.length > 0 && (
        <DataCard title="Messages prepared">
          <div className="flex flex-col gap-2">
            {waLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  aria-expanded={expandedLog === log.id}
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{log.template_name ?? 'Manual message'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(log.sent_at)} · {log.sent_by} · delivery not tracked
                    </p>
                  </div>
                  {expandedLog === log.id
                    ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                </button>
                {expandedLog === log.id && (
                  <p className="mt-2 whitespace-pre-wrap border-t border-border pt-2 text-xs leading-relaxed text-foreground">
                    {log.message_body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DataCard>
      )}
    </div>
  )
}
