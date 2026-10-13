export const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'info_requested',
  'approved',
  'waitlisted',
  'rejected',
  'withdrawn',
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'

export const STATUS_META: Record<ApplicationStatus, { label: string; variant: BadgeVariant; description: string }> = {
  submitted:      { label: 'Submitted',          variant: 'default',     description: 'New application awaiting review' },
  under_review:   { label: 'Under review',       variant: 'warning',     description: 'Being reviewed by admissions' },
  info_requested: { label: 'Info requested',     variant: 'warning',     description: 'Waiting for the applicant to provide more information' },
  approved:       { label: 'Accepted',           variant: 'success',     description: 'Accepted — a student record has been created' },
  waitlisted:     { label: 'Waitlisted',         variant: 'secondary',   description: 'On the waiting list for a place' },
  rejected:       { label: 'Rejected',           variant: 'destructive', description: 'Application was not successful' },
  withdrawn:      { label: 'Withdrawn',          variant: 'outline',     description: 'Withdrawn by or on behalf of the applicant' },
}

/** Statuses that need an admin decision. */
export const OPEN_STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'info_requested']

/** Statuses where a written reason is required. */
export const REASON_REQUIRED: ApplicationStatus[] = ['rejected', 'info_requested', 'withdrawn']

export function isApplicationStatus(v: unknown): v is ApplicationStatus {
  return typeof v === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(v)
}

export function statusLabel(status: string): string {
  return isApplicationStatus(status) ? STATUS_META[status].label : status
}

/** WhatsApp template trigger associated with each status. */
export const STATUS_TEMPLATE_TRIGGER: Partial<Record<ApplicationStatus, string>> = {
  under_review: 'under_review',
  info_requested: 'info_requested',
  approved: 'approved',
  waitlisted: 'waitlisted',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
}

export const PAYMENT_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  no_fee:         { label: 'No fee recorded', variant: 'outline' },
  unpaid:         { label: 'Unpaid',          variant: 'destructive' },
  partially_paid: { label: 'Partially paid',  variant: 'warning' },
  paid:           { label: 'Paid',            variant: 'success' },
  refunded:       { label: 'Refunded',        variant: 'secondary' },
}

export const COURSE_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  draft:    { label: 'Draft',    variant: 'outline' },
  active:   { label: 'Active',   variant: 'success' },
  inactive: { label: 'Inactive', variant: 'warning' },
  archived: { label: 'Archived', variant: 'secondary' },
}

export const STUDY_MODES = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'blended', label: 'Blended' },
] as const

export function studyModeLabel(v: string | null | undefined) {
  return STUDY_MODES.find((m) => m.value === v)?.label ?? v ?? '—'
}
