'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/admin'
import { getPublicCatalog } from '@/lib/catalog'
import {
  answersToColumns, applicationsOpen, validateAll,
  type Answers, type DeclarationAnswers, type Errors,
} from '@/lib/form-config'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_BYTES = 5 * 1024 * 1024
const BUCKET = 'application-documents'

export interface UploadedDoc {
  type: string
  path: string
  name: string
  size: number
}

async function clientKey() {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  // Only a salted hash is stored, never the raw IP.
  return createHash('sha256').update(`kti:${ip}`).digest('hex').slice(0, 32)
}

async function allowed(bucket: string, max: number, windowSeconds: number) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('hit_rate_limit', {
    p_bucket: bucket, p_key: await clientKey(), p_max: max, p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('[apply] rate limit check failed:', error.message)
    return true // fail open: never block a genuine applicant because of a limiter error
  }
  return data === true
}

/** Identify the real file type from its first bytes, not the browser-supplied MIME type. */
function sniff(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: 'image/png', ext: 'png' }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  return null
}

export async function uploadDocument(
  formData: FormData,
): Promise<{ ok: true; doc: UploadedDoc } | { ok: false; error: string }> {
  try {
    const draftId = String(formData.get('draftId') ?? '')
    const docType = String(formData.get('docType') ?? '')
    const file = formData.get('file')

    if (!UUID.test(draftId)) return { ok: false, error: 'Your session has expired. Please refresh the page.' }
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Please choose a file to upload.' }
    if (file.size > MAX_BYTES) return { ok: false, error: 'That file is larger than 5 MB. Please upload a smaller file.' }

    const { form } = await getPublicCatalog()
    if (!form.documents.some((d) => d.enabled && d.type === docType)) {
      return { ok: false, error: 'This document type is not accepted.' }
    }

    if (!(await allowed('upload', 30, 600))) {
      return { ok: false, error: 'Too many uploads. Please wait a few minutes and try again.' }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const kind = sniff(bytes)
    if (!kind) return { ok: false, error: 'Please upload a PDF, JPG or PNG file.' }

    const path = `applications/${draftId}/${docType}-${Date.now()}.${kind.ext}`
    const supabase = createServiceClient()
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime })
    if (error) {
      console.error('[apply] upload failed:', error.message)
      return { ok: false, error: 'Upload failed. Please try again.' }
    }
    const name = file.name.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || `${docType}.${kind.ext}`
    return { ok: true, doc: { type: docType, path, name, size: file.size } }
  } catch (err) {
    console.error('[apply] upload error:', err)
    return { ok: false, error: 'Upload failed. Please try again.' }
  }
}

export async function removeDocument(draftId: string, path: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(draftId) || !path.startsWith(`applications/${draftId}/`) || path.includes('..')) {
    return { ok: false, error: 'Could not remove the file.' }
  }
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) return { ok: false, error: 'Could not remove the file. Please try again.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not remove the file. Please try again.' }
  }
}

export interface SubmitInput {
  draftId: string
  courseId: string
  intakeId: string | null
  studyMode: string | null
  answers: Answers
  declaration: DeclarationAnswers
  documents: UploadedDoc[]
}

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; error: string; fieldErrors?: Errors }

const RPC_ERRORS: Record<string, string> = {
  APPLICATIONS_CLOSED: 'Applications are currently closed.',
  COURSE_NOT_FOUND: 'Please choose a course.',
  COURSE_CLOSED: 'Sorry — the course you chose is no longer accepting applications. Please choose another course.',
  INTAKE_REQUIRED: 'Please choose an intake for this course.',
  INTAKE_CLOSED: 'The intake you chose is no longer open. Please choose another intake.',
  STUDY_MODE_INVALID: 'Please choose how you would like to study.',
  DUPLICATE_APPLICATION: 'We already have an application from you for this course. Please contact us if you need to update it.',
  DOCUMENTS_INVALID: 'One of your documents could not be found. Please remove it and upload it again.',
  PAYLOAD_TOO_LARGE: 'Your application is too long. Please shorten some of your answers.',
}

export async function submitApplication(input: SubmitInput): Promise<SubmitResult> {
  try {
    if (!UUID.test(input.draftId)) {
      return { ok: false, error: 'Your session has expired. Please refresh the page.' }
    }

    const { form, courses } = await getPublicCatalog()
    if (!applicationsOpen(form)) return { ok: false, error: form.settings.closed_message }

    const course = courses.find((c) => c.id === input.courseId && c.open_for_applications)
    if (!course) return { ok: false, error: RPC_ERRORS.COURSE_CLOSED }

    const documents = (Array.isArray(input.documents) ? input.documents : [])
      .filter((d) => form.documents.some((req) => req.enabled && req.type === d.type))
      .map((d) => ({
        type: String(d.type),
        path: String(d.path),
        name: String(d.name ?? '').slice(0, 120),
        size: Number(d.size) || 0,
      }))

    // Authoritative field validation against the published form.
    const fieldErrors = validateAll(form, input.answers ?? {}, input.declaration, documents)
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: 'Some answers need attention before you can submit.', fieldErrors }
    }

    if (!(await allowed('submit', 5, 3600))) {
      return { ok: false, error: 'Too many applications have been sent from this connection. Please try again later.' }
    }

    const cols = answersToColumns(form, input.answers)
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('submit_application', {
      p: {
        draft_id: input.draftId,
        course_id: course.id,
        intake_id: input.intakeId || null,
        study_mode: input.studyMode || null,
        ...cols,
        documents,
        declaration: input.declaration.declaration === true,
        signature_data: input.declaration.signature.trim(),
      },
    })

    if (error) {
      const code = Object.keys(RPC_ERRORS).find((k) => error.message.includes(k))
      if (!code) console.error('[apply] submit failed:', error.message)
      return { ok: false, error: code ? RPC_ERRORS[code] : 'We could not submit your application. Please try again.' }
    }

    const row = Array.isArray(data) ? data[0] : data
    return { ok: true, reference: row?.student_number ?? '' }
  } catch (err) {
    console.error('[apply] submit error:', err)
    return { ok: false, error: 'We could not submit your application. Please try again.' }
  }
}
