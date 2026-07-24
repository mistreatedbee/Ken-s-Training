export type WaTriggerType = 'submission' | 'approved' | 'rejected' | 'under_review' | 'manual'

export interface MessageContext {
  applicantName: string
  programmeName: string
  applicationId: string
  applicationStatus: string
  submissionDate: string
}

/** Strip all non-digit chars and normalise to E.164 (no leading +). SA 0XX → 27XX. */
export function formatWhatsAppNumber(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '27' + digits.slice(1)
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }
  return digits
}

export function isValidWhatsAppNumber(raw: string): boolean {
  return /^\d{10,15}$/.test(formatWhatsAppNumber(raw))
}

export function buildWhatsAppUrl(rawNumber: string, message?: string): string {
  const number = formatWhatsAppNumber(rawNumber)
  if (!message) return `https://wa.me/${number}`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function replacePlaceholders(template: string, ctx: MessageContext): string {
  return template
    .replace(/\{\{ApplicantName\}\}/g, ctx.applicantName)
    .replace(/\{\{ProgrammeName\}\}/g, ctx.programmeName || 'the programme')
    .replace(/\{\{CourseName\}\}/g, ctx.programmeName || 'the programme')
    .replace(/\{\{ApplicationID\}\}/g, ctx.applicationId)
    .replace(/\{\{ApplicationStatus\}\}/g, ctx.applicationStatus)
    .replace(/\{\{SubmissionDate\}\}/g, ctx.submissionDate)
}
