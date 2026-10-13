import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireStaffPage } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminApplicationActions } from '@/components/admin/application-actions'
import {
  ApplicantEditor, NotesPanel, PaymentsPanel,
  type Financials, type NoteRow, type PaymentRow,
} from '@/components/admin/application-panels'
import { DataCard, Notice, PageShell, PaymentBadge, Row, StatusBadge } from '@/components/admin/ui'
import { CORE_FIELDS, normalizeConfig, type FieldConfig } from '@/lib/form-config'
import { formatDate, formatDateTime, formatMoney, type PriceQuote } from '@/lib/format'
import { isApplicationStatus, statusLabel, studyModeLabel } from '@/lib/statuses'
import type { DocRef, WhatsAppLog, WhatsAppSettings, WhatsAppTemplate } from '@/lib/types'

export const metadata = { title: 'Application — KTI Admin' }
export const dynamic = 'force-dynamic'

type Json = Record<string, unknown>

interface EventRow {
  id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  details: Json | null
  actor_email: string | null
  created_at: string
}

function eventText(e: EventRow): string {
  switch (e.event_type) {
    case 'submitted': return 'Application submitted'
    case 'status_changed': return `Status changed: ${statusLabel(e.from_status ?? '')} → ${statusLabel(e.to_status ?? '')}`
    case 'record_edited': return `Edited: ${Object.keys(e.details ?? {}).map((k) => k.replace(/_/g, ' ')).join(', ')}`
    case 'archived': return 'Archived'
    case 'restored': return 'Restored from archive'
    case 'note_added': return 'Internal note added'
    case 'payment_recorded': return `${e.details?.kind === 'refund' ? 'Refund' : 'Payment'} recorded: ${formatMoney(e.details?.amount as string, (e.details?.currency as string) ?? 'ZAR')}`
    case 'payment_voided': return `Payment voided${e.details?.reason ? ` (${e.details.reason})` : ''}`
    case 'message_prepared': return `WhatsApp message prepared${e.details?.template ? `: ${e.details.template}` : ''} (delivery not tracked)`
    default: return e.event_type
  }
}

