import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ApplicationWizard } from '@/components/application/wizard'

export const metadata = { title: "Apply — Ken's Training Institute" }

export default async function ApplyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/signup?next=/apply')

  // Load or create draft application
  const { data: existing } = await supabase
    .from('applications')
    .select('*')
    .eq('profile_id', user.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: programmes } = await supabase
    .from('programmes')
    .select('*')
    .eq('is_active', true)
    .order('duration_years')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <ApplicationWizard
      userId={user.id}
      initialApplication={existing ?? null}
      programmes={programmes ?? []}
      userFullName={profile?.full_name ?? ''}
    />
  )
}
