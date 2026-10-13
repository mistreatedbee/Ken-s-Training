/**
 * Admin-configurable application form.
 *
 * The form's structure lives in `form_versions.config` (draft/published).
 * Admins can relabel, reorder, require/optional, enable/disable fields,
 * add custom questions, configure required documents, the declaration,
 * the open/close window and the confirmation message.
 *
 * "Core" fields map onto the existing JSONB columns on `applications`;
 * their type and storage location are fixed in code (CORE_FIELDS) so
 * historical data stays readable. Custom fields are stored in
 * `applications.custom_answers`.
 *
 * This module is shared by the public wizard (client), the submission
 * server action (authoritative validation) and the admin form editor.
 */

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select' | 'radio' | 'yesno'

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email address' },
  { value: 'tel', label: 'Phone number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Multiple choice' },
  { value: 'yesno', label: 'Yes / No' },
]

export interface FieldConfig {
  key: string
  type: FieldType
  label: string
  helper: string
  placeholder: string
  required: boolean
  enabled: boolean
  options: string[]
}

export type StepKey = 'personal' | 'contact' | 'kin' | 'education' | 'statement'

export interface StepConfig {
  key: StepKey
  title: string
  short: string
  intro: string
  enabled: boolean
  fields: FieldConfig[]
}

export interface DocumentConfig {
  type: string
  label: string
  hint: string
  required: boolean
  enabled: boolean
}

export interface FormConfig {
  version: 1
  settings: {
    applications_open: boolean
    opens_at: string | null
    closes_at: string | null
    closed_message: string
  }
  welcome: { title: string; intro: string }
  course_step: { title: string; short: string; label: string; helper: string }
  steps: StepConfig[]
  documents_step: { title: string; short: string; intro: string }
  documents: DocumentConfig[]
  declaration: { text: string; accept_label: string }
  confirmation: { title: string; message: string; next_steps: string[] }
}

export type Answers = Record<string, string | boolean | null>

// ── Core fields ─────────────────────────────────────────────────

type Column = 'personal_info' | 'contact_details' | 'next_of_kin' | 'education' | 'personal_statement'

interface CoreFieldDef {
  step: StepKey
  type: FieldType
  column: Column
  /** Key inside the JSONB column (defaults to the field key). */
  dbKey?: string
  /** Locked fields are always enabled and required (record integrity). */
  locked?: boolean
  /** Only shown (and validated) when another answer has a given value. */
  showIf?: { key: string; equals: string | boolean }
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  maxLength?: number
  format?: 'id_number' | 'year' | 'past_date' | 'postal_code'
}

