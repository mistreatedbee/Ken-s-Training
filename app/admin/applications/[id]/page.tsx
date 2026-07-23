import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, FileText, UserCheck, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AdminApplicationActions } from '@/components/admin/application-actions'

export const metadata = { title: 'Application Detail — KTI Admin' }

const STATUS_META = {
  draft:        { label: 'Draft',        variant: 'secondary' as const },
  submitted:    { label: 'Submitted',    variant: 'default' as const },
  under_review: { label: 'Under review', variant: 'warning' as const },
  approved:     { label: 'Approved',     variant: 'success' as const },
  rejected:     { label: 'Rejected',     variant: 'destructive' as const },
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: app }, { data: documents }, { data: payments }, { data: auditLog }, { data: reviewers }] =
    await Promise.all([
      supabase
        .from('applications')
        .select(`
          *,
          profiles!profile_id(full_name, phone, role),
          programmes(name, duration_years),
          reviewer:profiles!reviewer_id(full_name)
        `)
        .eq('id', id)
        .single(),
      supabase.from('application_documents').select('*').eq('application_id', id),
      supabase.from('payments').select('*').eq('application_id', id).order('created_at', { ascending: false }),
      supabase
        .from('audit_log')
        .select('*, profiles(full_name)')
        .eq('application_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('profiles').select('id, full_name').eq('role', 'reviewer'),
    ])

  if (!app) notFound()

  const pi = app.personal_info as Record<string, string> | null
  const cd = app.contact_details as Record<string, string> | null
  const kin = app.next_of_kin as Record<string, string> | null
  const edu = app.education as Record<string, string> | null
  const ch = app.church_background as Record<string, string | boolean | null> | null
  const st = app.personal_statement as Record<string, string> | null
  const profileData = app.profiles as { full_name?: string } | null
  const reviewerData = app.reviewer as { full_name?: string } | null

  const name = profileData?.full_name ?? (pi ? `${pi.first_name ?? ''} ${pi.last_name ?? ''}`.trim() : '—')
  const status = app.status as keyof typeof STATUS_META
  const meta = STATUS_META[status]

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}>
          <ArrowLeft className="size-4" /> Applications
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">{name}</h1>
          <p className="mt-1 font-mono text-muted-foreground">{app.student_number}</p>
        </div>
        <Badge variant={meta.variant} className="gap-1 px-4 py-2 text-base">
          {meta.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          <DataCard title="Personal information">
            <Row label="Full name">{name}</Row>
            <Row label="Date of birth">{pi?.date_of_birth ?? '—'}</Row>
            <Row label="ID / Passport">{pi?.id_number ?? '—'}</Row>
            <Row label="Gender">{pi?.gender ?? '—'}</Row>
            <Row label="Marital status">{pi?.marital_status ?? '—'}</Row>
            <Row label="Nationality">{pi?.nationality ?? '—'}</Row>
          </DataCard>

          <DataCard title="Contact details">
            <Row label="Phone">{cd?.phone ?? '—'}</Row>
            <Row label="WhatsApp">{cd?.whatsapp ?? '—'}</Row>
            <Row label="Address">{cd?.physical_address ?? '—'}</Row>
            <Row label="City">{cd?.physical_city ?? '—'}</Row>
            <Row label="Province">{cd?.physical_province ?? '—'}</Row>
          </DataCard>

          <DataCard title="Next of kin">
            <Row label="Name">{kin?.full_name ?? '—'}</Row>
            <Row label="Relationship">{kin?.relationship ?? '—'}</Row>
            <Row label="Phone">{kin?.phone ?? '—'}</Row>
            <Row label="Email">{kin?.email ?? '—'}</Row>
          </DataCard>

          <DataCard title="Education">
            <Row label="Highest qualification">{edu?.highest_qualification ?? '—'}</Row>
            <Row label="Institution">{edu?.institution ?? '—'}</Row>
            <Row label="Year completed">{edu?.year_completed ?? '—'}</Row>
            <Row label="Subjects">{edu?.subjects ?? '—'}</Row>
          </DataCard>

          <DataCard title="Church & ministry">
            <Row label="Church">{ch?.church_name as string ?? '—'}</Row>
            <Row label="Denomination">{ch?.denomination as string ?? '—'}</Row>
            <Row label="Pastor">{ch?.pastor_name as string ?? '—'}</Row>
            <Row label="Role">{ch?.role as string ?? '—'}</Row>
            <Row label="Years of service">{ch?.years_of_service as string ?? '—'}</Row>
            <Row label="Serves in ministry">{ch?.serves_ministry === true ? 'Yes' : ch?.serves_ministry === false ? 'No' : '—'}</Row>
            {ch?.ministry_detail && <Row label="Ministry detail">{ch.ministry_detail as string}</Row>}
          </DataCard>

          <DataCard title="Personal statement">
            {st?.motivation && (
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Why do you want to study theology?</dt>
                <dd className="whitespace-pre-wrap text-foreground">{st.motivation}</dd>
              </div>
            )}
            {st?.calling && (
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Their calling</dt>
                <dd className="whitespace-pre-wrap text-foreground">{st.calling}</dd>
              </div>
            )}
            {st?.goals && (
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-muted-foreground">Long-term goals</dt>
                <dd className="whitespace-pre-wrap text-foreground">{st.goals}</dd>
              </div>
            )}
          </DataCard>

          {/* Documents */}
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              {(documents ?? []).length === 0 ? (
                <p className="text-muted-foreground">No documents uploaded.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(documents ?? []).map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                      <FileText className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                        <p className="text-xs capitalize text-muted-foreground">{doc.document_type.replace('_', ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit log */}
          {(auditLog ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Activity log</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {(auditLog ?? []).map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-sm">
                      <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <span className="font-medium text-foreground">{entry.action}</span>
                        {(entry.profiles as { full_name?: string })?.full_name && (
                          <span className="text-muted-foreground"> by {(entry.profiles as { full_name?: string }).full_name}</span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString('en-ZA')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          <DataCard title="Application">
            <Row label="Programme">{(app.programmes as { name?: string })?.name ?? '—'}</Row>
            <Row label="Submitted">{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-ZA') : 'Not submitted'}</Row>
            <Row label="Reviewer">{reviewerData?.full_name ?? 'Not assigned'}</Row>
          </DataCard>

          {/* Payment */}
          {(payments ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {(payments ?? []).map((p) => (
                  <div key={p.id} className={cn(
                    'rounded-xl p-3 text-sm',
                    p.verification_status === 'verified' ? 'bg-success/10' : 'bg-muted',
                  )}>
                    <p className="font-medium text-foreground">
                      {p.amount_paid ? `R${p.amount_paid}` : 'Amount unknown'}
                    </p>
                    <p className="text-muted-foreground">Ref: {p.reference_number}</p>
                    <p className="capitalize text-muted-foreground">{p.verification_status}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <AdminApplicationActions
            applicationId={id}
            currentStatus={app.status}
            reviewers={reviewers ?? []}
            currentReviewerId={app.reviewer_id}
          />
        </div>
      </div>
    </div>
  )
}

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">{children}</dl>
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}
