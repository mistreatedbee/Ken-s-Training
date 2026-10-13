import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { COURSE_STATUS_META, PAYMENT_STATUS_META, STATUS_META, isApplicationStatus } from '@/lib/statuses'

export function PageHeader({
  title, description, actions,
}: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-4 py-8 sm:px-6', className)}>{children}</div>
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (!isApplicationStatus(status)) return <Badge variant="outline" className={className}>{status}</Badge>
  const meta = STATUS_META[status]
  return <Badge variant={meta.variant} className={className} title={meta.description}>{meta.label}</Badge>
}

export function PaymentBadge({ status }: { status: string | null | undefined }) {
  const meta = PAYMENT_STATUS_META[status ?? 'no_fee'] ?? PAYMENT_STATUS_META.no_fee
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

export function CourseStatusBadge({ status }: { status: string }) {
  const meta = COURSE_STATUS_META[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Inbox className="mx-auto size-12 text-muted-foreground/40" />
      <p className="mt-3 font-serif text-lg font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message }: { title?: string; message?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="mx-auto size-10 text-destructive/60" />
      <p className="mt-3 font-serif text-lg font-semibold text-destructive">{title}</p>
      {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
      <p className="mt-1 text-sm text-muted-foreground">
        This is an error loading data, not an empty list. Try refreshing; if it persists, check that the latest
        database migration has been run.
      </p>
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'error'; children: React.ReactNode }) {
  const styles = {
    info: 'border-primary/20 bg-primary/5 text-foreground',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
    success: 'border-success/30 bg-success/10 text-success',
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', styles[tone])}>
      {children}
    </div>
  )
}

export function StatCard({
  label, value, hint, href, tone = 'default',
}: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: 'default' | 'warning' | 'success' | 'destructive' }) {
  const toneClass = {
    default: '',
    warning: 'border-l-4 border-l-amber-500',
    success: 'border-l-4 border-l-success',
    destructive: 'border-l-4 border-l-destructive',
  }[tone]
  const body = (
    <div className={cn('h-full rounded-2xl border border-border bg-card p-5 transition', href && 'hover:border-primary/40 hover:shadow-md', toneClass)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{body}</Link> : body
}

/** Build a URL that keeps the current search params and overrides some. */
export function withParams(base: string, current: Record<string, string | undefined>, overrides: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...current, ...overrides })) {
    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function Pagination({
  base, params, page, pageSize, total,
}: { base: string; params: Record<string, string | undefined>; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const link = 'inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted'
  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p>Showing {from}–{to} of {total}</p>
      <div className="flex items-center gap-2">
        {page > 1
          ? <Link className={link} href={withParams(base, params, { page: page - 1 })}><ChevronLeft className="size-4" /> Previous</Link>
          : <span className={cn(link, 'pointer-events-none opacity-40')} aria-disabled="true"><ChevronLeft className="size-4" /> Previous</span>}
        <span className="px-2">Page {page} of {pages}</span>
        {page < pages
          ? <Link className={link} href={withParams(base, params, { page: page + 1 })}>Next <ChevronRight className="size-4" /></Link>
          : <span className={cn(link, 'pointer-events-none opacity-40')} aria-disabled="true">Next <ChevronRight className="size-4" /></span>}
      </div>
    </nav>
  )
}

export function DataCard({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 p-6 pb-4">
        <h2 className="font-serif text-xl font-semibold leading-none">{title}</h2>
        {actions}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </section>
  )
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm text-foreground">{children ?? '—'}</dd>
    </div>
  )
}

export const fieldClass =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

export const textareaClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

export function Field({
  label, htmlFor, hint, error, required, children, className,
}: { label: string; htmlFor?: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}
