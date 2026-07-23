'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, UserCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Props {
  applicationId: string
  currentStatus: string
  reviewers: { id: string; full_name: string | null }[]
  currentReviewerId: string | null
}

export function AdminApplicationActions({ applicationId, currentStatus, reviewers, currentReviewerId }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [selectedReviewer, setSelectedReviewer] = useState(currentReviewerId ?? '')
  const [loading, setLoading] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(newStatus: string, reason?: string) {
    setLoading(newStatus)
    setError(null)
    setSuccess(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const update: Record<string, unknown> = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
    }
    if (reason) update.rejection_reason = reason

    const { error: updateErr } = await supabase.from('applications').update(update).eq('id', applicationId)
    if (updateErr) { setError(updateErr.message); setLoading(null); return }

    // Audit log
    await supabase.from('audit_log').insert([{
      application_id: applicationId,
      performed_by: user?.id,
      action: `Status changed to ${newStatus}`,
      details: reason ? { rejection_reason: reason } : {},
    }])

    // Notify student
    const { data: app } = await supabase.from('applications').select('profile_id').eq('id', applicationId).single()
    if (app) {
      const messages: Record<string, { title: string; message: string }> = {
        approved: { title: 'Application approved!', message: 'Congratulations! Your application to KTI has been approved. Please check your dashboard for payment details.' },
        rejected: { title: 'Application update', message: `Your application has been reviewed. Unfortunately, it was not approved at this time.${reason ? ` Reason: ${reason}` : ''}` },
        under_review: { title: 'Application under review', message: 'Your application is now being reviewed by our team. We will be in touch soon.' },
      }
      const msg = messages[newStatus]
      if (msg) {
        await supabase.from('notifications').insert([{
          profile_id: app.profile_id,
          ...msg,
          link: '/dashboard',
        }])
      }
    }

    setStatus(newStatus)
    setSuccess(`Status updated to "${newStatus}"`)
    setShowRejectForm(false)
    setLoading(null)
  }

  async function assignReviewer() {
    if (!selectedReviewer) return
    setLoading('reviewer')
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateErr } = await supabase
      .from('applications').update({ reviewer_id: selectedReviewer }).eq('id', applicationId)
    if (updateErr) { setError(updateErr.message); setLoading(null); return }

    await supabase.from('reviewer_assignments').upsert([{
      application_id: applicationId,
      reviewer_id: selectedReviewer,
      assigned_by: user?.id,
    }])

    await supabase.from('audit_log').insert([{
      application_id: applicationId,
      performed_by: user?.id,
      action: 'Reviewer assigned',
      details: { reviewer_id: selectedReviewer },
    }])

    await supabase.from('notifications').insert([{
      profile_id: selectedReviewer,
      title: 'New application assigned',
      message: 'An application has been assigned to you for review.',
      link: `/admin/applications/${applicationId}`,
    }])

    setSuccess('Reviewer assigned')
    setLoading(null)
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

        {/* Status actions */}
        <div className="flex flex-col gap-2">
          {status === 'submitted' && (
            <Button
              onClick={() => updateStatus('under_review')}
              disabled={!!loading}
              className="w-full gap-2"
            >
              {loading === 'under_review' ? <Loader2 className="size-4 animate-spin" /> : null}
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
                {loading === 'approved' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Approve
              </Button>
              {!showRejectForm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                  disabled={!!loading}
                  className="w-full gap-2"
                >
                  <XCircle className="size-4" /> Reject
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
                      {loading === 'rejected' ? <Loader2 className="size-4 animate-spin" /> : null}
                      Confirm reject
                    </Button>
                    <Button variant="outline" onClick={() => setShowRejectForm(false)} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Reviewer assignment */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Label htmlFor="reviewer">Assign reviewer</Label>
          <div className="flex gap-2">
            <select
              id="reviewer"
              value={selectedReviewer}
              onChange={(e) => setSelectedReviewer(e.target.value)}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
            >
              <option value="">Select reviewer…</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={assignReviewer}
              disabled={!selectedReviewer || loading === 'reviewer'}
              className="gap-1"
            >
              {loading === 'reviewer' ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
              Assign
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
