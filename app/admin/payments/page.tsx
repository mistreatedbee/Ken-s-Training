import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PaymentVerifyButton } from '@/components/admin/payment-verify-button'

export const metadata = { title: 'Payments — KTI Admin' }

export default async function AdminPaymentsPage() {
  const supabase = await createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select(`
      *,
      applications!inner(student_number, profiles!profile_id(full_name))
    `)
    .order('created_at', { ascending: false })

  const counts = {
    pending: (payments ?? []).filter((p) => p.verification_status === 'pending').length,
    verified: (payments ?? []).filter((p) => p.verification_status === 'verified').length,
    rejected: (payments ?? []).filter((p) => p.verification_status === 'rejected').length,
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-foreground">Payments</h1>
        <p className="mt-1 text-muted-foreground">{(payments ?? []).length} total payments</p>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Clock className="size-5 text-warning" />} label="Pending verification" count={counts.pending} color="warning" />
        <StatCard icon={<CheckCircle2 className="size-5 text-success" />} label="Verified" count={counts.verified} color="success" />
        <StatCard icon={<XCircle className="size-5 text-destructive" />} label="Rejected" count={counts.rejected} color="destructive" />
      </div>

      {(payments ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">No payments yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(payments ?? []).map((payment) => {
            const app = payment.applications as { student_number?: string; profiles?: { full_name?: string } } | null
            const name = app?.profiles?.full_name ?? '—'

            return (
              <Card key={payment.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-semibold text-foreground">{name}</p>
                    <p className="font-mono text-sm text-muted-foreground">{app?.student_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.amount_paid ? `R${payment.amount_paid} ` : ''}
                      {payment.payment_date ? `• ${new Date(payment.payment_date).toLocaleDateString('en-ZA')}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">Ref: {payment.reference_number}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={payment.verification_status} />
                    {payment.verification_status === 'pending' && (
                      <PaymentVerifyButton paymentId={payment.id} />
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 font-serif text-3xl font-bold text-foreground">{count}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    pending: { label: 'Pending', variant: 'warning' as const },
    verified: { label: 'Verified', variant: 'success' as const },
    rejected: { label: 'Rejected', variant: 'destructive' as const },
  }
  const m = map[status as keyof typeof map] ?? { label: status, variant: 'secondary' as const }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
