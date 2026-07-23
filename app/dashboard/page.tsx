import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Bell, CheckCircle2, Clock, FileText, LogOut, Upload, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Application, Notification, Payment } from '@/lib/types'

export const metadata = { title: "My Application — Ken's Training Institute" }

const STATUS_META = {
  draft:        { label: 'Draft',        variant: 'secondary' as const,    icon: Clock },
  submitted:    { label: 'Submitted',    variant: 'default' as const,      icon: FileText },
  under_review: { label: 'Under review', variant: 'warning' as const,      icon: Clock },
  approved:     { label: 'Approved',     variant: 'success' as const,      icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     variant: 'destructive' as const,  icon: XCircle },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: applications }, { data: notifications }, { data: payments }] =
    await Promise.all([
      supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
      supabase
        .from('applications')
        .select('*, programmes(name, duration_years)')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('payments')
        .select('*')
        .in(
          'application_id',
          (applications ?? []).map((a: Application) => a.id),
        )
        .order('created_at', { ascending: false }),
    ])

  const unreadCount = (notifications ?? []).filter((n: Notification) => !n.is_read).length

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1 bg-secondary">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground">
                Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
              </h1>
              <p className="mt-1 text-muted-foreground">Track your application and make updates here.</p>
            </div>
            <form action="/auth/signout" method="POST">
              <button className={cn(buttonVariants({ variant: 'ghost' }), 'gap-2 text-muted-foreground')}>
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </div>

          {/* Applications */}
          <section aria-labelledby="applications-heading" className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="applications-heading" className="font-serif text-xl font-semibold text-foreground">
                Your applications
              </h2>
              {!(applications ?? []).some((a: Application) => a.status === 'draft') && (
                <Link href="/apply" className={cn(buttonVariants(), 'gap-2')}>
                  New application <ArrowRight className="size-4" />
                </Link>
              )}
            </div>

            {(applications ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <FileText className="mx-auto size-12 text-muted-foreground/40" />
                <p className="mt-3 font-serif text-lg font-semibold text-foreground">No applications yet</p>
                <p className="mt-1 text-muted-foreground">Start your application to study at KTI.</p>
                <Link href="/apply" className={cn(buttonVariants(), 'mt-5 gap-2')}>
                  Start application <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(applications ?? []).map((app: Application & { programmes?: { name: string; duration_years: number } }) => {
                  const meta = STATUS_META[app.status]
                  const Icon = meta.icon
                  const appPayments = (payments ?? []).filter((p: Payment) => p.application_id === app.id)
                  return (
                    <Card key={app.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-lg">{app.programmes?.name ?? 'Application'}</CardTitle>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              Ref: <span className="font-mono font-medium">{app.student_number}</span>
                            </p>
                          </div>
                          <Badge variant={meta.variant} className="gap-1 px-3 py-1 text-sm">
                            <Icon className="size-3.5" />
                            {meta.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        {app.status === 'draft' && (
                          <Link href="/apply" className={cn(buttonVariants(), 'w-fit gap-2')}>
                            Continue application <ArrowRight className="size-4" />
                          </Link>
                        )}
                        {app.status === 'rejected' && app.rejection_reason && (
                          <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                            <p className="font-semibold">Reason for rejection:</p>
                            <p className="mt-1">{app.rejection_reason}</p>
                          </div>
                        )}
                        {app.status === 'approved' && (
                          <PaymentSection appId={app.id} payments={appPayments} />
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          {/* Notifications */}
          {(notifications ?? []).length > 0 && (
            <section aria-labelledby="notifications-heading">
              <div className="mb-4 flex items-center gap-2">
                <h2 id="notifications-heading" className="font-serif text-xl font-semibold text-foreground">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {(notifications ?? []).map((n: Notification) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 rounded-xl border border-border p-4',
                      !n.is_read && 'bg-primary/5 border-primary/20',
                    )}
                  >
                    <Bell className={cn('mt-0.5 size-5 shrink-0', !n.is_read ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <p className="font-medium text-foreground">{n.title}</p>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString('en-ZA', { dateStyle: 'medium' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function PaymentSection({
  appId, payments,
}: { appId: string; payments: Payment[] }) {
  const verified = payments.find((p) => p.verification_status === 'verified')
  const pending = payments.find((p) => p.verification_status === 'pending')

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-success/10 p-4 text-sm font-medium text-success">
        <CheckCircle2 className="size-5" />
        Payment confirmed — Welcome to Ken&apos;s Training Institute!
      </div>
    )
  }

  if (pending) {
    return (
      <div className="rounded-xl bg-warning/10 p-4 text-sm">
        <p className="font-medium text-warning-foreground">Payment proof uploaded — awaiting verification</p>
        <p className="mt-1 text-muted-foreground">Reference: {pending.reference_number}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <p className="font-semibold text-foreground">Payment required</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Please make payment to the banking details below and upload your proof of payment.
      </p>
      <div className="mt-4 rounded-xl bg-muted p-4 text-sm">
        <p className="font-semibold text-foreground">Banking details</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Bank</dt><dd className="font-medium text-foreground">FNB</dd>
          <dt className="text-muted-foreground">Account name</dt><dd className="font-medium text-foreground">Ken&apos;s Training Institute</dd>
          <dt className="text-muted-foreground">Account number</dt><dd className="font-mono font-medium text-foreground">62 000 000 000</dd>
          <dt className="text-muted-foreground">Branch code</dt><dd className="font-mono font-medium text-foreground">250 655</dd>
          <dt className="text-muted-foreground">Reference</dt><dd className="font-mono font-medium text-foreground">Your student number</dd>
        </dl>
      </div>
      <Link
        href={`/dashboard/payment?app=${appId}`}
        className={cn(buttonVariants(), 'mt-4 gap-2 w-fit')}
      >
        <Upload className="size-4" /> Upload proof of payment
      </Link>
    </div>
  )
}
