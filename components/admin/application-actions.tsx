'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Loader2,
  MessageCircle,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { logWhatsAppMessage } from '@/app/actions/whatsapp'
import {
  buildWhatsAppUrl,
  formatWhatsAppNumber,
  isValidWhatsAppNumber,
  replacePlaceholders,
  type WaTriggerType,
} from '@/lib/whatsapp'
import type { WhatsAppLog, WhatsAppSettings, WhatsAppTemplate } from '@/lib/types'

interface Props {
  applicationId: string
  currentStatus: string
  applicantName: string
  applicantWhatsapp: string
  programmeName: string
  submissionDate: string
  initialWaLogs: WhatsAppLog[]
  waTemplates: WhatsAppTemplate[]
  waSettings: WhatsAppSettings | null
}

export function AdminApplicationActions({
  applicationId,
  currentStatus,
  applicantName,
  applicantWhatsapp,
  programmeName,
  submissionDate,
  initialWaLogs,
  waTemplates,
  waSettings,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // WhatsApp state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(waTemplates[0]?.id ?? '')
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>(initialWaLogs)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)

  const messageContext = useMemo(
    () => ({
      applicantName,
      programmeName,
      applicationId,
      applicationStatus: status,
      submissionDate,
    }),
    [applicantName, programmeName, applicationId, status, submissionDate],
  )

  const selectedTemplate = waTemplates.find((t) => t.id === selectedTemplateId) ?? null

  const messagePreview = useMemo(
    () => (selectedTemplate ? replacePlaceholders(selectedTemplate.body, messageContext) : ''),
    [selectedTemplate, messageContext],
  )

  const waNumberValid = isValidWhatsAppNumber(applicantWhatsapp)

  async function updateStatus(newStatus: string, reason?: string) {
    setLoading(newStatus)
    setError(null)
    setSuccess(null)
    const supabase = createClient()

    const update: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
    }
    if (reason) update.rejection_reason = reason

    const { error: updateErr } = await supabase
      .from('applications')
      .update(update)
      .eq('id', applicationId)

    if (updateErr) {
      setError(updateErr.message)
      setLoading(null)
      return
    }

    setStatus(newStatus)
    setSuccess(`Status updated to "${newStatus.replace('_', ' ')}"`)
    setShowRejectForm(false)
    setLoading(null)
    router.refresh()

    // Auto-send WhatsApp if enabled
    const triggerMap: Record<string, keyof WhatsAppSettings> = {
      approved: 'auto_send_on_approval',
      rejected: 'auto_send_on_rejection',
      submitted: 'auto_send_on_submission',
    }
    const settingKey = triggerMap[newStatus]
    if (waSettings && settingKey && waSettings[settingKey] && waNumberValid) {
      const autoTemplate = waTemplates.find(
        (t) => t.active && t.trigger_type === newStatus,
      )
      if (autoTemplate) {
        const msg = replacePlaceholders(autoTemplate.body, { ...messageContext, applicationStatus: newStatus })
        const url = buildWhatsAppUrl(applicantWhatsapp, msg)
        window.open(url, '_blank')
        void logWhatsAppMessage({
          application_id: applicationId,
          applicant_name: applicantName,
          whatsapp_number: formatWhatsAppNumber(applicantWhatsapp),
          template_id: autoTemplate.id,
          template_name: autoTemplate.name,
          message_body: msg,
          trigger_type: newStatus as WaTriggerType,
          sent_by: 'admin (auto)',
        }).then(() => {
          const newLog: WhatsAppLog = {
            id: crypto.randomUUID(),
            application_id: applicationId,
            applicant_name: applicantName,
            whatsapp_number: formatWhatsAppNumber(applicantWhatsapp),
            template_id: autoTemplate.id,
            template_name: autoTemplate.name,
            message_body: msg,
            trigger_type: newStatus,
            sent_by: 'admin (auto)',
            sent_at: new Date().toISOString(),
          }
          setWaLogs((prev) => [newLog, ...prev])
        })
      }
    }
  }

  async function openWhatsApp() {
    if (!waNumberValid || !messagePreview) return
    const url = buildWhatsAppUrl(applicantWhatsapp, messagePreview)
    window.open(url, '_blank')

    void logWhatsAppMessage({
      application_id: applicationId,
      applicant_name: applicantName,
      whatsapp_number: formatWhatsAppNumber(applicantWhatsapp),
      template_id: selectedTemplate?.id,
      template_name: selectedTemplate?.name,
      message_body: messagePreview,
      trigger_type: 'manual',
      sent_by: 'admin',
    }).then(() => {
      const newLog: WhatsAppLog = {
        id: crypto.randomUUID(),
        application_id: applicationId,
        applicant_name: applicantName,
        whatsapp_number: formatWhatsAppNumber(applicantWhatsapp),
        template_id: selectedTemplate?.id ?? null,
        template_name: selectedTemplate?.name ?? null,
        message_body: messagePreview,
        trigger_type: 'manual',
        sent_by: 'admin',
        sent_at: new Date().toISOString(),
      }
      setWaLogs((prev) => [newLog, ...prev])
    })
  }

  async function copyMessage() {
    if (!messagePreview) return
    await navigator.clipboard.writeText(messagePreview)
    setCopying(true)
    setTimeout(() => setCopying(false), 1500)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status actions */}
      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {success && (
            <p className="rounded-xl bg-success/10 px-3 py-2 text-sm font-medium text-success">{success}</p>
          )}
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex flex-col gap-2">
            {status === 'submitted' && (
              <Button
                onClick={() => updateStatus('under_review')}
                disabled={!!loading}
                variant="outline"
                className="w-full gap-2"
              >
                {loading === 'under_review' && <Loader2 className="size-4 animate-spin" />}
                Mark as under review
              </Button>
            )}

            {['submitted', 'under_review'].includes(status) && (
              <>
                <Button
                  onClick={() => updateStatus('approved')}
                  disabled={!!loading}
                  className="w-full gap-2 bg-success hover:bg-success/90"
                >
                  {loading === 'approved'
                    ? <Loader2 className="size-4 animate-spin" />
                    : <CheckCircle2 className="size-4" />}
                  Approve application
                </Button>

                {!showRejectForm ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectForm(true)}
                    disabled={!!loading}
                    className="w-full gap-2"
                  >
                    <XCircle className="size-4" /> Reject application
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <Label htmlFor="reason">Reason for rejection</Label>
                    <Textarea
                      id="reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this application is being rejected…"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => updateStatus('rejected', rejectionReason)}
                        disabled={!rejectionReason.trim() || !!loading}
                        className="flex-1 gap-2"
                      >
                        {loading === 'rejected' && <Loader2 className="size-4 animate-spin" />}
                        Confirm rejection
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowRejectForm(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === 'approved' && (
              <p className="rounded-xl bg-success/10 px-3 py-3 text-center text-sm font-medium text-success">
                This application has been approved.
              </p>
            )}

            {status === 'rejected' && (
              <Button
                variant="outline"
                onClick={() => updateStatus('under_review')}
                disabled={!!loading}
                className="w-full gap-2"
              >
                {loading === 'under_review' && <Loader2 className="size-4 animate-spin" />}
                Reopen for review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-[#25D366]" />
            WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!waNumberValid && (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
              No valid WhatsApp number on this application.
            </p>
          )}

          {waTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates configured.{' '}
              <a href="/admin/whatsapp" className="font-medium text-primary hover:underline">
                Set up templates →
              </a>
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-muted-foreground">
                  Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {waTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {messagePreview && (
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {messagePreview}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyMessage}
                  disabled={!messagePreview}
                  className="gap-2"
                >
                  <ClipboardCopy className="size-3.5" />
                  {copying ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  onClick={openWhatsApp}
                  disabled={!waNumberValid || !messagePreview}
                  className="flex-1 gap-2 bg-[#25D366] text-white hover:bg-[#1ebe57]"
                >
                  <MessageCircle className="size-3.5" />
                  Open in WhatsApp
                </Button>
              </div>
            </>
          )}

          {waNumberValid && (
            <a
              href={buildWhatsAppUrl(applicantWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Open blank chat with {formatWhatsAppNumber(applicantWhatsapp)}
            </a>
          )}
        </CardContent>
      </Card>

      {/* Communication history */}
      {waLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Communication history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {waLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <button
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {log.template_name ?? 'Manual message'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.sent_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}{log.sent_by}
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