export const CORE_FIELDS: Record<string, CoreFieldDef> = {
  first_name:        { step: 'personal', type: 'text', column: 'personal_info', locked: true, autoComplete: 'given-name', maxLength: 100 },
  last_name:         { step: 'personal', type: 'text', column: 'personal_info', locked: true, autoComplete: 'family-name', maxLength: 100 },
  date_of_birth:     { step: 'personal', type: 'date', column: 'personal_info', autoComplete: 'bday', format: 'past_date' },
  id_number:         { step: 'personal', type: 'text', column: 'personal_info', locked: true, inputMode: 'numeric', maxLength: 20, format: 'id_number' },
  gender:            { step: 'personal', type: 'radio', column: 'personal_info' },
  marital_status:    { step: 'personal', type: 'select', column: 'personal_info' },
  nationality:       { step: 'personal', type: 'text', column: 'personal_info', autoComplete: 'country-name', maxLength: 100 },

  phone:             { step: 'contact', type: 'tel', column: 'contact_details', locked: true, autoComplete: 'tel', inputMode: 'tel' },
  whatsapp:          { step: 'contact', type: 'tel', column: 'contact_details', inputMode: 'tel' },
  email:             { step: 'contact', type: 'email', column: 'contact_details', autoComplete: 'email', inputMode: 'email', maxLength: 200 },
  physical_address:  { step: 'contact', type: 'textarea', column: 'contact_details', maxLength: 500 },
  physical_city:     { step: 'contact', type: 'text', column: 'contact_details', maxLength: 100 },
  physical_province: { step: 'contact', type: 'select', column: 'contact_details' },
  postal_code:       { step: 'contact', type: 'text', column: 'contact_details', inputMode: 'numeric', maxLength: 10, format: 'postal_code' },
  postal_same:       { step: 'contact', type: 'yesno', column: 'contact_details' },
  postal_address:    { step: 'contact', type: 'textarea', column: 'contact_details', maxLength: 500, showIf: { key: 'postal_same', equals: false } },

  kin_full_name:     { step: 'kin', type: 'text', column: 'next_of_kin', dbKey: 'full_name', maxLength: 150 },
  kin_relationship:  { step: 'kin', type: 'text', column: 'next_of_kin', dbKey: 'relationship', maxLength: 100 },
  kin_phone:         { step: 'kin', type: 'tel', column: 'next_of_kin', dbKey: 'phone', inputMode: 'tel' },
  kin_email:         { step: 'kin', type: 'email', column: 'next_of_kin', dbKey: 'email', inputMode: 'email', maxLength: 200 },

  highest_qualification:     { step: 'education', type: 'select', column: 'education' },
  institution:               { step: 'education', type: 'text', column: 'education', maxLength: 200 },
  year_completed:            { step: 'education', type: 'text', column: 'education', inputMode: 'numeric', maxLength: 4, format: 'year' },
  subjects:                  { step: 'education', type: 'textarea', column: 'education', maxLength: 2000 },
  additional_qualifications: { step: 'education', type: 'textarea', column: 'education', maxLength: 2000 },

  motivation: { step: 'statement', type: 'textarea', column: 'personal_statement', maxLength: 10000 },
  calling:    { step: 'statement', type: 'textarea', column: 'personal_statement', maxLength: 10000 },
  goals:      { step: 'statement', type: 'textarea', column: 'personal_statement', maxLength: 10000 },
}

export const STEP_ORDER: StepKey[] = ['personal', 'contact', 'kin', 'education', 'statement']
/** Steps that must stay enabled (they hold locked fields). */
export const REQUIRED_STEPS: StepKey[] = ['personal', 'contact']

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
]

const QUALIFICATIONS = [
  'Grade 10', 'Grade 11', 'Grade 12 / Matric', 'Certificate', 'Diploma', 'Degree', 'Postgraduate', 'Other',
]

function f(key: string, label: string, opts: Partial<FieldConfig> = {}): FieldConfig {
  return {
    key,
    type: CORE_FIELDS[key]?.type ?? 'text',
    label,
    helper: '',
    placeholder: '',
    required: false,
    enabled: true,
    options: [],
    ...opts,
  }
}