function display(v: unknown): string {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const staff = await requireStaffPage()
  const supabase = await createClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select('*, courses:kti_courses(id, code, name), intakes(id, name, starts_on), form_versions(config)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!app) notFound()

  const [eventsRes, notesRes, paymentsRes, finRes, waLogsRes, waTemplatesRes, waSettingsRes, publishedRes] = await Promise.all([
    supabase.from('application_events').select('*').eq('application_id', id).order('created_at', { ascending: false }),
    supabase.from('application_notes').select('id, body, author_email, created_at').eq('application_id', id).order('created_at', { ascending: false }),
    supabase.from('payments').select('*').eq('application_id', id).order('created_at', { ascending: false }),
    supabase.from('application_financials').select('*').eq('application_id', id).maybeSingle(),
    supabase.from('whatsapp_logs').select('*').eq('application_id', id).order('sent_at', { ascending: false }),
    supabase.from('whatsapp_templates').select('*').eq('active', true).order('trigger_type').order('name'),
    supabase.from('whatsapp_settings').select('*').maybeSingle(),
    supabase.from('form_versions').select('config').eq('status', 'published').maybeSingle(),
  ])

  // Labels: the form version the applicant saw, falling back to the current form.
  const appConfig = normalizeConfig((app.form_versions as { config?: unknown } | null)?.config ?? publishedRes.data?.config)
  const editConfig = normalizeConfig(publishedRes.data?.config)

  const columns: Record<string, Json> = {
    personal_info: (app.personal_info ?? {}) as Json,
    contact_details: (app.contact_details ?? {}) as Json,
    next_of_kin: (app.next_of_kin ?? {}) as Json,
    education: (app.education ?? {}) as Json,
    personal_statement: (app.personal_statement ?? {}) as Json,
    custom_answers: (app.custom_answers ?? {}) as Json,
  }
  const valueOf = (key: string) => {
    const core = CORE_FIELDS[key]
    return core ? columns[core.column][core.dbKey ?? key] : columns.custom_answers[key]
  }

  const name = (app.applicant_name as string) || 'Unknown applicant'
  const cd = columns.contact_details
  const status = isApplicationStatus(app.status) ? app.status : 'submitted'
  const price = app.price_snapshot as PriceQuote | null
  const course = app.courses as { id: string; code: string; name: string } | null
  const intake = app.intakes as { name: string; starts_on: string | null } | null
  const docs = ((app.documents as DocRef[] | null) ?? [])
  const canUpdate = can(staff.role, 'applications.update')

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      const { data } = await supabase.storage.from('application-documents').createSignedUrl(doc.path, 600)
      return { ...doc, signedUrl: data?.signedUrl ?? null }
    }),
  )

  // Values for the editor, keyed by field.
  const editSections = editConfig.steps
    .map((s) => ({ title: s.title, fields: s.fields.filter((f) => f.enabled || valueOf(f.key) !== undefined) }))
    .filter((s) => s.fields.length > 0)
  const editValues: Record<string, string | boolean | null> = {}
  for (const s of editSections) for (const f of s.fields) {
    const v = valueOf(f.key)
    editValues[f.key] = typeof v === 'boolean' ? v : v === undefined || v === null ? '' : String(v)
  }

  return (
    <PageShell>
      <div className="mb-6">
        <Link href="/admin/applications" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}>
          <ArrowLeft className="size-4" /> All applications
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-bold text-foreground">{name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{app.student_number}</p>
        </div>
        <StatusBadge status={status} className="px-4 py-2 text-base" />
      </div>

      {app.archived_at && (
        <div className="mb-6">
          <Notice tone="warning">
            Archived on {formatDate(app.archived_at)}{app.archive_reason ? ` — ${app.archive_reason}` : ''}. Archived
            applications are kept for the record and hidden from the default list.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {appConfig.steps.map((step) => {
            const fields = step.fields.filter((f: FieldConfig) => {
              const v = valueOf(f.key)
              return v !== undefined && v !== null && v !== ''
            })
            if (fields.length === 0) return null
            return (
              <DataCard key={step.key} title={step.title}>
                <dl className="flex flex-col gap-3">
                  {fields.map((f) => <Row key={f.key} label={f.label}>{display(valueOf(f.key))}</Row>)}
                </dl>
              </DataCard>
            )
          })}

          {canUpdate && (
            <ApplicantEditor applicationId={id} sections={editSections} values={editValues} />
          )}

          <DataCard title="Documents">
            {docsWithUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {docsWithUrls.map((doc) => (
                  <li key={doc.path} className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {appConfig.documents.find((d) => d.type === doc.type)?.label ?? doc.type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    {doc.signedUrl ? (
                      <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
                        <Download className="size-3.5" /> View
                      </a>
                    ) : <span className="text-xs text-destructive">File missing</span>}
                  </li>
                ))}
              </ul>
            )}
            {docsWithUrls.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Links are private and expire after 10 minutes.</p>}
          </DataCard>

          <NotesPanel applicationId={id} notes={(notesRes.data ?? []) as NoteRow[]} canAdd={canUpdate} />

          <DataCard title="History">
            {(eventsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No history recorded yet.</p>
            ) : (
              <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
                {((eventsRes.data ?? []) as EventRow[]).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden="true" />
                    <p className="text-sm text-foreground">{eventText(e)}</p>
                    {e.event_type === 'status_changed' && typeof e.details?.reason === 'string' && (
                      <p className="text-xs text-muted-foreground">Reason: {e.details.reason}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{e.actor_email ?? 'System'} · {formatDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </DataCard>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <DataCard title="Application summary">
            <dl className="flex flex-col gap-3">
              <Row label="Course">
                {course ? <Link href={`/admin/courses/${course.id}`} className="text-primary hover:underline">{course.name}</Link> : (app.programme ?? '—')}
              </Row>
              {intake && <Row label="Intake">{intake.name}</Row>}
              {app.study_mode && <Row label="Study mode">{studyModeLabel(app.study_mode)}</Row>}
              <Row label="Submitted">{formatDateTime(app.submitted_at)}</Row>
              {app.reviewed_at && <Row label="Last decision">{formatDateTime(app.reviewed_at)}</Row>}
              {app.rejection_reason && <Row label="Rejection reason">{app.rejection_reason}</Row>}
              <Row label="Declaration">{app.declaration ? `Signed by ${app.signature_data ?? '—'}` : 'Not signed'}</Row>
            </dl>
            <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
              <p className="font-semibold text-foreground">Fees quoted at submission</p>
              {price ? (
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  <li>Course fee: {formatMoney(price.tuition_fee, price.currency)}</li>
                  {Number(price.discount_amount) > 0 && <li>Discount{price.discount_label ? ` (${price.discount_label})` : ''}: −{formatMoney(price.discount_amount, price.currency)}</li>}
                  {Number(price.registration_fee) > 0 && <li>Registration fee: {formatMoney(price.registration_fee, price.currency)}</li>}
                  {price.other_fees?.map((f, i) => <li key={i}>{f.label}: {formatMoney(f.amount, price.currency)}</li>)}
                  <li className="font-semibold text-foreground">Total: {formatMoney(price.total, price.currency)}</li>
                </ul>
              ) : (
                <p className="mt-1 text-muted-foreground">No fees were set for this course when the application was submitted.</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">This amount is fixed and doesn&apos;t change if the course price changes later.</p>
            </div>
          </DataCard>

          <AdminApplicationActions
            applicationId={id}
            reference={app.student_number ?? ''}
            currentStatus={status}
            archived={!!app.archived_at}
            canUpdate={canUpdate}
            applicantName={name}
            applicantWhatsapp={String(cd.whatsapp || cd.phone || '')}
            programmeName={course?.name ?? app.programme ?? ''}
            submissionDate={formatDate(app.submitted_at, 'long')}
            initialWaLogs={(waLogsRes.data ?? []) as WhatsAppLog[]}
            waTemplates={(waTemplatesRes.data ?? []) as WhatsAppTemplate[]}
            waSettings={(waSettingsRes.data ?? null) as WhatsAppSettings | null}
          />

          <PaymentsPanel
            applicationId={id}
            payments={(paymentsRes.data ?? []) as PaymentRow[]}
            financials={(finRes.data ?? null) as Financials | null}
            canManage={can(staff.role, 'payments.manage')}
            statusBadge={<PaymentBadge status={(finRes.data as Financials | null)?.payment_status} />}
          />
        </div>
      </div>
    </PageShell>
  )
}
