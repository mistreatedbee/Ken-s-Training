export function formatMoney(amount: number | string | null | undefined, currency = 'ZAR'): string {
  if (amount === null || amount === undefined || amount === '') return '—'
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

export function formatDate(iso: string | null | undefined, style: 'medium' | 'long' = 'medium'): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-ZA', { dateStyle: style })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

/** RFC 4180 CSV cell. Also neutralises spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** Price snapshot / quote shape produced by course_price_quote(). */
export interface PriceQuote {
  price_id: string
  currency: string
  tuition_fee: number | string
  registration_fee: number | string
  other_fees: { label: string; amount: number | string }[]
  discount_amount: number | string
  discount_label: string | null
  total: number | string
  effective_from: string
  quoted_at: string
}