/** The form exactly as it was before it became configurable. */
export const DEFAULT_FORM_CONFIG: FormConfig = {
  version: 1,
  settings: {
    applications_open: true,
    opens_at: null,
    closes_at: null,
    closed_message: 'Applications are currently closed. Please check back later or contact our admissions team.',
  },
  welcome: {
    title: "Welcome!\nLet's begin your application",
    intro: 'We will ask a few simple questions about you and your faith. Take your time — there is no rush.',
  },
  course_step: {
    title: 'Choose a course',
    short: 'Course',
    label: 'Which course would you like to study?',
    helper: 'Read through the options and choose the one that feels right. You can always ask us for help.',
  },
  steps: [
    {
      key: 'personal', title: 'Personal information', short: 'Personal', intro: '', enabled: true,
      fields: [
        f('first_name', 'First name', { helper: 'Enter your name exactly as it appears on your ID.', placeholder: 'Grace', required: true }),
        f('last_name', 'Last name / Surname', { placeholder: 'Mokoena', required: true }),
        f('date_of_birth', 'Date of birth', { required: true }),
        f('id_number', 'South African ID number', { helper: 'Your 13-digit ID number. If you have a passport, enter your passport number.', placeholder: '8001015009087', required: true }),
        f('gender', 'Gender', { required: true, options: ['Male', 'Female', 'Other'] }),
        f('marital_status', 'Marital status', { required: true, options: ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'] }),
        f('nationality', 'Nationality', { placeholder: 'South African', required: true }),
      ],
    },
    {
      key: 'contact', title: 'Contact details', short: 'Contact', intro: '', enabled: true,
      fields: [
        f('phone', 'Phone number', { helper: 'Your main contact number.', placeholder: '082 445 1290', required: true }),
        f('whatsapp', 'WhatsApp number', { helper: 'If different from your phone number — we may contact you via WhatsApp.', placeholder: '082 445 1290' }),
        f('email', 'Email address', { helper: 'Optional. We may send updates about your application here.', placeholder: 'grace@example.com' }),
        f('physical_address', 'Physical address', { helper: 'Where do you live? Include your street, area, and town.', placeholder: '14 Church Street, Polokwane, Limpopo', required: true }),
        f('physical_city', 'City / Town', { placeholder: 'Polokwane', required: true }),
        f('physical_province', 'Province', { required: true, options: PROVINCES }),
        f('postal_code', 'Postal code', { placeholder: '0699' }),
        f('postal_same', 'Is your postal address the same as your physical address?', { required: true }),
        f('postal_address', 'Postal address', { helper: 'Enter your PO Box or postal address.', placeholder: 'PO Box 123, Polokwane, 0699', required: true }),
      ],
    },
    {
      key: 'kin', title: 'Next of kin', short: 'Next of kin', intro: 'Who should we contact in an emergency?', enabled: true,
      fields: [
        f('kin_full_name', 'Full name', { placeholder: 'Mary Mokoena', required: true }),
        f('kin_relationship', 'Relationship to you', { placeholder: 'Mother, Spouse, Sibling', required: true }),
        f('kin_phone', 'Their phone number', { placeholder: '082 445 1290', required: true }),
        f('kin_email', 'Their email address', { helper: 'Optional.', placeholder: 'mary@example.com' }),
      ],
    },
    {
      key: 'education', title: 'Education background', short: 'Education', intro: '', enabled: true,
      fields: [
        f('highest_qualification', 'Highest qualification', { helper: 'What is the highest level of education you have completed?', required: true, options: QUALIFICATIONS }),
        f('institution', 'School or institution', { helper: 'Where did you study or complete this qualification?', placeholder: 'Polokwane High School', required: true }),
        f('year_completed', 'Year completed', { placeholder: '2005', required: true }),
        f('subjects', 'Subjects or areas of study', { helper: 'List the main subjects you studied.', placeholder: 'English, Maths, History, Religious Studies' }),
        f('additional_qualifications', 'Any other qualifications or training?', { helper: 'Include any certificates, short courses, or Bible school training.' }),
      ],
    },
    {
      key: 'statement', title: 'Personal statement', short: 'Statement',
      intro: 'Please answer each question in your own words. There are no wrong answers — just be honest and open.',
      enabled: true,
      fields: [
        f('motivation', 'Why do you want to study theology?', { helper: 'Share what has led you to apply.', required: true }),
        f('calling', 'Describe your calling to ministry', { helper: 'When and how did you feel called by God? What does that calling look like for you?', required: true }),
        f('goals', 'What are your goals after completing this programme?', { helper: 'How will this training help you serve God, your church, and your community?', required: true }),
      ],
    },
  ],
  documents_step: {
    title: 'Documents & declaration',
    short: 'Documents',
    intro: 'Files should be PDF, JPG, or PNG, and no larger than 5 MB each.',
  },
  documents: [
    { type: 'id_document', label: 'South African ID document', hint: 'A clear copy of the front and back of your ID book or ID card.', required: true, enabled: true },
    { type: 'matric_certificate', label: 'Matric certificate or highest qualification', hint: 'A certified copy of your certificate.', required: true, enabled: true },
    { type: 'passport_photo', label: 'Passport-size photo', hint: 'A recent, colour photo with a plain white background.', required: true, enabled: true },
  ],
  declaration: {
    text: "I declare that all information I have provided in this application is true and complete to the best of my knowledge. I understand that any false information may result in my application being rejected or my enrolment being cancelled. I consent to Ken's Training Institute verifying my documents and contacting my references.",
    accept_label: 'I accept the declaration above and confirm my information is correct',
  },
  confirmation: {
    title: 'Your application is in!',
    message: "Thank you for applying to Ken's Training Institute. We have received your application and will be in touch soon.",
    next_steps: [
      'Our team reviews your application within 5 working days.',
      'We may contact your next of kin to confirm your details.',
      'You will receive a call or message with the outcome and next steps.',
    ],
  },
}

// ── Normalisation (sanitises admin input and stored configs) ────

const CUSTOM_KEY = /^custom_[a-z0-9_]{1,40}$/
const DOC_TYPE = /^[a-z0-9_]{2,40}$/

function str(v: unknown, max: number, fallback = ''): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim() === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function stringList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== 'string') continue
    const s = item.trim().slice(0, maxLen)
    if (s && !out.includes(s)) out.push(s)
    if (out.length >= maxItems) break
  }
  return out
}

