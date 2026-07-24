export type ApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected'

export type DocumentType = 'id_document' | 'matric_certificate' | 'church_letter' | 'passport_photo' | 'other'

export interface DocRef {
  type: DocumentType
  path: string
  name: string
  size: number
}

export interface PersonalInfo {
  first_name: string
  last_name: string
  date_of_birth: string
  id_number: string
  gender: string
  marital_status: string
  nationality: string
}

export interface ContactDetails {
  phone: string
  whatsapp: string
  physical_address: string
  physical_city: string
  physical_province: string
  postal_code: string
  postal_same: boolean | null
  postal_address: string
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
  serves_ministry: boolean | null
  ministry_detail: string
}

export interface PersonalStatement {
  motivation: string
  calling: string
  goals: string
}

export interface WhatsAppTemplate {
  id: string
  name: string
  trigger_type: string
  body: string
  active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppLog {
  id: string
  application_id: string | null
  applicant_name: string
  whatsapp_number: string
  template_id: string | null
  template_name: string | null
  message_body: string
  trigger_type: string
  sent_by: string
  sent_at: string
}

export interface WhatsAppSettings {
  id: number
  auto_send_on_submission: boolean
  auto_send_on_approval: boolean
  auto_send_on_rejection: boolean
}

export interface Member {
  id: string
  member_number: string | null
  application_id: string | null
  full_name: string
  phone: string | null
  email: string | null
  church: string | null
  programme: string | null
  status: 'active' | 'inactive' | 'suspended'
  joined_date: string
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  student_number: string | null
  programme: string | null
  personal_info: PersonalInfo | null
  contact_details: ContactDetails | null
  next_of_kin: NextOfKin | null
  education: Education | null
  church_background: ChurchBackground | null
  personal_statement: PersonalStatement | null
  documents: DocRef[] | null
  declaration: boolean
  signature_data: string | null
  status: ApplicationStatus
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
  updated_at: string
}
