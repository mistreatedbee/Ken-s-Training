'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted print:hidden"
    >
      Print / Export PDF
    </button>
  )
}
