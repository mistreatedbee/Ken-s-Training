import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AdminApplicationActions } from '@/components/admin/application-actions'
import type { DocRef } from '@/lib/types'

export const metadata = { title: 'Application Detail — KTI Admin' }

const STATUS_META = {
  submitted:    { label: 'Submitted',    variant: 'default' as const },
  under_review: { label: 'Under review', variant: 'warning' as const },
  approved:     { label: 'Approved',     variant: 'success' as const },
  rejected:     { label: 'Rejected',     variant: 'destructive' as const },
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: app } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .single()

  if (!app) notFound()

  const pi = app.personal_info as Record<string, string> | null
  const cd = app.contact_details as Record<string, string | boolean | null> | null
  const kin = app.next_of_kin as Record<string, string> | null
  const edu = app.education as Record<string, string> | null
  const ch = app.church_background as Record<string, string | boolean | null> | null
  const st = app.personal_statement as Record<string, string> | null
  const docs = (app.documents as DocRef[] | null) ?? []

  const name = pi ? `${pi.first_name ?? ''} ${pi.last_name ?? ''}`.trim() : 'Unknown applicant'
  const status = app.status as keyof typeof STATUS_META
  const meta = STATUS_META[status]

  // Generate signed URLs for documents (valid 1 hour)
  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      const { data } = await supabase.storage
        .from('application-documents')
        .createSignedUrl(doc.path, 3600)
      return { ...doc, signedUrl: data?.signedUrl ?? null }
    }),
  )

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <Link href="/admin" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}>
          <ArrowLeft className="size-4" /> All applications
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">{name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{app.student_number}</p>
        </div>
        {meta && <Badge variant={meta.variant} className="px-4 py-2 text-base">{meta.label}</Badge>}
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
            <Row label="Phone">{cd?.phone as string ?? '—'}</Row>
            <Row label="WhatsApp">{cd?.whatsapp as string ?? '—'}</Row>
            <Row label="Address">{cd?.physical_address as string ?? '—'}</Row>
            <Row label="City">{cd?.physical_city as string ?? '—'}</Row>
            <Row label="Province">{cd?.physical_province as string ?? '—'}</Row>
            <Row label="Postal code">{cd?.postal_code as string ?? '—'}</Row>
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
            {edu?.additional_qualifications && (
              <Row label="Additional">{edu.additional_qualifications}</Row>
            )}
          </DataCard>

          <DataCard title="Church & ministry">
            <Row label="Church">{ch?.church_name as string ?? '—'}</Row>
            <Row label="Denomination">{ch?.denomination as string ?? '—'}</Row>
            <Row label="Location">{ch?.city as string ?? '—'}</Row>
            <Row label="Pastor">{ch?.pastor_name as string ?? '—'}</Row>
            <Row label="Role">{ch?.role as string ?? '—'}</Row>
            <Row label="Years at church">{ch?.years_of_service as string ?? '—'}</Row>
            <Row label="Serves in ministry">{ch?.serves_ministry === true ? 'Yes' : ch?.serves_ministry === false ? 'No' : '—'}</Row>
            {ch?.ministry_detail && <Row label="Ministry detail">{ch.ministry_detail as string}</Row>}
          </DataCard>

          <DataCard title="Personal statement">
            {st?.motivation && (
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-muted-foreground">Why do they want to study theology?</dt>
                <dd className="whitespace-pre-wrap text-sm text-foreground">{st.motivation}</dd>
              </div>
            )}
            {st?.calling && (
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-muted-foreground">Their calling to ministry</dt>
                <dd className="whitespace-pre-wrap text-sm text-foreground">{st.calling}</dd>
              </div>
            )}
            {st?.goals && (
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-muted-foreground">Long-term goals</dt>
                <dd className="whitespace-pre-wrap text-sm text-foreground">{st.goals}</dd>
              </div>
            )}
          </DataCard>

          {/* Documents */}
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              {docsWithUrls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {docsWithUrls.map((doc) => (
                    <div key={doc.path} className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="size-5 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs capitalize text-muted-foreground">{doc.type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {doc.signedUrl && (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
                        >
                          <Download className="size-3.5" /> View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          <DataCard title="Application summary">
            <Row label="Programme">{app.programme ?? '—'}</Row>
            <Row label="Submitted">{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-ZA', { dateStyle: 'long' }) : '—'}</Row>
            {app.reviewed_at && (
              <Row label="Reviewed">{new Date(app.reviewed_at).toLocaleDateString('en-ZA', { dateStyle: 'long' })}</Row>
            )}
            {app.rejection_reason && (
              <div className="rounded-xl bg-destructive/10 p-3">
                <p className="text-xs font-semibold text-destructive">Rejection reason</p>
                <p className="mt-1 text-sm text-foreground">{app.rejection_reason}</p>
              </div>
            )}
          </DataCard>

          <DataCard title="Declaration">
            <Row label="Signed">{app.declaration ? 'Yes' : 'No'}</Row>
            {app.signature_data && <Row label="Signature">{app.signature_data}</Row>}
          </DataCard>

          <AdminApplicationActions
            applicationId={id}
            currentStatus={app.status}
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
