import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FORM_CONFIG, answersToColumns, applicationsOpen, makeCustomKey, normalizeConfig,
  validateAll, validateField, validateStep, type Answers, type FieldConfig, type FormConfig,
} from '@/lib/form-config'
import { csvCell, toCsv } from '@/lib/format'
import { can, ROLES } from '@/lib/permissions'

const NOW = new Date('2026-10-13T10:00:00Z')

const validAnswers: Answers = {
  first_name: 'Grace', last_name: 'Mokoena', date_of_birth: '1980-01-01', id_number: '8001015009087',
  gender: 'Female', marital_status: 'Married', nationality: 'South African',
  phone: '082 445 1290', whatsapp: '', email: '', physical_address: '14 Church St', physical_city: 'Polokwane',
  physical_province: 'Limpopo', postal_code: '0699', postal_same: true, postal_address: '',
  kin_full_name: 'Mary', kin_relationship: 'Mother', kin_phone: '0824451290', kin_email: '',
  highest_qualification: 'Diploma', institution: 'Polokwane High', year_completed: '2005',
  subjects: '', additional_qualifications: '',
  motivation: 'Because', calling: 'Calling', goals: 'Goals',
}
const declaration = { declaration: true, signature: 'Grace Mokoena', signature_date: '2026-10-13' }
const allDocs = [{ type: 'id_document' }, { type: 'matric_certificate' }, { type: 'passport_photo' }]

function field(over: Partial<FieldConfig>): FieldConfig {
  return { key: 'custom_x', type: 'text', label: 'X', helper: '', placeholder: '', required: false, enabled: true, options: [], ...over }
}

describe('normalizeConfig', () => {
  it('round-trips the default config unchanged', () => {
    expect(normalizeConfig(DEFAULT_FORM_CONFIG)).toEqual(DEFAULT_FORM_CONFIG)
  })

  it('fills a missing or garbage config with defaults', () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_FORM_CONFIG)
    expect(normalizeConfig({ steps: 'nope', documents: 7 }).steps).toEqual(DEFAULT_FORM_CONFIG.steps)
  })

  it('keeps locked fields enabled and required, and personal/contact steps enabled', () => {
    const tampered = structuredClone(DEFAULT_FORM_CONFIG) as FormConfig
    tampered.steps[0].enabled = false
    tampered.steps[0].fields.find((f) => f.key === 'first_name')!.enabled = false
    tampered.steps[1].fields.find((f) => f.key === 'phone')!.required = false
    const n = normalizeConfig(tampered)
    expect(n.steps[0].enabled).toBe(true)
    expect(n.steps[0].fields.find((f) => f.key === 'first_name')).toMatchObject({ enabled: true, required: true })
    expect(n.steps[1].fields.find((f) => f.key === 'phone')!.required).toBe(true)
  })

  it('cannot change the type of a core field or move it to another step', () => {
    const tampered = structuredClone(DEFAULT_FORM_CONFIG) as any
    tampered.steps[0].fields.find((f: FieldConfig) => f.key === 'date_of_birth').type = 'textarea'
    tampered.steps[2].fields.push({ key: 'id_number', label: 'moved' })
    const n = normalizeConfig(tampered)
    expect(n.steps[0].fields.find((f) => f.key === 'date_of_birth')!.type).toBe('date')
    expect(n.steps[2].fields.some((f) => f.key === 'id_number')).toBe(false)
    expect(n.steps[0].fields.filter((f) => f.key === 'id_number')).toHaveLength(1)
  })

  it('keeps admin reordering and accepts valid custom fields; drops invalid keys', () => {
    const c = structuredClone(DEFAULT_FORM_CONFIG) as any
    c.steps[4].fields.reverse()
    c.steps[4].fields.push(
      { key: 'custom_church', type: 'text', label: 'Home church', required: true },
      { key: 'evil key', type: 'text', label: 'x' },
      { key: 'custom_shoe', type: 'script', label: 'Shoe size' },
    )
    const n = normalizeConfig(c)
    expect(n.steps[4].fields.map((f) => f.key)).toEqual(['goals', 'calling', 'motivation', 'custom_church', 'custom_shoe'])
    expect(n.steps[4].fields.find((f) => f.key === 'custom_shoe')!.type).toBe('text')
  })

  it('drops an invalid close date that is before the open date', () => {
    const n = normalizeConfig({ settings: { opens_at: '2026-12-01', closes_at: '2026-11-01' } })
    expect(n.settings.opens_at).toBe('2026-12-01T00:00:00.000Z')
    expect(n.settings.closes_at).toBeNull()
  })
})

describe('applicationsOpen', () => {
  it('respects the toggle and the window', () => {
    const c = normalizeConfig({})
    expect(applicationsOpen(c, NOW)).toBe(true)
    expect(applicationsOpen(normalizeConfig({ settings: { applications_open: false } }), NOW)).toBe(false)
    expect(applicationsOpen(normalizeConfig({ settings: { opens_at: '2026-11-01' } }), NOW)).toBe(false)
    expect(applicationsOpen(normalizeConfig({ settings: { closes_at: '2026-10-01' } }), NOW)).toBe(false)
  })
})

