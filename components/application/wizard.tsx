'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2,
  Clock, Copy, Eye, FileText, Home, Loader2, RotateCcw,
  Save, Send, ShieldCheck, Sparkles, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CORE_FIELDS, applicationsOpen, enabledSteps, fieldMaxLength, isFieldVisible,
  validateDeclaration, validateDocuments, validateStep,
  type Answers, type DeclarationAnswers, type Errors, type FieldConfig, type FormConfig,
} from '@/lib/form-config'
import type { CatalogCourse } from '@/lib/catalog'
import { submitApplication, uploadDocument, removeDocument, type UploadedDoc } from '@/app/actions/apply'
import { RadioCards, SelectField, TextArea, TextField, YesNo } from './form-fields'
import { CoursePicker, FeeBreakdown } from './course-picker'

type Phase = 'welcome' | 'form' | 'submitted'
type SaveState = 'idle' | 'saving' | 'saved'

interface Draft {
  courseId: string
  intakeId: string
  studyMode: string
  answers: Answers
  declaration: DeclarationAnswers
}

const DRAFT_KEY = 'kti-draft-v2'
const DOCS_KEY = 'kti-docs-v2'
const SESSION_KEY = 'kti-session-id'
const LEGACY_DRAFT_KEY = 'kti-draft'
const LEGACY_DOCS_KEY = 'kti-docs'

const emptyDeclaration: DeclarationAnswers = { declaration: null, signature: '', signature_date: '' }

function emptyDraft(): Draft {
  return { courseId: '', intakeId: '', studyMode: '', answers: { nationality: 'South African' }, declaration: emptyDeclaration }
}

/** Drafts saved by the previous (hard-coded) form used flat keys and the course name. */
function migrateLegacyDraft(raw: Record<string, unknown>, courses: CatalogCourse[]): Draft {
  const { programme, declaration, signature, signature_date, ...rest } = raw
  return {
    courseId: courses.find((c) => c.name === programme)?.id ?? '',
    intakeId: '',
    studyMode: '',
    answers: rest as Answers,
    declaration: {
      declaration: typeof declaration === 'boolean' ? declaration : null,
      signature: typeof signature === 'string' ? signature : '',
      signature_date: typeof signature_date === 'string' ? signature_date : '',
    },
  }
}

const storage = {
  get(key: string) { try { return localStorage.getItem(key) } catch { return null } },
  set(key: string, v: string) { try { localStorage.setItem(key, v) } catch { /* private mode */ } },
  remove(key: string) { try { localStorage.removeItem(key) } catch { /* private mode */ } },
}