function normalizeField(raw: Record<string, unknown>, fallback: FieldConfig | undefined): FieldConfig | null {
  const key = typeof raw.key === 'string' ? raw.key : ''
  const core = CORE_FIELDS[key]
  if (!core && !CUSTOM_KEY.test(key)) return null

  const type: FieldType = core
    ? core.type
    : FIELD_TYPES.some((t) => t.value === raw.type) ? (raw.type as FieldType) : 'text'

  const field: FieldConfig = {
    key,
    type,
    label: str(raw.label, 300).trim() || fallback?.label || key,
    helper: str(raw.helper, 1000, fallback?.helper ?? ''),
    placeholder: str(raw.placeholder, 200, fallback?.placeholder ?? ''),
    required: bool(raw.required, fallback?.required ?? false),
    enabled: bool(raw.enabled, fallback?.enabled ?? true),
    options: type === 'select' || type === 'radio'
      ? stringList(raw.options, 100, 200)
      : [],
  }
  if ((type === 'select' || type === 'radio') && field.options.length === 0) {
    field.options = fallback?.options ?? []
  }
  if (core?.locked) {
    field.required = true
    field.enabled = true
  }
  return field
}

/**
 * Turn any stored or submitted config into a complete, safe FormConfig.
 * Unknown keys are dropped, every core field is present exactly once,
 * locked fields are forced on, and lengths are capped.
 */
