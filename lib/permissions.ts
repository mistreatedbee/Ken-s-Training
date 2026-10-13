/**
 * Role-based permissions. The database (RLS + triggers) is the real
 * enforcement layer; these checks gate the UI and server actions so
 * users get clear errors instead of silent no-ops.
 */
export const ROLES = ['super_admin', 'admissions', 'course_admin', 'finance', 'read_only'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  super_admin:  { label: 'Super administrator',     description: 'Full control: staff, settings, form, courses, pricing, applications and payments.' },
  admissions:   { label: 'Admissions administrator', description: 'Review applications, record decisions, notes and communications; export records.' },
  course_admin: { label: 'Course administrator',    description: 'Manage courses, intakes and pricing.' },
  finance:      { label: 'Finance',                 description: 'Record and void payments and refunds; export records.' },
  read_only:    { label: 'Read-only staff',         description: 'View applications, courses and reports without changing anything.' },
}

export type Permission =
  | 'applications.update'
  | 'applications.export'
  | 'courses.manage'
  | 'payments.manage'
  | 'form.manage'
  | 'staff.manage'
  | 'templates.manage'
  | 'audit.view'

const GRANTS: Record<Permission, Role[]> = {
  'applications.update': ['admissions'],
  'applications.export': ['admissions', 'finance'],
  'courses.manage': ['course_admin'],
  'payments.manage': ['finance'],
  'form.manage': [],
  'staff.manage': [],
  'templates.manage': ['admissions'],
  'audit.view': [],
}

/** super_admin has every permission. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return role === 'super_admin' || GRANTS[permission].includes(role)
}

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}
