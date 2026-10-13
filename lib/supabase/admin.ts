import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client. SERVER ONLY — bypasses RLS. Used solely for the
 * public submission/upload path (which calls tightly-scoped database
 * functions) — never for admin reads/writes, which go through the
 * signed-in user's session so RLS applies.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.')
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