describe('validation', () => {
  it('accepts a complete application', () => {
    expect(validateAll(DEFAULT_FORM_CONFIG, validAnswers, declaration, allDocs, NOW)).toEqual({})
  })

  it('reports required fields, documents and the declaration', () => {
    const errors = validateAll(DEFAULT_FORM_CONFIG, { ...validAnswers, first_name: ' ' },
      { declaration: false, signature: '', signature_date: '' }, [{ type: 'id_document' }], NOW)
    expect(Object.keys(errors).sort()).toEqual(
      ['declaration', 'doc_matric_certificate', 'doc_passport_photo', 'first_name', 'signature', 'signature_date'],
    )
  })

  it('validates formats', () => {
    const v = (key: string, value: string) => validateField(
      DEFAULT_FORM_CONFIG.steps.flatMap((s) => s.fields).find((f) => f.key === key)!, value, NOW,
    )
    expect(v('phone', '123')).toMatch(/valid phone/)
    expect(v('email', 'not-an-email')).toMatch(/valid email/)
    expect(v('date_of_birth', '2030-01-01')).toMatch(/in the past/)
    expect(v('year_completed', '205')).toMatch(/valid year/)
    expect(v('gender', 'Robot')).toMatch(/one of the options/)
    expect(v('id_number', '<script>')).toMatch(/valid ID/)
    expect(v('email', '')).toBeUndefined() // optional
  })

  it('only requires the postal address when it differs', () => {
    const contact = DEFAULT_FORM_CONFIG.steps[1]
    expect(validateStep(contact, { ...validAnswers, postal_same: true }, NOW).postal_address).toBeUndefined()
    expect(validateStep(contact, { ...validAnswers, postal_same: false }, NOW).postal_address).toBeDefined()
  })

  it('ignores disabled fields and disabled steps', () => {
    const c = normalizeConfig(DEFAULT_FORM_CONFIG)
    c.steps[4].enabled = false
    c.steps[0].fields.find((f) => f.key === 'nationality')!.enabled = false
    const answers = { ...validAnswers, motivation: '', calling: '', goals: '', nationality: '' }
    expect(validateAll(c, answers, declaration, allDocs, NOW)).toEqual({})
  })

  it('enforces the maximum length', () => {
    expect(validateField(field({ type: 'text' }), 'x'.repeat(301))).toMatch(/under 300/)
  })

  it('rejects non-boolean yes/no answers', () => {
    expect(validateField(field({ type: 'yesno', required: true }), 'yes')).toMatch(/Yes or No/)
  })
})

describe('answersToColumns', () => {
  it('maps core answers into their columns and custom answers separately', () => {
    const c = normalizeConfig(DEFAULT_FORM_CONFIG)
    c.steps[4].fields.push(field({ key: 'custom_church', label: 'Church' }))
    const cols = answersToColumns(c, { ...validAnswers, custom_church: ' Grace Chapel ', injected: 'nope' })
    expect(cols.personal_info.first_name).toBe('Grace')
    expect(cols.next_of_kin).toMatchObject({ full_name: 'Mary', relationship: 'Mother', phone: '0824451290' })
    expect(cols.contact_details.postal_same).toBe(true)
    expect(cols.custom_answers).toEqual({ custom_church: 'Grace Chapel' })
    expect(JSON.stringify(cols)).not.toContain('injected')
    expect('postal_address' in cols.contact_details).toBe(false) // hidden when postal_same
  })
})

describe('makeCustomKey', () => {
  it('produces unique, safe keys', () => {
    expect(makeCustomKey('Home Church?', [])).toBe('custom_home_church')
    expect(makeCustomKey('Home Church?', ['custom_home_church'])).toBe('custom_home_church_2')
    expect(makeCustomKey('???', [])).toBe('custom_question')
  })
})

describe('CSV export', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(toCsv([['a', null], ['x\ny', 3]])).toBe('a,\r\n"x\ny",3')
  })

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("evil")')).toBe(`"'=HYPERLINK(""evil"")"`)
    expect(csvCell('+27 82')).toBe("'+27 82")
  })
})

describe('permissions', () => {
  it('super admins can do everything; read-only can do nothing', () => {
    for (const p of ['applications.update', 'courses.manage', 'payments.manage', 'form.manage', 'staff.manage'] as const) {
      expect(can('super_admin', p)).toBe(true)
      expect(can('read_only', p)).toBe(false)
    }
  })

  it('separates admissions, course and finance duties', () => {
    expect(can('admissions', 'applications.update')).toBe(true)
    expect(can('admissions', 'courses.manage')).toBe(false)
    expect(can('admissions', 'payments.manage')).toBe(false)
    expect(can('course_admin', 'courses.manage')).toBe(true)
    expect(can('course_admin', 'applications.update')).toBe(false)
    expect(can('course_admin', 'applications.export')).toBe(false)
    expect(can('finance', 'payments.manage')).toBe(true)
    expect(can('finance', 'applications.update')).toBe(false)
    expect(can(null, 'applications.export')).toBe(false)
    expect(ROLES).toHaveLength(5)
  })
})
