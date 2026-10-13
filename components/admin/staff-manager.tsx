'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { DataCard, Field, Notice, fieldClass } from '@/components/admin/ui'
import { addStaffMember, resetStaffPassword, updateStaffMember } from '@/app/actions/admin/staff'
import { ROLE_META, ROLES, type Role } from '@/lib/permissions'
import { formatDate } from '@/lib/format'

export interface StaffRow { user_id: string; email: string; full_name: string | null; role: Role; active: boolean; created_at: string }

export function StaffManager({ staff, currentUserId }: { staff: StaffRow[]; currentUserId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', fullName: '', role: 'read_only' })
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState<StaffRow | null>(null)
  const [pending, start] = useTransition()

  function add(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null); setSecret(null)
    start(async () => {
      const res = await addStaffMember(form)
      if (!res.ok) { setMsg({ tone: 'error', text: res.error }); return }
      if (res.data.tempPassword) setSecret({ email: form.email, password: res.data.tempPassword })
      setMsg({ tone: 'success', text: res.data.tempPassword ? 'Account created.' : 'Existing account given staff access.' })
      setForm({ email: '', fullName: '', role: 'read_only' })
      router.refresh()
    })
  }

  function change(userId: string, patch: { role?: string; active?: boolean }) {
    setMsg(null)
    start(async () => {
      const res = await updateStaffMember(userId, patch)
      setMsg(res.ok ? { tone: 'success', text: 'Saved.' } : { tone: 'error', text: res.error })
      router.refresh()
    })
  }

  function reset() {
    if (!confirmReset) return
    const target = confirmReset
    start(async () => {
      const res = await resetStaffPassword(target.user_id)
      setConfirmReset(null)
      if (!res.ok) { setMsg({ tone: 'error', text: res.error }); return }
      setSecret({ email: target.email, password: res.data.tempPassword })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {secret && (
        <Notice tone="warning">
          <p className="font-semibold">One-time password for {secret.email}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <code className="rounded bg-background px-2 py-1 font-mono text-base text-foreground">{secret.password}</code>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => navigator.clipboard.writeText(secret.password)}>
              <Copy className="size-3.5" /> Copy
            </Button>
          </p>
          <p className="mt-1">Share it privately. It won&apos;t be shown again — ask them to change it under My account after signing in.</p>
        </Notice>
      )}

      <DataCard title="Add staff member">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-3" noValidate>
          <Field label="Email" htmlFor="s-email" required>
            <input id="s-email" type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Full name" htmlFor="s-name">
            <input id="s-name" className={fieldClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="s-role">
            <select id="s-role" className={fieldClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </select>
          </Field>
          <Button type="submit" disabled={pending || !form.email} className="h-10 gap-2 self-start px-4 sm:col-span-3 sm:justify-self-start">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Add staff member
          </Button>
        </form>
      </DataCard>

      <DataCard title={`Staff (${staff.length})`}>
        <ul className="flex flex-col divide-y divide-border">
          {staff.map((s) => (
            <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.full_name || s.email}{s.user_id === currentUserId && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{s.email} · added {formatDate(s.created_at)}{!s.active && ' · deactivated'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={`role-${s.user_id}`} className="sr-only">Role for {s.email}</label>
                <select id={`role-${s.user_id}`} className={`${fieldClass} h-9 w-auto`} value={s.role} disabled={pending} onChange={(e) => change(s.user_id, { role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                </select>
                <Button variant="outline" size="sm" className="h-9" disabled={pending} onClick={() => change(s.user_id, { active: !s.active })}>
                  {s.active ? 'Deactivate' : 'Reactivate'}
                </Button>
                {s.user_id !== currentUserId && (
                  <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" disabled={pending} onClick={() => setConfirmReset(s)}>
                    Reset password
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DataCard>

      <ConfirmDialog
        open={!!confirmReset}
        title={`Reset password for ${confirmReset?.email}?`}
        description="Their current password stops working immediately and a new one-time password is shown to you."
        confirmLabel="Reset password"
        destructive
        busy={pending}
        onConfirm={reset}
        onCancel={() => setConfirmReset(null)}
      />
    </div>
  )
}
