import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SITE_CONTENT, normalizeSiteContent, type SiteContent } from '@/lib/site-content'

/** Website text from the database; falls back to the defaults if it can't be loaded. */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('kti_site_content').select('content').eq('id', 'site').maybeSingle()
    if (error) {
      console.error('[site-content] load failed:', error.message)
      return DEFAULT_SITE_CONTENT
    }
    return normalizeSiteContent(data?.content)
  } catch (err) {
    console.error('[site-content] load failed:', err)
    return DEFAULT_SITE_CONTENT
  }
}
