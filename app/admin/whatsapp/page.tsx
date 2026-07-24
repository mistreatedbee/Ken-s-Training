import { MessageCircle, AlertTriangle } from 'lucide-react'
import { WhatsAppTemplates } from '@/components/admin/whatsapp-templates'
import { getWhatsAppTemplates, getWhatsAppSettings } from '@/app/actions/whatsapp'

export const metadata = { title: 'WhatsApp — KTI Admin' }

export default async function WhatsAppPage() {
  const [templatesResult, settingsResult] = await Promise.allSettled([
    getWhatsAppTemplates(),
    getWhatsAppSettings(),
  ])

  const tablesExist = templatesResult.status === 'fulfilled'
  const templates = tablesExist ? templatesResult.value : []
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : null

  return (
    <div className="px-6 py-8">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#25D366]/15">
          <MessageCircle className="size-6 text-[#25D366]" />
        </div>
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">WhatsApp Communications</h1>
          <p className="mt-1 text-muted-foreground">
            Manage message templates and notification settings for applicants.
          </p>
        </div>
      </div>

      {!tablesExist && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800">Database migration required</p>
            <p className="mt-1 text-sm text-amber-700">
              Run{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                supabase/migrations/20240102_whatsapp_members.sql
              </code>{' '}
              in your Supabase SQL Editor to enable WhatsApp features and the Members module.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-3xl">
        <WhatsAppTemplates initialTemplates={templates} initialSettings={settings} />
      </div>
    </div>
  )
}