export function normalizeConfig(input: unknown): FormConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>
  const d = DEFAULT_FORM_CONFIG

  const rawSteps: Record<string, any>[] = Array.isArray(raw.steps) ? raw.steps : []
  const seen = new Set<string>()

  const steps: StepConfig[] = STEP_ORDER.map((stepKey) => {
    const def = d.steps.find((s) => s.key === stepKey)!
    const rs = rawSteps.find((s) => s && s.key === stepKey) ?? {}
    const rawFields: Record<string, unknown>[] = Array.isArray(rs.fields) ? rs.fields : def.fields

    const fields: FieldConfig[] = []
    for (const rf of rawFields) {
      if (!rf || typeof rf !== 'object') continue
      const key = (rf as { key?: unknown }).key
      if (typeof key !== 'string' || seen.has(key)) continue
      const core = CORE_FIELDS[key]
      if (core && core.step !== stepKey) continue
      const field = normalizeField(rf, def.fields.find((x) => x.key === key))
      if (!field) continue
      seen.add(key)
      fields.push(field)
    }
    // Any core field missing from the input is restored from the defaults.
    for (const df of def.fields) {
      if (!seen.has(df.key)) {
        seen.add(df.key)
        fields.push({ ...df })
      }
    }

    return {
      key: stepKey,
      title: str(rs.title, 120).trim() || def.title,
      short: str(rs.short, 40).trim() || def.short,
      intro: str(rs.intro, 1000, def.intro),
      enabled: REQUIRED_STEPS.includes(stepKey) ? true : bool(rs.enabled, def.enabled),
      fields,
    }
  })

  const docSeen = new Set<string>()
  const documents: DocumentConfig[] = (Array.isArray(raw.documents) ? raw.documents : d.documents)
    .filter((x: any) => x && typeof x === 'object' && typeof x.type === 'string' && DOC_TYPE.test(x.type))
    .filter((x: any) => (docSeen.has(x.type) ? false : (docSeen.add(x.type), true)))
    .slice(0, 20)
    .map((x: any) => ({
      type: x.type,
      label: str(x.label, 200).trim() || x.type,
      hint: str(x.hint, 500),
      required: bool(x.required, false),
      enabled: bool(x.enabled, true),
    }))

  const s = raw.settings ?? {}
  const opens = isoOrNull(s.opens_at)
  const closes = isoOrNull(s.closes_at)

  return {
    version: 1,
    settings: {
      applications_open: bool(s.applications_open, d.settings.applications_open),
      opens_at: opens,
      closes_at: closes && opens && closes <= opens ? null : closes,
      closed_message: str(s.closed_message, 1000).trim() || d.settings.closed_message,
    },
    welcome: {
      title: str(raw.welcome?.title, 200).trim() || d.welcome.title,
      intro: str(raw.welcome?.intro, 1000, d.welcome.intro),
    },
    course_step: {
      title: str(raw.course_step?.title, 120).trim() || d.course_step.title,
      short: str(raw.course_step?.short, 40).trim() || d.course_step.short,
      label: str(raw.course_step?.label, 300).trim() || d.course_step.label,
      helper: str(raw.course_step?.helper, 1000, d.course_step.helper),
    },
    steps,
    documents_step: {
      title: str(raw.documents_step?.title, 120).trim() || d.documents_step.title,
      short: str(raw.documents_step?.short, 40).trim() || d.documents_step.short,
      intro: str(raw.documents_step?.intro, 1000, d.documents_step.intro),
    },
    documents,
    declaration: {
      text: str(raw.declaration?.text, 5000).trim() || d.declaration.text,
      accept_label: str(raw.declaration?.accept_label, 300).trim() || d.declaration.accept_label,
    },
    confirmation: {
      title: str(raw.confirmation?.title, 200).trim() || d.confirmation.title,
      message: str(raw.confirmation?.message, 2000).trim() || d.confirmation.message,
      next_steps: raw.confirmation && 'next_steps' in raw.confirmation
        ? stringList(raw.confirmation.next_steps, 10, 300)
        : d.confirmation.next_steps,
    },
  }
}

/** Whether the form-level window currently allows submissions. */
export function applicationsOpen(config: FormConfig, now = new Date()): boolean {
  const s = config.settings
  if (!s.applications_open) return false
  if (s.opens_at && new Date(s.opens_at) > now) return false
  if (s.closes_at && new Date(s.closes_at) <= now) return false
  return true
}

// ── Validation ──────────────────────────────────────────────────

export function enabledSteps(config: FormConfig) {
  return config.steps.filter((s) => s.enabled)
}

export function isFieldVisible(field: FieldConfig, answers: Answers): boolean {
  if (!field.enabled) return false
  const cond = CORE_FIELDS[field.key]?.showIf
  return !cond || answers[cond.key] === cond.equals
}

export function fieldMaxLength(field: FieldConfig): number {
  return CORE_FIELDS[field.key]?.maxLength ?? (field.type === 'textarea' ? 5000 : 300)
}