export function ApplicationWizard({
  form, courses, preview = false,
}: {
  form: FormConfig
  courses: CatalogCourse[]
  /** Admin preview: nothing is saved, uploaded or submitted. */
  preview?: boolean
}) {
  const steps = useMemo(() => enabledSteps(form), [form])
  const stepKeys = useMemo(() => ['course', ...steps.map((s) => s.key), 'documents'], [steps])
  const shortLabels = useMemo(
    () => [form.course_step.short, ...steps.map((s) => s.short), form.documents_step.short],
    [form, steps],
  )

  const [phase, setPhase] = useState<Phase>('welcome')
  const [hasDraft, setHasDraft] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<Errors>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [sessionId, setSessionId] = useState('')
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isOpen = applicationsOpen(form)

  // Load draft from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    if (preview) return
    let sid = storage.get(SESSION_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      storage.set(SESSION_KEY, sid)
    }
    setSessionId(sid)
    try {
      const saved = storage.get(DRAFT_KEY)
      const legacy = storage.get(LEGACY_DRAFT_KEY)
      if (saved) {
        setDraft({ ...emptyDraft(), ...JSON.parse(saved) })
        setHasDraft(true)
      } else if (legacy) {
        setDraft(migrateLegacyDraft(JSON.parse(legacy), courses))
        setHasDraft(true)
      }
      // Documents from the old form were uploaded to a different location
      // and must be uploaded again.
      storage.remove(LEGACY_DRAFT_KEY)
      storage.remove(LEGACY_DOCS_KEY)
      const savedDocs = storage.get(DOCS_KEY)
      if (savedDocs) setDocs(JSON.parse(savedDocs))
    } catch {
      // Corrupt draft — start clean.
    }
  }, [preview, courses])

  const update = useCallback((patch: Partial<Draft>, clear: string[] = []) => {
    setDraft((d) => ({ ...d, ...patch }))
    if (clear.length) setErrors((e) => {
      const next = { ...e }
      for (const k of clear) delete next[k]
      return next
    })
  }, [])

  const setAnswer = useCallback((key: string, value: string | boolean | null) => {
    setDraft((d) => ({ ...d, answers: { ...d.answers, [key]: value } }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }, [])

  const setDecl = useCallback(<K extends keyof DeclarationAnswers>(key: K, value: DeclarationAnswers[K]) => {
    setDraft((d) => ({ ...d, declaration: { ...d.declaration, [key]: value } }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }, [])

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Autosave to localStorage
  useEffect(() => {
    if (phase !== 'form' || preview) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(() => {
      storage.set(DRAFT_KEY, JSON.stringify(draft))
      setSaveState('saved')
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [draft, phase, preview])

  const stepKey = stepKeys[stepIndex]
  const course = courses.find((c) => c.id === draft.courseId && c.open_for_applications)

  function validateCourseStep(): Errors {
    const e: Errors = {}
    if (!course) { e.course = 'Please select a course'; return e }
    if (course.intakes.length > 0 && !course.intakes.some((i) => i.id === draft.intakeId)) {
      e.intake = 'Please choose an intake'
    }
    if (course.study_modes.length > 0 && !course.study_modes.includes(draft.studyMode)) {
      e.study_mode = 'Please choose how you would like to study'
    }
    return e
  }

  function validateCurrent(): Errors {
    if (stepKey === 'course') return validateCourseStep()
    if (stepKey === 'documents') {
      return { ...validateDocuments(form, docs), ...validateDeclaration(draft.declaration) }
    }
    const step = steps.find((s) => s.key === stepKey)
    return step ? validateStep(step, draft.answers) : {}
  }

  const goNext = () => {
    const errs = validateCurrent()
    if (Object.keys(errs).length > 0) { setErrors(errs); scrollTop(); return }
    setStepIndex((i) => Math.min(i + 1, stepKeys.length - 1))
    setErrors({})
    scrollTop()
  }

  const goBack = () => { setStepIndex((i) => Math.max(i - 1, 0)); setErrors({}); scrollTop() }
  const jumpTo = (i: number) => { setStepIndex(i); scrollTop() }

  const startFresh = () => {
    const newId = crypto.randomUUID()
    if (!preview) {
      storage.set(SESSION_KEY, newId)
      storage.remove(DRAFT_KEY)
      storage.remove(DOCS_KEY)
    }
    setSessionId(newId)
    setDraft(emptyDraft())
    setDocs([])
    setStepIndex(0)
    setHasDraft(false)
    setPhase('form')
  }

  const saveDocs = (updated: UploadedDoc[]) => {
    setDocs(updated)
    if (!preview) storage.set(DOCS_KEY, JSON.stringify(updated))
  }

  const handleUpload = async (docType: string, file: File) => {
    if (preview) { setUploadError('Uploads are disabled in preview mode.'); return }
    setUploading(docType)
    setUploadError(null)
    const fd = new FormData()
    fd.set('draftId', sessionId)
    fd.set('docType', docType)
    fd.set('file', file)
    const res = await uploadDocument(fd)
    if (!res.ok) {
      setUploadError(res.error)
    } else {
      const previous = docs.find((d) => d.type === docType)
      if (previous) void removeDocument(sessionId, previous.path)
      saveDocs([...docs.filter((d) => d.type !== docType), res.doc])
      setErrors((e) => ({ ...e, [`doc_${docType}`]: undefined }))
    }
    setUploading(null)
  }

  const handleRemoveDoc = async (doc: UploadedDoc) => {
    setUploadError(null)
    const res = await removeDocument(sessionId, doc.path)
    if (!res.ok) { setUploadError(res.error ?? 'Could not remove the file. Please try again.'); return }
    saveDocs(docs.filter((d) => d.path !== doc.path))
  }

  const submit = async () => {
    const errs = validateCurrent()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (preview) { setSubmitError('This is a preview — submissions are disabled.'); return }
    setSubmitting(true)
    setSubmitError(null)
    const res = await submitApplication({
      draftId: sessionId,
      courseId: draft.courseId,
      intakeId: draft.intakeId || null,
      studyMode: draft.studyMode || null,
      answers: draft.answers,
      declaration: draft.declaration,
      documents: docs,
    })
    setSubmitting(false)
    if (!res.ok) {
      setSubmitError(res.error)
      if (res.fieldErrors && Object.keys(res.fieldErrors).length > 0) {
        setErrors(res.fieldErrors)
        // Jump to the first step that has a problem.
        const firstBad = steps.findIndex((s) => s.fields.some((f) => res.fieldErrors![f.key]))
        if (firstBad >= 0) { setStepIndex(firstBad + 1); scrollTop() }
      }
      return
    }
    storage.remove(DRAFT_KEY)
    storage.remove(DOCS_KEY)
    storage.remove(SESSION_KEY)
    setReference(res.reference)
    setPhase('submitted')
    window.scrollTo({ top: 0 })
  }

  const previewBanner = preview && (
    <div className="mx-auto mb-6 flex max-w-2xl items-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-medium text-foreground">
      <Eye className="size-4 shrink-0" /> Preview mode — nothing is saved, uploaded or submitted.
    </div>
  )

  if (!isOpen && !preview) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted">
          <Clock className="size-10 text-muted-foreground" />
        </div>
        <h1 className="mt-6 font-serif text-3xl font-bold text-foreground">Applications are closed</h1>
        <p className="mx-auto mt-4 max-w-lg whitespace-pre-line text-lg text-muted-foreground">{form.settings.closed_message}</p>
        <Link href="/" className="mt-8 inline-block">
          <Button variant="outline" className="h-14 gap-2 px-8 text-lg"><Home className="size-5" /> Return to home page</Button>
        </Link>
      </div>
    )
  }

  if (phase === 'welcome') {
    return (
      <>
        {previewBanner}
        <WelcomeScreen
          title={form.welcome.title}
          intro={form.welcome.intro}
          hasDraft={hasDraft}
          onStart={startFresh}
          onResume={() => setPhase('form')}
          onFresh={startFresh}
        />
      </>
    )
  }

  if (phase === 'submitted') {
    return (
      <SubmittedScreen
        config={form.confirmation}
        reference={reference}
        copied={copied}
        onCopy={() => {
          navigator.clipboard?.writeText(reference)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
      />
    )
  }

  const currentStep = steps.find((s) => s.key === stepKey)
  const title = stepKey === 'course' ? form.course_step.title
    : stepKey === 'documents' ? form.documents_step.title
    : currentStep?.title ?? ''

  return (
    <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-6">
      {previewBanner}
      <ProgressIndicator labels={shortLabels} stepIndex={stepIndex} onJump={jumpTo} />

      <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-accent-foreground">
              Step {stepIndex + 1} of {stepKeys.length}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
          </div>
          {!preview && <SaveBadge state={saveState} />}
        </div>

        {stepKey === 'course' && (
          <CoursePicker
            label={form.course_step.label}
            helper={form.course_step.helper}
            courses={courses}
            courseId={draft.courseId}
            intakeId={draft.intakeId}
            studyMode={draft.studyMode}
            onCourse={(id) => update({ courseId: id, intakeId: '', studyMode: '' }, ['course', 'intake', 'study_mode'])}
            onIntake={(id) => update({ intakeId: id }, ['intake'])}
            onStudyMode={(m) => update({ studyMode: m }, ['study_mode'])}
            errors={errors}
          />
        )}

        {currentStep && (
          <div className="flex flex-col gap-7">
            {currentStep.intro && (
              <p className="whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{currentStep.intro}</p>
            )}
            {currentStep.fields.filter((f) => isFieldVisible(f, draft.answers)).map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={draft.answers[field.key] ?? null}
                onChange={(v) => setAnswer(field.key, v)}
                error={errors[field.key]}
              />
            ))}
          </div>
        )}

        {stepKey === 'documents' && (
          <DocumentsStep
            form={form}
            course={course}
            declaration={draft.declaration}
            setDecl={setDecl}
            errors={errors}
            docs={docs}
            uploading={uploading}
            uploadError={uploadError}
            onUpload={handleUpload}
            onRemove={handleRemoveDoc}
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
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-destructive" role="alert">
                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                <p className="text-base font-medium">{submitError}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {stepIndex > 0 ? (
          <Button variant="outline" onClick={goBack} className="h-14 gap-2 px-6 text-lg sm:w-auto">
            <ArrowLeft className="size-5" /> Back
          </Button>
        ) : preview ? <span /> : (
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

      {!preview && (
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-base text-muted-foreground">
          <Save className="size-4" />
          Your progress is saved on this device. You can safely close and come back later.
        </p>
      )}
    </div>
  )
}

// ── Field renderer ──────────────────────────────────────────────

function FieldRenderer({
  field, value, onChange, error,
}: {
  field: FieldConfig
  value: string | boolean | null
  onChange: (v: string | boolean | null) => void
  error?: string
}) {
  const core = CORE_FIELDS[field.key]
  const text = typeof value === 'string' ? value : ''
  const common = { label: field.label, helper: field.helper || undefined, error, required: field.required }

  switch (field.type) {
    case 'textarea':
      return <TextArea id={field.key} {...common} example={field.placeholder || undefined} rows={field.key in { motivation: 1, calling: 1, goals: 1 } ? 6 : 3} value={text} onChange={onChange} />
    case 'select':
      return <SelectField id={field.key} {...common} value={text} onChange={onChange} options={field.options} placeholder={field.placeholder || 'Select an option'} />
    case 'radio':
      return <RadioCards {...common} value={text} onChange={onChange} options={field.options} />
    case 'yesno':
      return <YesNo {...common} value={typeof value === 'boolean' ? value : null} onChange={onChange} />
    default:
      return (
        <TextField
          id={field.key}
          {...common}
          example={field.placeholder || undefined}
          type={field.type}
          inputMode={core?.inputMode ?? (field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : undefined)}
          autoComplete={core?.autoComplete}
          maxLength={fieldMaxLength(field)}
          value={text}
          onChange={onChange}
        />
      )
  }
}

// ── Save badge ──────────────────────────────────────────────────

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

// ── Progress indicator ──────────────────────────────────────────

function ProgressIndicator({ labels, stepIndex, onJump }: { labels: string[]; stepIndex: number; onJump: (i: number) => void }) {
  const pct = ((stepIndex + 1) / labels.length) * 100
  return (
    <div>
      <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="flex items-center justify-between gap-1">
        {labels.map((label, i) => {
          const done = i < stepIndex
          const active = i === stepIndex
          return (
            <li key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => done ? onJump(i) : undefined}
                disabled={!done}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${label}`}
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
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ── Welcome screen ──────────────────────────────────────────────

function WelcomeScreen({
  title, intro, hasDraft, onStart, onResume, onFresh,
}: { title: string; intro: string; hasDraft: boolean; onStart: () => void; onResume: () => void; onFresh: () => void }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="whitespace-pre-line font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{intro}</p>

      <div className="mx-auto mt-8 flex max-w-md flex-col gap-3">
        <InfoRow icon={<Clock className="size-5" />} text="Takes about 15–20 minutes to complete" />
        <InfoRow icon={<Save className="size-5" />} text="Your answers save automatically as you go" />
        <InfoRow icon={<ShieldCheck className="size-5" />} text="Your information is private and kept safe" />
      </div>

      {hasDraft ? (
        <div className="mx-auto mt-8 flex max-w-md flex-col gap-3">
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-base font-medium text-foreground">
            We found an application you started on this device. Would you like to continue?
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
          <Sparkles className="size-6" /> Begin application
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

// ── Submitted screen ────────────────────────────────────────────

function SubmittedScreen({
  config, reference, copied, onCopy,
}: { config: FormConfig['confirmation']; reference: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-success/15">
        <CheckCircle2 className="size-12 text-success" />
      </div>
      <h1 className="mt-6 font-serif text-3xl font-bold text-foreground sm:text-4xl">{config.title}</h1>
      <p className="mx-auto mt-4 max-w-lg whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{config.message}</p>

      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-card p-6">
        <p className="text-base font-medium text-muted-foreground">Your reference number</p>
        <p className="mt-2 font-serif text-2xl font-bold tracking-wide text-primary sm:text-3xl">{reference}</p>
        <Button variant="outline" onClick={onCopy} className="mt-4 h-12 gap-2 px-5 text-base">
          {copied ? <><Check className="size-5 text-success" /> Copied</> : <><Copy className="size-5" /> Copy number</>}
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Please write this number down or take a photo of it. You may need it to follow up on your application.
        </p>
      </div>

      {config.next_steps.length > 0 && (
        <div className="mx-auto mt-8 max-w-md rounded-2xl bg-secondary p-6 text-left">
          <h2 className="font-serif text-lg font-bold text-foreground">What happens next?</h2>
          <ol className="mt-3 space-y-3">
            {config.next_steps.map((t, i) => (
              <li key={i} className="flex gap-3 text-base text-foreground">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block">
        <Button variant="outline" className="h-14 gap-2 px-8 text-lg">
          <Home className="size-5" /> Return to home page
        </Button>
      </Link>
    </div>
  )
}

// ── Documents & Declaration ─────────────────────────────────────

function DocumentsStep({
  form, course, declaration, setDecl, errors, docs, uploading, uploadError, onUpload, onRemove,
}: {
  form: FormConfig
  course: CatalogCourse | undefined
  declaration: DeclarationAnswers
  setDecl: <K extends keyof DeclarationAnswers>(key: K, value: DeclarationAnswers[K]) => void
  errors: Errors
  docs: UploadedDoc[]
  uploading: string | null
  uploadError: string | null
  onUpload: (type: string, file: File) => void
  onRemove: (doc: UploadedDoc) => void
}) {
  const required = form.documents.filter((d) => d.enabled)
  return (
    <div className="flex flex-col gap-7">
      {course && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">You are applying for</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{course.name}</p>
          <div className="mt-2"><FeeBreakdown course={course} /></div>
        </div>
      )}

      {required.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-lg font-semibold text-foreground">Upload your documents</p>
          {form.documents_step.intro && <p className="text-base text-muted-foreground">{form.documents_step.intro}</p>}

          {uploadError && (
            <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-base font-medium text-destructive" role="alert">
              <AlertCircle className="size-4 shrink-0" /> {uploadError}
            </p>
          )}

          {required.map((req) => {
            const uploaded = docs.find((d) => d.type === req.type)
            const isUploading = uploading === req.type
            const err = errors[`doc_${req.type}`]
            return (
              <div key={req.type} className={cn('rounded-xl border-2 p-5', err ? 'border-destructive' : 'border-border')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {req.label}
                      {req.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                    </p>
                    {req.hint && <p className="text-base text-muted-foreground">{req.hint}</p>}
                    {err && <p role="alert" className="mt-1 text-base font-medium text-destructive">{err}</p>}
                  </div>
                  {uploaded ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-base font-medium text-success">
                        <FileText className="size-4" /> {uploaded.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemove(uploaded)}
                        aria-label={`Remove ${uploaded.name}`}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" disabled={isUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(req.type, f); e.target.value = '' }} />
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
      )}

      {/* Declaration */}
      <div className="rounded-2xl border-2 border-dashed border-input bg-muted/30 p-6">
        <p className="font-serif text-xl font-bold text-foreground">Declaration</p>
        <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{form.declaration.text}</p>

        {errors.declaration && (
          <p className="mt-3 flex items-center gap-1.5 text-base font-medium text-destructive" role="alert">
            <AlertCircle className="size-4 shrink-0" /> {errors.declaration}
          </p>
        )}

        <YesNo
          label={form.declaration.accept_label}
          value={declaration.declaration}
          onChange={(v) => setDecl('declaration', v)}
          error={undefined}
          required
        />

        <div className="mt-6 flex flex-col gap-4">
          <TextField id="signature" label="Digital signature" helper="Type your full name exactly as it appears on your ID." example="Grace Mokoena" maxLength={200} value={declaration.signature} onChange={(v) => setDecl('signature', v)} error={errors.signature} required />
          {declaration.signature && (
            <p className="font-[cursive] text-3xl text-primary" aria-hidden="true">{declaration.signature}</p>
          )}
          <TextField id="signature_date" label="Date" type="date" value={declaration.signature_date} onChange={(v) => setDecl('signature_date', v)} error={errors.signature_date} required />
        </div>
      </div>
    </div>
  )
}
