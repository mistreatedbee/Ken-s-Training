'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, Upload } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

function PaymentForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const appId = searchParams.get('app')

  const [referenceNumber, setReferenceNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please select a proof of payment file.'); return }
    if (!referenceNumber) { setError('Please enter your payment reference number.'); return }
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setLoading(false); return }

    const path = `${user.id}/${appId}/proof-${Date.now()}-${file.name}`
    const { error: uploadErr } = await supabase.storage.from('payment-proofs').upload(path, file)
    if (uploadErr) { setError(uploadErr.message); setLoading(false); return }

    const { error: dbErr } = await supabase.from('payments').insert([{
      application_id: appId,
      amount_paid: amountPaid ? parseFloat(amountPaid) : null,
      payment_date: paymentDate || null,
      reference_number: referenceNumber,
      proof_storage_path: path,
      proof_file_name: file.name,
      verification_status: 'pending',
    }])

    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-16 text-success" />
          <h1 className="mt-4 font-serif text-2xl font-bold text-foreground">Proof uploaded!</h1>
          <p className="mt-3 text-muted-foreground">
            We have received your proof of payment. Our team will verify it and update your application status within 2 working days.
          </p>
          <Button className="mt-6 h-11 w-full" onClick={() => router.push('/dashboard')}>
            Back to my application
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link href="/" aria-label="Home"><BrandLogo /></Link>
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold text-foreground">Upload proof of payment</h1>
            <p className="mt-1 text-muted-foreground">
              After paying, upload your bank receipt or screenshot here.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 rounded-xl bg-muted p-4 text-sm">
            <p className="font-semibold text-foreground">Banking details</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Bank</dt><dd className="font-medium text-foreground">FNB</dd>
              <dt className="text-muted-foreground">Account</dt><dd className="font-mono font-medium text-foreground">62 000 000 000</dd>
              <dt className="text-muted-foreground">Branch</dt><dd className="font-mono font-medium text-foreground">250 655</dd>
            </dl>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ref" required>Payment reference number</Label>
              <Input id="ref" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Your student number or bank ref" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="date" required>Date of payment</Label>
              <Input id="date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Amount paid (R)</Label>
              <Input id="amount" type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="e.g. 500.00" />
            </div>
            <div className="flex flex-col gap-2">
              <Label required>Proof of payment file</Label>
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-muted/20 hover:bg-primary/5">
                <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file ? (
                  <span className="text-sm font-medium text-success">{file.name}</span>
                ) : (
                  <>
                    <Upload className="size-6 text-muted-foreground" />
                    <span className="mt-1 text-sm text-muted-foreground">Click to choose file (PDF, JPG, PNG)</span>
                  </>
                )}
              </label>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="h-11 gap-2 text-base">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {loading ? 'Uploading…' : 'Submit proof of payment'}
            </Button>
          </form>

          <Link href="/dashboard" className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to my application
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PaymentUploadPage() {
  return (
    <Suspense>
      <PaymentForm />
    </Suspense>
  )
}
