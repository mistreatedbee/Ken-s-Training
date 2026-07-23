'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function PaymentVerifyButton({ paymentId }: { paymentId: string }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function update(status: 'verified' | 'rejected') {
    setLoading(status)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('payments').update({
      verification_status: status,
      verified_by: user?.id,
      verified_at: new Date().toISOString(),
    }).eq('id', paymentId)
    setDone(status)
    setLoading(null)
  }

  if (done) {
    return (
      <span className="text-sm font-medium capitalize text-success">
        {done === 'verified' ? <CheckCircle2 className="inline size-4 mr-1" /> : <XCircle className="inline size-4 mr-1" />}
        {done}
      </span>
    )
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => update('verified')}
        disabled={!!loading}
        className="gap-1 bg-success hover:bg-success/90"
      >
        {loading === 'verified' ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
        Verify
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => update('rejected')}
        disabled={!!loading}
        className="gap-1"
      >
        {loading === 'rejected' ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
        Reject
      </Button>
    </div>
  )
}
