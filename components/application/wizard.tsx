'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2,
  Clock, Copy, FileText, Home, Loader2, RotateCcw,
  Save, Send, ShieldCheck, Sparkles, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Programme, ApplicationDocument } from '@/lib/types'
import {
  emptyForm, STEP_KEYS, STEP_META, validateStep, formToDbPayload, dbRowToForm,
  type KtiForm, type Errors, type StepKey,
} from './form-model'
import {
  ProgrammeCards, RadioCards, SelectField, TextArea, TextField, YesNo,
} from './form-fields'

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
]

const QUALIFICATIONS = [
  'Grade 10', 'Grade 11', 'Grade 12 / Matric', 'Certificate', 'Diploma', 'Degree', 'Postgraduate', 'Other',
]

type Phase = 'welcome' | 'form' | 'submitted'
type SaveState = 'idle' | 'saving' | 'saved'

interface Props {
  userId: string
  initialApplication: Record<string, unknown> | null
  programmes: Programme[]
  userFullName: string
}

export function ApplicationWizard({ userId, initialApplication, programmes, userFullName }: Props) {
  const [phase, setPhase] = useState<Phase>('welcome')
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState<KtiForm>(() =>
    initialApplication ? dbRowToForm(initialApplication) : emptyForm,
  )
  const [errors, setErrors] = useState<Errors>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [applicationId, setApplicationId] = useState<string | null>(
    (initialApplication?.id as string) ?? null,
  )
  const [studentNumber, setStudentNumber] = useState<string>(
    (initialApplication?.student_number as string) ?? '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<ApplicationDocument[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasDraft = !!initialApplication

  // Load existing documents
  useEffect(() => {
    if (!applicationId) return
    const supabase = createClient()
    supabase.from('application_documents').select('*').eq('application_id', applicationId)
      .then(({ data }) => { if (data) setDocuments(data) })
  }, [applicationId])

  const set = useCallback(<K extends keyof KtiForm>(key: K, value: KtiForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }, [])

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Debounced autosave to Supabase
  useEffect(() => {
    if (phase !== 'form') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient()
      const payload = {
        ...formToDbPayload(form),
        profile_id: userId,
        current_step: stepIndex + 1,
      }
      if (applicationId) {
        await supabase.from('applications').update(payload).eq('id', applicationId)
      } else {
        const { data } = await supabase.from('applications').insert([payload]).select('id,student_number').single()
        if (data) { setApplicationId(data.id); setStudentNumber(data.student_number) }
      }
      setSaveState('saved')
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const stepKey = STEP_KEYS[stepIndex]

  const goNext = () => {
    const errs = stepKey !== 'documents' ? validateStep(stepKey, form) : {}
    if (Object.keys(errs).length > 0) { setErrors(errs); scrollTop(); return }
    setStepIndex((i) => Math.min(i + 1, STEP_KEYS.length - 1))
    setErrors({})
    scrollTop()
  }

  const goBack = () => { setStepIndex((i) => Math.max(i - 1, 0)); setErrors({}); scrollTop() }
  const jumpTo = (k: StepKey) => { setStepIndex(STEP_KEYS.indexOf(k)); scrollTop() }

  const startFresh = () => {
    setForm(emptyForm)
    setStepIndex(0)
    setPhase('form')
  }

  const submit = async () => {
    const errs = validateStep('documents', form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    setSubmitError(null)
    const supabase = createClient()
    const payload = {
      ...formToDbPayload(form),
      profile_id: userId,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      current_step: 8,
    }
    if (applicationId) {
      const { error } = await supabase.from('applications').update(payload).eq('id', applicationId)
      if (error) { setSubmitError(error.message); setSubmitting(false); return }
    } else {
      const { data, error } = await supabase.from('applications').insert([payload]).select('id,student_number').single()
      if (error) { setSubmitError(error.message); setSubmitting(false); return }
      if (data) { setApplicationId(data.id); setStudentNumber(data.student_number) }
    }
    setSubmitting(false)
    setPhase('submitted')
    window.scrollTo({ top: 0 })
  }

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType)
    const supabase = createClient()
    const path = `${userId}/${applicationId ?? 'pending'}/${docType}-${Date.now()}-${file.name}`

    if (!applicationId) {
      const payload = { ...formToDbPayload(form), profile_id: userId, current_step: stepIndex + 1 }
      const { data } = await supabase.from('applications').insert([payload]).select('id,student_number').single()
      if (data) { setApplicationId(data.id); setStudentNumber(data.student_number) }
    }

    const { error: uploadErr } = await supabase.storage.from('application-documents').upload(path, file)
    if (uploadErr) { setErrors({ ...errors }); setUploading(null); return }

    const id = applicationId ?? ''
    await supabase.from('application_documents').insert([{
      application_id: id,
      document_type: docType,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
    }])
    setDocuments((prev) => [
      ...prev.filter((d) => d.document_type !== docType),
      { id: Date.now().toString(), application_id: id, document_type: docType as ApplicationDocument['document_type'], storage_path: path, file_name: file.name, file_size: file.size, uploaded_at: new Date().toISOString() },
    ])
    setUploading(null)
  }

  const handleRemoveDoc = async (doc: ApplicationDocument) => {
    const supabase = createClient()
    await supabase.storage.from('application-documents').remove([doc.storage_path])
    await supabase.from('application_documents').delete().eq('id', doc.id)
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
  }

  if (phase === 'welcome') {
    return (
      <WelcomeScreen
        hasDraft={hasDraft}
        userFullName={userFullName}
        onStart={startFresh}
        onResume={() => setPhase('form')}
        onFresh={startFresh}
      />
    )
  }

  if (phase === 'submitted') {
    return (
      <SubmittedScreen
        studentNumber={studentNumber}
        copied={copied}
        onCopy={() => {
          navigator.clipboard?.writeText(studentNumber)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
      />
    )
  }

  return (
    <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-6">
      <ProgressIndicator stepIndex={stepIndex} onJump={jumpTo} />

      <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-accent-foreground">
              Step {stepIndex + 1} of {STEP_KEYS.length}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-foreground sm:text-3xl">
              {STEP_META[stepKey].title}
            </h1>
          </div>
          <SaveBadge state={saveState} />
        </div>

        {stepKey === 'programme' && (
          <ProgrammeCards
            label="Which programme would you like to study?"
            helper="Read through the options and choose the one that feels right. You can always ask us for help."
            value={form.programme_id}
            onChange={(v) => set('programme_id', v)}
            programmes={programmes}
            error={errors.programme_id}
            required
          />
        )}
        {stepKey === 'personal' && <PersonalStep form={form} set={set} errors={errors} />}
        {stepKey === 'contact' && <ContactStep form={form} set={set} errors={errors} />}
        {stepKey === 'kin' && <KinStep form={form} set={set} errors={errors} />}
        {stepKey === 'education' && <EducationStep form={form} set={set} errors={errors} />}
        {stepKey === 'church' && <ChurchStep form={form} set={set} errors={errors} />}
        {stepKey === 'statement' && <StatementStep form={form} set={set} errors={errors} />}
        {stepKey === 'documents' && (
          <DocumentsStep
            form={form}
            set={set}
            errors={errors}
            documents={documents}
            uploading={uploading}
            onUpload={handleUpload}
            onRemove={handleRemoveDoc}
            applicationId={applicationId}
          />
        )}

        {stepKey === 'documents' && (
          <>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-success/10 p-4 text-success">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <p className="text-base font-medium">
                Please check that you have uploaded all required documents and accepted the declaration before submitting.
              </p>
            </div>
            {submitError && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive">
                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                <p className="text-base font-medium">{submitError}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {stepIndex > 0 ? (
          <Button variant="outline" onClick={goBack} className="h-14 gap-2 px-6 text-lg sm:w-auto">
            <ArrowLeft className="size-5" /> Back
          </Button>
        ) : (
          <Link href="/">
            <Button variant="ghost" className="h-14 gap-2 px-4 text-lg">
              <Home className="size-5" /> Exit
            </Button>
          </Link>
        )}

        {stepKey === 'documents' ? (
          <Button onClick={submit} disabled={submitting} className="h-14 gap-2 px-8 text-lg font-semibold">
            {submitting
              ? <><Loader2 className="size-5 animate-spin" /> Submitting…</>
              : <><Send className="size-5" /> Submit application</>}
          </Button>
        ) : (
          <Button onClick={goNext} className="h-14 gap-2 px-8 text-lg font-semibold">
            Continue <ArrowRight className="size-5" />
          </Button>
        )}
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 text-center text-base text-muted-foreground">
        <Save className="size-4" />
        Your progress is saved automatically. You can safely close this page and come back later.
      </p>
    </div>
  )
}

// ── Save badge ───────────────────────────────────────────────

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground"
      aria-live="polite"
    >
      {state === 'saving'
        ? <><Loader2 className="size-4 animate-spin" /> Saving</>
        : <><Check className="size-4 text-success" /> Saved</>}
    </span>
  )
}

// ── Progress indicator ────────────────────────────────────────

function ProgressIndicator({ stepIndex, onJump }: { stepIndex: number; onJump: (k: StepKey) => void }) {
  const pct = ((stepIndex + 1) / STEP_KEYS.length) * 100
  return (
    <div>
      <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="flex items-center justify-between gap-1">
        {STEP_KEYS.map((k, i) => {
          const done = i < stepIndex
          const active = i === stepIndex
          return (
            <li key={k} className="flex flex-1 flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => done ? onJump(k) : undefined}
                disabled={!done}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'grid size-9 place-items-center rounded-full border-2 text-sm font-bold transition',
                  active && 'border-primary bg-primary text-primary-foreground',
                  done && 'border-success bg-success text-success-foreground hover:scale-105 cursor-pointer',
                  !active && !done && 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </button>
              <span className={cn(
                'hidden text-center text-xs font-medium sm:block',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {STEP_META[k].short}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ── Welcome screen ───────────────────────────────────────────

function WelcomeScreen({
  hasDraft, userFullName, onStart, onResume, onFresh,
}: { hasDraft: boolean; userFullName: string; onStart: () => void; onResume: () => void; onFresh: () => void }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {userFullName ? `Welcome, ${userFullName.split(' ')[0]}!` : 'Welcome!'}
        <br />Let&apos;s begin your application
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
        We will ask a few simple questions about you and your faith. Take your time — there is no rush.
      </p>

      <div className="mx-auto mt-8 flex max-w-md flex-col gap-3">
        <InfoRow icon={<Clock className="size-5" />} text="Takes about 15–20 minutes to complete" />
        <InfoRow icon={<Save className="size-5" />} text="Your answers save automatically as you go" />
        <InfoRow icon={<ShieldCheck className="size-5" />} text="Your information is private and kept safe" />
      </div>

      {hasDraft ? (
        <div className="mx-auto mt-8 flex max-w-md flex-col gap-3">
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-base font-medium text-foreground">
            We found an application you started earlier. Would you like to continue?
          </div>
          <Button onClick={onResume} className="h-16 gap-2 text-xl font-semibold">
            <RotateCcw className="size-6" /> Resume my application
          </Button>
          <Button variant="ghost" onClick={onFresh} className="h-12 text-base">
            Start a fresh application instead
          </Button>
        </div>
      ) : (
        <Button onClick={onStart} className="mx-auto mt-8 h-16 gap-2 px-10 text-xl font-semibold">
          <Sparkles className="size-6" /> Start application
        </Button>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        By continuing you agree to our privacy notice. We only use your information to process your application.
      </p>
    </div>
  )
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-left">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-base font-medium text-foreground">{text}</span>
    </div>
  )
}

// ── Submitted screen ─────────────────────────────────────────

function SubmittedScreen({ studentNumber, copied, onCopy }: { studentNumber: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-success/15">
        <CheckCircle2 className="size-12 text-success" />
      </div>
      <h1 className="mt-6 font-serif text-3xl font-bold text-foreground sm:text-4xl">
        Your application is in!
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
        Thank you for applying to Ken&apos;s Training Institute. We have received your application and will be in touch soon.
      </p>

      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-6">
        <p className="text-base font-medium text-muted-foreground">Your student / reference number</p>
        <p className="mt-2 font-serif text-2xl font-bold tracking-wide text-primary sm:text-3xl">
          {studentNumber}
        </p>
        <Button variant="outline" onClick={onCopy} className="mt-4 h-12 gap-2 px-5 text-base">
          {copied ? <><Check className="size-5 text-success" /> Copied</> : <><Copy className="size-5" /> Copy number</>}
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Please keep this number safe. You may need it to track your application.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-md rounded-2xl bg-secondary p-6 text-left">
        <h2 className="font-serif text-lg font-bold text-foreground">What happens next?</h2>
        <ol className="mt-3 space-y-3">
          {[
            'Our team reviews your application within 5 working days.',
            'We may contact your church leader to confirm your details.',
            'You will receive a message or email with the outcome and next steps.',
          ].map((t, i) => (
            <li key={i} className="flex gap-3 text-base text-foreground">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ol>
      </div>

      <Link href="/dashboard" className="mt-8 inline-block">
        <Button variant="outline" className="h-14 gap-2 px-8 text-lg">
          <Home className="size-5" /> View my application
        </Button>
      </Link>
    </div>
  )
}

// ── Step components ──────────────────────────────────────────

type StepProps = {
  form: KtiForm
  set: <K extends keyof KtiForm>(key: K, value: KtiForm[K]) => void
  errors: Errors
}

function PersonalStep({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <TextField id="first_name" label="First name" helper="Enter your name exactly as it appears on your ID." example="Grace" autoComplete="given-name" value={form.first_name} onChange={(v) => set('first_name', v)} error={errors.first_name} required />
      <TextField id="last_name" label="Last name / Surname" example="Mokoena" autoComplete="family-name" value={form.last_name} onChange={(v) => set('last_name', v)} error={errors.last_name} required />
      <TextField id="date_of_birth" label="Date of birth" type="date" autoComplete="bday" value={form.date_of_birth} onChange={(v) => set('date_of_birth', v)} error={errors.date_of_birth} required />
      <TextField id="id_number" label="South African ID number" helper="Your 13-digit ID number. If you have a passport, enter your passport number." example="8001015009087" inputMode="numeric" maxLength={13} value={form.id_number} onChange={(v) => set('id_number', v)} error={errors.id_number} required />
      <RadioCards label="Gender" value={form.gender} onChange={(v) => set('gender', v)} options={['Male', 'Female', 'Other']} error={errors.gender} required />
      <SelectField id="marital_status" label="Marital status" value={form.marital_status} onChange={(v) => set('marital_status', v)} options={['Single', 'Married', 'Widowed', 'Divorced', 'Separated']} error={errors.marital_status} required />
      <TextField id="nationality" label="Nationality" example="South African" autoComplete="country-name" value={form.nationality} onChange={(v) => set('nationality', v)} error={errors.nationality} required />
    </div>
  )
}

function ContactStep({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <TextField id="phone" label="Phone number" helper="Your main contact number." example="082 445 1290" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone} required />
      <TextField id="whatsapp" label="WhatsApp number" helper="If different from your phone number — we may contact you via WhatsApp." example="082 445 1290" type="tel" inputMode="tel" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} error={errors.whatsapp} />
      <TextArea id="physical_address" label="Physical address" helper="Where do you live? Include your street, area, and town." example="14 Church Street, Polokwane, Limpopo" rows={3} value={form.physical_address} onChange={(v) => set('physical_address', v)} error={errors.physical_address} required />
      <TextField id="physical_city" label="City / Town" example="Polokwane" value={form.physical_city} onChange={(v) => set('physical_city', v)} error={errors.physical_city} required />
      <SelectField id="physical_province" label="Province" value={form.physical_province} onChange={(v) => set('physical_province', v)} options={PROVINCES} placeholder="Select your province" error={errors.physical_province} required />
      <TextField id="postal_code" label="Postal code" example="0699" inputMode="numeric" maxLength={4} value={form.postal_code} onChange={(v) => set('postal_code', v)} error={errors.postal_code} />
      <YesNo label="Is your postal address the same as your physical address?" value={form.postal_same} onChange={(v) => set('postal_same', v)} error={errors.postal_same} required />
      {form.postal_same === false && (
        <TextArea id="postal_address" label="Postal address" helper="Enter your PO Box or postal address." example="PO Box 123, Polokwane, 0699" rows={3} value={form.postal_address} onChange={(v) => set('postal_address', v)} error={errors.postal_address} required />
      )}
    </div>
  )
}

function KinStep({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <p className="text-lg text-muted-foreground">Who should we contact in an emergency?</p>
      <TextField id="kin_full_name" label="Full name" example="Mary Mokoena" autoComplete="off" value={form.kin_full_name} onChange={(v) => set('kin_full_name', v)} error={errors.kin_full_name} required />
      <TextField id="kin_relationship" label="Relationship to you" example="Mother, Spouse, Sibling" value={form.kin_relationship} onChange={(v) => set('kin_relationship', v)} error={errors.kin_relationship} required />
      <TextField id="kin_phone" label="Their phone number" type="tel" inputMode="tel" example="082 445 1290" value={form.kin_phone} onChange={(v) => set('kin_phone', v)} error={errors.kin_phone} required />
      <TextField id="kin_email" label="Their email address" helper="Optional." type="email" inputMode="email" example="mary@example.com" value={form.kin_email} onChange={(v) => set('kin_email', v)} error={errors.kin_email} />
    </div>
  )
}

function EducationStep({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <SelectField id="highest_qualification" label="Highest qualification" helper="What is the highest level of education you have completed?" value={form.highest_qualification} onChange={(v) => set('highest_qualification', v)} options={QUALIFICATIONS} error={errors.highest_qualification} required />
      <TextField id="institution" label="School or institution" helper="Where did you study or complete this qualification?" example="Polokwane High School" value={form.institution} onChange={(v) => set('institution', v)} error={errors.institution} required />
      <TextField id="year_completed" label="Year completed" example="2005" inputMode="numeric" max={new Date().getFullYear()} min={1950} value={form.year_completed} onChange={(v) => set('year_completed', v)} error={errors.year_completed} required />
      <TextArea id="subjects" label="Subjects or areas of study" helper="List the main subjects you studied. A year or season is fine." example="English, Maths, History, Religious Studies" rows={3} value={form.subjects} onChange={(v) => set('subjects', v)} error={errors.subjects} />
      <TextArea id="additional_qualifications" label="Any other qualifications or training?" helper="Include any certificates, short courses, or Bible school training." rows={3} value={form.additional_qualifications} onChange={(v) => set('additional_qualifications', v)} error={errors.additional_qualifications} />
    </div>
  )
}

function ChurchStep({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <TextField id="church_name" label="Church name" example="Grace Community Church" value={form.church_name} onChange={(v) => set('church_name', v)} error={errors.church_name} required />
      <TextField id="denomination" label="Denomination" helper="Optional — what type of church is it?" example="Pentecostal, Baptist, Methodist" value={form.denomination} onChange={(v) => set('denomination', v)} error={errors.denomination} />
      <TextField id="church_city" label="City or town where your church is" example="Polokwane" value={form.church_city} onChange={(v) => set('church_city', v)} error={errors.church_city} />
      <TextField id="pastor_name" label="Your pastor or church leader's name" example="Pastor Samuel Nkosi" value={form.pastor_name} onChange={(v) => set('pastor_name', v)} error={errors.pastor_name} required />
      <TextField id="church_role" label="Your role or position in the church" helper="Optional — e.g. Elder, Youth leader, Member." example="Youth leader" value={form.church_role} onChange={(v) => set('church_role', v)} error={errors.church_role} />
      <TextField id="years_of_service" label="How many years have you been at this church?" example="5" inputMode="numeric" value={form.years_of_service} onChange={(v) => set('years_of_service', v)} error={errors.years_of_service} />
      <YesNo label="Do you serve in a ministry or outreach?" value={form.serves_ministry} onChange={(v) => set('serves_ministry', v)} error={errors.serves_ministry} required />
      {form.serves_ministry && (
        <TextArea id="ministry_detail" label="Tell us how you serve" helper="Which ministry or outreach, and what do you do?" example="I lead the women's prayer group and help with youth outreach." value={form.ministry_detail} onChange={(v) => set('ministry_detail', v)} error={errors.ministry_detail} required />
      )}
    </div>
  )
}

function StatementStep({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-7">
      <p className="text-lg leading-relaxed text-muted-foreground">Please answer each question in your own words. There are no wrong answers — just be honest and open.</p>
      <TextArea id="motivation" label="Why do you want to study theology?" helper="Share what has led you to apply. A minimum of 30 words." rows={6} value={form.motivation} onChange={(v) => set('motivation', v)} error={errors.motivation} required />
      <TextArea id="calling" label="Describe your calling to ministry" helper="When and how did you feel called by God? What does that calling look like for you?" rows={6} value={form.calling} onChange={(v) => set('calling', v)} error={errors.calling} required />
      <TextArea id="goals" label="What are your goals after completing this programme?" helper="How will this training help you serve God, your church, and your community?" rows={6} value={form.goals} onChange={(v) => set('goals', v)} error={errors.goals} required />
    </div>
  )
}

// ── Documents & Declaration step ─────────────────────────────

const REQUIRED_DOCS = [
  { type: 'id_document', label: 'South African ID document', hint: 'A clear copy of the front and back of your ID book or ID card.', required: true },
  { type: 'matric_certificate', label: 'Matric certificate or highest qualification', hint: 'A certified copy of your certificate.', required: true },
  { type: 'passport_photo', label: 'Passport-size photo', hint: 'A recent, colour photo with a plain white background.', required: true },
  { type: 'church_letter', label: 'Letter from your church / pastor', hint: 'A letter confirming your membership, on church letterhead if possible.', required: false },
]

function DocumentsStep({
  form, set, errors, documents, uploading, onUpload, onRemove,
}: StepProps & {
  documents: ApplicationDocument[]
  uploading: string | null
  onUpload: (type: string, file: File) => void
  onRemove: (doc: ApplicationDocument) => void
  applicationId: string | null
}) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <p className="text-lg font-semibold text-foreground">Upload your documents</p>
        <p className="text-base text-muted-foreground">Files should be PDF, JPG, or PNG, and no larger than 5 MB each.</p>

        {REQUIRED_DOCS.map((req) => {
          const uploaded = documents.find((d) => d.document_type === req.type)
          const isUploading = uploading === req.type

          return (
            <div key={req.type} className="rounded-xl border-2 border-border p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {req.label}
                    {req.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                  </p>
                  <p className="text-base text-muted-foreground">{req.hint}</p>
                </div>
                {uploaded ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-base font-medium text-success">
                      <FileText className="size-4" /> {uploaded.file_name}
                    </span>
                    <button onClick={() => onRemove(uploaded)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" disabled={isUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(req.type, f) }} />
                    <span className={cn(
                      'flex h-11 items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 px-4 text-base font-medium text-primary hover:bg-primary/5',
                      isUploading && 'opacity-50',
                    )}>
                      {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      {isUploading ? 'Uploading…' : 'Choose file'}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Declaration */}
      <div className="rounded-2xl border-2 border-dashed border-input bg-muted/30 p-6">
        <p className="font-serif text-xl font-bold text-foreground">Declaration</p>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          I declare that all information I have provided in this application is true and complete to the best of my knowledge.
          I understand that any false information may result in my application being rejected or my enrolment being cancelled.
          I consent to Ken&apos;s Training Institute verifying my documents and contacting my references.
        </p>

        {errors.declaration && (
          <p className="mt-3 flex items-center gap-1.5 text-base font-medium text-destructive" role="alert">
            <AlertCircle className="size-4 shrink-0" /> {errors.declaration}
          </p>
        )}

        <YesNo
          label="I accept the declaration above and confirm my information is correct"
          value={form.declaration}
          onChange={(v) => set('declaration', v)}
          error={undefined}
          required
        />

        <div className="mt-6 flex flex-col gap-4">
          <TextField id="signature" label="Digital signature" helper="Type your full name exactly as it appears on your ID." example="Grace Mokoena" value={form.signature} onChange={(v) => set('signature', v)} error={errors.signature} required />
          {form.signature && (
            <p className="font-[cursive] text-3xl text-primary" aria-hidden="true">{form.signature}</p>
          )}
          <TextField id="signature_date" label="Date" type="date" value={form.signature_date} onChange={(v) => set('signature_date', v)} error={errors.signature_date} required />
        </div>
      </div>
    </div>
  )
}
