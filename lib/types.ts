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
