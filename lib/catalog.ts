import { createClient } from '@/lib/supabase/server'
import { normalizeConfig, DEFAULT_FORM_CONFIG, type FormConfig } from '@/lib/form-config'
import type { PriceQuote } from '@/lib/format'

export interface CatalogIntake {
  id: string
  name: string
  starts_on: string | null
  applications_close_at: string | null
}

export interface CatalogCourse {
  id: string
  code: string
  name: string
  description: string | null
  category: string | null
  qualification_type: string | null
  duration: string | null
  requirements: string | null
  study_modes: string[]
  application_deadline: string | null
  open_for_applications: boolean
  price: PriceQuote | null
  intakes: CatalogIntake[]
}

export interface PublicCatalog {
  courses: CatalogCourse[]
  form: FormConfig
  formVersionId: string | null
}

/** Live courses, prices, intakes and the published form, straight from the database. */
export async function getPublicCatalog(): Promise<PublicCatalog> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_public_catalog')
  if (error) throw new Error(`Could not load courses: ${error.message}`)
  // `kti_courses` is what an early copy of the 20261013 migration returned;
  // accept it so the form keeps working until the corrected one is re-run.
  const raw = data as { courses?: CatalogCourse[]; kti_courses?: CatalogCourse[]; form: unknown; form_version_id: string | null }
  return {
    courses: raw.courses ?? raw.kti_courses ?? [],
    form: raw.form ? normalizeConfig(raw.form) : DEFAULT_FORM_CONFIG,
    formVersionId: raw.form_version_id,
  }
}
