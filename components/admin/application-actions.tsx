'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface Props {
  applicationId: string
  currentStatus: string
}

export function AdminApplicationActions({ applicationId, currentStatus }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(newStatus: string, reason?: string) {
    setLoading(newStatus)
    setError(null)
    setSuccess(null)
    const supabase = createClient()

    const update: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
    }
    if (reason) update.rejection_reason = reason

    const { error: updateErr } = await supabase
      .from('applications')
      .update(update)
      .eq('id', applicationId)

    if (updateErr) {
      setError(updateErr.message)
      setLoading(null)
      return
    }

    setStatus(newStatus)
    setSuccess(`Status updated to "${newStatus.replace('_', ' ')}"`)
    setShowRejectForm(false)
    setLoading(null)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        {success && (
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm font-medium text-success">{success}</p>
        )}
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          {status === 'submitted' && (
            <Button
              onClick={() => updateStatus('under_review')}
              disabled={!!loading}
              variant="outline"
              className="w-full gap-2"
            >
              {loading === 'under_review' && <Loader2 className="size-4 animate-spin" />}
              Mark as under review
            </Button>
          )}

          {['submitted', 'under_review'].includes(status) && (
            <>
              <Button
                onClick={() => updateStatus('approved')}
                disabled={!!loading}
                className="w-full gap-2 bg-success hover:bg-success/90"
              >
                {loading === 'approved'
                  ? <Loader2 className="size-4 animate-spin" />
                  : <CheckCircle2 className="size-4" />}
                Approve application
              </Button>

              {!showRejectForm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                  disabled={!!loading}
                  className="w-full gap-2"
                >
                  <XCircle className="size-4" /> Reject application
                </Button>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <Label htmlFor="reason">Reason for rejection</Label>
                  <Textarea
                    id="reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this application is being rejected…"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => updateStatus('rejected', rejectionReason)}
                      disabled={!rejectionReason.trim() || !!loading}
                      className="flex-1 gap-2"
                    >
                      {loading === 'rejected' && <Loader2 className="size-4 animate-spin" />}
                      Confirm rejection
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {status === 'approved' && (
            <p className="rounded-xl bg-success/10 px-3 py-3 text-sm font-medium text-success text-center">
              This application has been approved.
            </p>
          )}

          {status === 'rejected' && (
            <Button
              variant="outline"
              onClick={() => updateStatus('under_review')}
              disabled={!!loading}
              className="w-full gap-2"
            >
              {loading === 'under_review' && <Loader2 className="size-4 animate-spin" />}
              Reopen for review
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
