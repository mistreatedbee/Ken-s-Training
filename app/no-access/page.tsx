import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getStaff } from '@/lib/auth'

export const metadata = { title: 'No admin access — KTI' }

export default async function NoAccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (await getStaff()) redirect('/admin')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-4 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-amber-500/15">
        <ShieldAlert className="size-8 text-amber-600" />
      </span>
      <h1 className="mt-6 font-serif text-2xl font-bold text-foreground">No admin access</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        You are signed in as <span className="font-medium text-foreground">{user.email}</span>, but this account
        has not been given a staff role. Ask a super administrator to add you under Staff &amp; roles.
      </p>
      <div className="mt-8 flex gap-3">
        <form action="/auth/signout" method="POST">
          <button className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Sign out
          </button>
        </form>
        <Link href="/" className="inline-flex items-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
          Go home
        </Link>
      </div>
    </div>
  )
}
