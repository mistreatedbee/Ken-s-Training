export type Role = 'student' | 'admin' | 'reviewer'

export type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'

export type DocumentType = 'id_document' | 'matric_certificate' | 'church_letter' | 'passport_photo' | 'other'

export type PaymentVerificationStatus = 'pending' | 'verified' | 'rejected'

export interface Profile {
  id: string
  role: Role
  full_name: string | null
  phone: string | null
  created_at: string
}

export interface Programme {
  id: string
  name: string
  duration_years: number
  description: string | null
  is_active: boolean
  created_at: string
}

export interface PersonalInfo {
  first_name: string
  last_name: string
  date_of_birth: string
  id_number: string
  gender: string
  nationality: string
}

export interface ContactDetails {
  phone: string
  alt_phone: string
  physical_address: string
  physical_city: string
  physical_province: string
  physical_postal_code: string
  postal_same_as_physical: boolean
  postal_address: string
  postal_city: string
  postal_province: string
  postal_postal_code: string
}

export interface NextOfKin {
  full_name: string
  relationship: string
  phone: string
  email: string
}

export interface Education {
  highest_qualification: string
  institution: string
  year_completed: string
  subjects: string
  additional_qualifications: string
}

export interface ChurchBackground {
  church_name: string
  denomination: string
  city: string
  role: string
  years_of_service: string
  pastor_name: string
  additional_info: string
}

export interface PersonalStatement {
  motivation: string
  calling: string
  goals: string
}

export interface Application {
  id: string
  profile_id: string
  programme_id: string | null
  student_number: string
  status: ApplicationStatus
  reviewer_id: string | null
  rejection_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
  personal_info: PersonalInfo
  contact_details: ContactDetails
  next_of_kin: NextOfKin
  education: Education
  programme_selection: { programme_id: string }
  church_background: ChurchBackground
  personal_statement: PersonalStatement
  declaration: boolean
  current_step: number
  created_at: string
  updated_at: string
  // Joined
  profiles?: Profile
  programmes?: Programme
}

export interface ApplicationDocument {
  id: string
  application_id: string
  document_type: DocumentType
  storage_path: string
  file_name: string
  file_size: number | null
  uploaded_at: string
}

export interface Payment {
  id: string
  application_id: string
  amount_paid: number | null
  payment_date: string | null
  reference_number: string | null
  proof_storage_path: string | null
  proof_file_name: string | null
  verification_status: PaymentVerificationStatus
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
}

export interface Notification {
  id: string
  profile_id: string
  title: string
  message: string
  is_read: boolean
  link: string | null
  created_at: string
}

export interface AuditEntry {
  id: string
  application_id: string | null
  performed_by: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
  profiles?: Pick<Profile, 'full_name'>
}