function isEmpty(v: unknown) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateField(field: FieldConfig, value: unknown, now = new Date()): string | undefined {
  if (isEmpty(value)) {
    if (!field.required) return undefined
    if (field.type === 'yesno') return 'Please answer Yes or No'
    if (field.type === 'select' || field.type === 'radio') return 'Please choose an option'
    return 'This field is required'
  }

  if (field.type === 'yesno') {
    return typeof value === 'boolean' ? undefined : 'Please answer Yes or No'
  }
  if (typeof value !== 'string') return 'Please enter a valid answer'

  const v = value.trim()
  if (v.length > fieldMaxLength(field)) return `Please keep this under ${fieldMaxLength(field)} characters`

  if ((field.type === 'select' || field.type === 'radio') && !field.options.includes(v)) {
    return 'Please choose one of the options'
  }
  if (field.type === 'tel') {
    const digits = v.replace(/\D/g, '')
    if (digits.length < 9 || digits.length > 15) return 'Please enter a valid phone number'
  }
  if (field.type === 'email' && !EMAIL_RE.test(v)) return 'Please enter a valid email address'
  if (field.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v).getTime())) return 'Please enter a valid date'
  }

  switch (CORE_FIELDS[field.key]?.format) {
    case 'past_date':
      if (new Date(v) >= now) return 'Please enter a date in the past'
      if (new Date(v).getFullYear() < 1900) return 'Please enter a valid date'
      break
    case 'id_number':
      if (!/^[A-Za-z0-9 ]{5,20}$/.test(v)) return 'Please enter a valid ID or passport number'
      break
    case 'year': {
      const y = Number(v)
      if (!/^\d{4}$/.test(v) || y < 1940 || y > now.getFullYear() + 1) return 'Please enter a valid year, e.g. 2005'
      break
    }
    case 'postal_code':
      if (!/^[A-Za-z0-9 -]{3,10}$/.test(v)) return 'Please enter a valid postal code'
      break
  }
  return undefined
}

export type Errors = Record<string, string | undefined>

export function validateStep(step: StepConfig, answers: Answers, now = new Date()): Errors {
  const errors: Errors = {}
  for (const field of step.fields) {
    if (!isFieldVisible(field, answers)) continue
    const err = validateField(field, answers[field.key], now)
    if (err) errors[field.key] = err
  }
  return errors
}

export interface DeclarationAnswers {
  declaration: boolean | null
  signature: string
  signature_date: string
}

export function validateDeclaration(d: DeclarationAnswers): Errors {
  const e: Errors = {}
  if (d.declaration !== true) e.declaration = 'Please accept the declaration'
  if (!d.signature?.trim()) e.signature = 'Please type your full name to sign'
  else if (d.signature.length > 200) e.signature = 'Please keep your signature under 200 characters'
  if (!d.signature_date?.trim()) e.signature_date = "Please enter today's date"
  return e
}

export function validateDocuments(config: FormConfig, docs: { type: string }[]): Errors {
  const e: Errors = {}
  for (const req of config.documents) {
    if (req.enabled && req.required && !docs.some((d) => d.type === req.type)) {
      e[`doc_${req.type}`] = `Please upload: ${req.label}`
    }
  }
  return e
}

/** Validate every enabled step plus the declaration and documents. */
export function validateAll(
  config: FormConfig,
  answers: Answers,
  declaration: DeclarationAnswers,
  docs: { type: string }[],
  now = new Date(),
): Errors {
  const errors: Errors = {}
  for (const step of enabledSteps(config)) Object.assign(errors, validateStep(step, answers, now))
  Object.assign(errors, validateDeclaration(declaration), validateDocuments(config, docs))
  return errors
}

// ── Mapping answers to the database ─────────────────────────────

/** Convert answers into the `applications` JSONB columns. Hidden/disabled fields are dropped. */
export function answersToColumns(config: FormConfig, answers: Answers) {
  const cols: Record<Column | 'custom_answers', Record<string, string | boolean | null>> = {
    personal_info: {},
    contact_details: {},
    next_of_kin: {},
    education: {},
    personal_statement: {},
    custom_answers: {},
  }
  for (const step of enabledSteps(config)) {
    for (const field of step.fields) {
      if (!isFieldVisible(field, answers)) continue
      const raw = answers[field.key]
      const value = typeof raw === 'string' ? raw.trim() : raw ?? null
      const core = CORE_FIELDS[field.key]
      if (core) cols[core.column][core.dbKey ?? field.key] = value
      else cols.custom_answers[field.key] = value
    }
  }
  return cols
}

/** Labels for every field ever configured, for displaying stored answers. */
export function fieldLabels(config: FormConfig): Record<string, string> {
  const out: Record<string, string> = {}
  for (const step of config.steps) for (const field of step.fields) out[field.key] = field.label
  return out
}

export function makeCustomKey(label: string, existing: string[]): string {
  const base = 'custom_' + (label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'question')
  let key = base
  let i = 2
  while (existing.includes(key)) key = `${base}_${i++}`
  return key
}
