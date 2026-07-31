'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </span>

      <h1 className="mt-6 font-serif text-2xl font-bold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The admin dashboard encountered an error. This is usually a temporary
        issue — please try again.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className="size-4" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
