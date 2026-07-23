export type KtiForm = {
  // Step 1: Programme
  programme: string
  // Step 2: Personal
  first_name: string
  last_name: string
  date_of_birth: string
  id_number: string
  gender: string
  marital_status: string
  nationality: string
  // Step 3: Contact
  phone: string
  whatsapp: string
  physical_address: string
  physical_city: string
  physical_province: string
  postal_code: string
  postal_same: boolean | null
  postal_address: string
  // Step 4: Next of kin
  kin_full_name: string
  kin_relationship: string
  kin_phone: string
  kin_email: string
  // Step 5: Education
  highest_qualification: string
  institution: string
  year_completed: string
  subjects: string
  additional_qualifications: string
  // Step 6: Church
  church_name: string
  denomination: string
  church_city: string
  church_role: string
  years_of_service: string
  pastor_name: string
  serves_ministry: boolean | null
  ministry_detail: string
  // Step 7: Personal statement
  motivation: string
  calling: string
  goals: string
  // Step 8: Declaration
  declaration: boolean | null
  signature: string
  signature_date: string
}

export const emptyForm: KtiForm = {
  programme: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  id_number: '',
  gender: '',
  marital_status: '',
  nationality: 'South African',
  phone: '',
  whatsapp: '',
  physical_address: '',
  physical_city: '',
  physical_province: '',
  postal_code: '',
  postal_same: null,
  postal_address: '',
  kin_full_name: '',
  kin_relationship: '',
  kin_phone: '',
  kin_email: '',
  highest_qualification: '',
  institution: '',
  year_completed: '',
  subjects: '',
  additional_qualifications: '',
  church_name: '',
  denomination: '',
  church_city: '',
  church_role: '',
  years_of_service: '',
  pastor_name: '',
  serves_ministry: null,
  ministry_detail: '',
  motivation: '',
  calling: '',
  goals: '',
  declaration: null,
  signature: '',
  signature_date: '',
}

export type Errors = Partial<Record<keyof KtiForm, string>>

export const STEP_KEYS = [
  'programme',
  'personal',
  'contact',
  'kin',
  'education',
  'church',
  'statement',
  'documents',
] as const

export type StepKey = (typeof STEP_KEYS)[number]

export const STEP_META: Record<StepKey, { title: string; short: string }> = {
  programme:  { title: 'Choose a programme',        short: 'Programme' },
  personal:   { title: 'Personal information',      short: 'Personal' },
  contact:    { title: 'Contact details',           short: 'Contact' },
  kin:        { title: 'Next of kin',               short: 'Next of kin' },
  education:  { title: 'Education background',      short: 'Education' },
  church:     { title: 'Church & ministry',         short: 'Church' },
  statement:  { title: 'Personal statement',        short: 'Statement' },
  documents:  { title: 'Documents & declaration',   short: 'Documents' },
}

export function validateStep(step: StepKey, f: KtiForm): Errors {
  const e: Errors = {}
  const req = (k: keyof KtiForm, msg = 'This field is required') => {
    const v = f[k]
    if (v === null || v === undefined || String(v).trim() === '') e[k] = msg
  }

  if (step === 'programme') {
    if (!f.programme) e.programme = 'Please select a programme'
  }

  if (step === 'personal') {
    req('first_name', 'Please enter your first name')
    req('last_name', 'Please enter your last name')
    req('date_of_birth', 'Please enter your date of birth')
    req('id_number', 'Please enter your ID or passport number')
    if (!f.gender) e.gender = 'Please select your gender'
    if (!f.marital_status) e.marital_status = 'Please select your marital status'
    req('nationality', 'Please enter your nationality')
  }

  if (step === 'contact') {
    req('phone', 'Please enter your phone number')
    if (f.phone.replace(/\D/g, '').length < 9) e.phone = 'Please enter a valid phone number'
    req('physical_address', 'Please enter your address')
    req('physical_city', 'Please enter your city or town')
    req('physical_province', 'Please select your province')
    if (f.postal_same === null) e.postal_same = 'Please answer Yes or No'
    if (f.postal_same === false) req('postal_address', 'Please enter your postal address')
  }

  if (step === 'kin') {
    req('kin_full_name', 'Please enter the name of your emergency contact')
    req('kin_relationship', 'Please describe how they are related to you')
    req('kin_phone', 'Please enter their phone number')
    if (f.kin_phone.replace(/\D/g, '').length < 9) e.kin_phone = 'Please enter a valid phone number'
  }

  if (step === 'education') {
    if (!f.highest_qualification) e.highest_qualification = 'Please select your highest qualification'
    req('institution', 'Please enter the name of your school or college')
    req('year_completed', 'Please enter the year you completed your studies')
  }

  if (step === 'church') {
    req('church_name', 'Please enter your church name')
    req('pastor_name', "Please enter your pastor's name")
    if (f.serves_ministry === null) e.serves_ministry = 'Please choose Yes or No'
    if (f.serves_ministry && !f.ministry_detail.trim()) {
      e.ministry_detail = 'Please describe how you serve'
    }
  }

  if (step === 'statement') {
    if (!f.motivation.trim() || f.motivation.split(/\s+/).filter(Boolean).length < 30)
      e.motivation = 'Please write at least 30 words'
    if (!f.calling.trim() || f.calling.split(/\s+/).filter(Boolean).length < 30)
      e.calling = 'Please write at least 30 words'
    if (!f.goals.trim() || f.goals.split(/\s+/).filter(Boolean).length < 30)
      e.goals = 'Please write at least 30 words'
  }

  if (step === 'documents') {
    if (f.declaration !== true) e.declaration = 'Please accept the declaration'
    req('signature', 'Please type your full name to sign')
    req('signature_date', "Please enter today's date")
  }

  return e
}

/** Convert KtiForm into the columns used in the applications table */
export function formToDbPayload(f: KtiForm) {
  return {
    programme: f.programme || null,
    personal_info: {
      first_name: f.first_name,
      last_name: f.last_name,
      date_of_birth: f.date_of_birth,
      id_number: f.id_number,
      gender: f.gender,
      marital_status: f.marital_status,
      nationality: f.nationality,
    },
    contact_details: {
      phone: f.phone,
      whatsapp: f.whatsapp,
      physical_address: f.physical_address,
      physical_city: f.physical_city,
      physical_province: f.physical_province,
      postal_code: f.postal_code,
      postal_same: f.postal_same,
      postal_address: f.postal_address,
    },
    next_of_kin: {
      full_name: f.kin_full_name,
      relationship: f.kin_relationship,
      phone: f.kin_phone,
      email: f.kin_email,
    },
    education: {
      highest_qualification: f.highest_qualification,
      institution: f.institution,
      year_completed: f.year_completed,
      subjects: f.subjects,
      additional_qualifications: f.additional_qualifications,
    },
    church_background: {
      church_name: f.church_name,
      denomination: f.denomination,
      city: f.church_city,
      role: f.church_role,
      years_of_service: f.years_of_service,
      pastor_name: f.pastor_name,
      serves_ministry: f.serves_ministry,
      ministry_detail: f.ministry_detail,
    },
    personal_statement: {
      motivation: f.motivation,
      calling: f.calling,
      goals: f.goals,
    },
    declaration: f.declaration === true,
    signature_data: f.signature,
  }
}
