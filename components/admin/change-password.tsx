'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Notice, fieldClass } from '@/components/admin/ui'
import { createClient } from '@/lib/supabase/client'

export function ChangePasswordForm() {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (pw.length < 10) { setMsg({ tone: 'error', text: 'Use at least 10 characters.' }); return }
    if (pw !== confirm) { setMsg({ tone: 'error', text: 'The passwords do not match.' }); return }
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setMsg({ tone: 'error', text: error.message }); return }
    setPw(''); setConfirm('')
    setMsg({ tone: 'success', text: 'Password changed.' })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Field label="New password" htmlFor="pw1" hint="At least 10 characters">
        <input id="pw1" type="password" autoComplete="new-password" className={fieldClass} value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Confirm new password" htmlFor="pw2">
        <input id="pw2" type="password" autoComplete="new-password" className={fieldClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" disabled={busy} className="h-10 gap-2 self-start px-4">
        {busy && <Loader2 className="size-4 animate-spin" />} Change password
      </Button>
    </form>
  )
}
