'use client'

import { CalendarDays, Check, Clock, GraduationCap, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney } from '@/lib/format'
import { studyModeLabel } from '@/lib/statuses'
import type { CatalogCourse } from '@/lib/catalog'
import { RadioCards, SelectField } from './form-fields'

export function FeeBreakdown({ course, compact }: { course: CatalogCourse; compact?: boolean }) {
  const p = course.price
  if (!p) {
    return (
      <p className="flex items-center gap-1.5 text-base text-muted-foreground">
        <Info className="size-4 shrink-0" /> Fees to be confirmed by our admissions team
      </p>
    )
  }
  const discount = Number(p.discount_amount)
  return (
    <div className="text-base">
      <p className="font-semibold text-foreground">
        Total fees: {formatMoney(p.total, p.currency)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">({p.currency})</span>
      </p>
      {!compact && (
        <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          <li>
            Course fee: {formatMoney(p.tuition_fee, p.currency)}
            {discount > 0 && (
              <span className="ml-1 font-medium text-success">
                − {formatMoney(discount, p.currency)}{p.discount_label ? ` (${p.discount_label})` : ''}
              </span>
            )}
          </li>
          {Number(p.registration_fee) > 0 && <li>Registration fee: {formatMoney(p.registration_fee, p.currency)}</li>}
          {p.other_fees?.map((fee, i) => (
            <li key={i}>{fee.label}: {formatMoney(fee.amount, p.currency)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CoursePicker({
  label, helper, courses, courseId, intakeId, studyMode, onCourse, onIntake, onStudyMode, errors,
}: {
  label: string
  helper: string
  courses: CatalogCourse[]
  courseId: string
  intakeId: string
  studyMode: string
  onCourse: (id: string) => void
  onIntake: (id: string) => void
  onStudyMode: (mode: string) => void
  errors: Record<string, string | undefined>
}) {
  const open = courses.filter((c) => c.open_for_applications)
  const selected = open.find((c) => c.id === courseId)

  const groups: { category: string | null; items: CatalogCourse[] }[] = []
  for (const c of open) {
    const last = groups[groups.length - 1]
    if (last && last.category === c.category) last.items.push(c)
    else groups.push({ category: c.category, items: [c] })
  }

  if (open.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
        <GraduationCap className="mx-auto size-10 text-muted-foreground/50" />
        <p className="mt-3 text-lg font-semibold text-foreground">No courses are open for applications right now</p>
        <p className="mt-1 text-base text-muted-foreground">Please check back soon or contact our admissions team.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold text-foreground">
          {label}<span className="ml-1 text-destructive" aria-hidden="true">*</span>
        </p>
        {helper && <p className="text-base leading-relaxed text-muted-foreground">{helper}</p>}
        {errors.course && <p role="alert" className="text-base font-medium text-destructive">{errors.course}</p>}

        <div className="mt-2 flex flex-col gap-6" role="radiogroup" aria-label={label}>
          {groups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-3">
              {group.category && <p className="text-base font-bold text-foreground">{group.category}</p>}
              {group.items.map((c) => {
                const active = c.id === courseId
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onCourse(c.id)}
                    className={cn(
                      'flex items-start gap-4 rounded-xl border-2 p-5 text-left transition',
                      active ? 'border-primary bg-primary/5' : 'border-input bg-background hover:border-primary/50 hover:bg-muted',
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2',
                      active ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}>
                      {active && <Check className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-foreground">{c.name}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {c.qualification_type && <span>{c.qualification_type}</span>}
                        {c.duration && <span className="flex items-center gap-1"><Clock className="size-3.5" />{c.duration}</span>}
                        {c.application_deadline && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3.5" /> Apply by {formatDate(c.application_deadline, 'long')}
                          </span>
                        )}
                        {c.study_modes.length > 0 && <span>{c.study_modes.map(studyModeLabel).join(' · ')}</span>}
                      </div>
                      {c.description && <p className="mt-2 text-base leading-relaxed text-muted-foreground">{c.description}</p>}
                      <div className="mt-3"><FeeBreakdown course={c} compact={!active} /></div>
                      {active && c.requirements && (
                        <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-foreground">
                          <p className="font-semibold">Entry requirements</p>
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.requirements}</p>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && selected.intakes.length > 0 && (
        <SelectField
          id="intake"
          label="Which intake would you like to join?"
          value={selected.intakes.find((i) => i.id === intakeId)?.name ?? ''}
          onChange={(name) => onIntake(selected.intakes.find((i) => i.name === name)?.id ?? '')}
          options={selected.intakes.map((i) => i.name)}
          placeholder="Select an intake"
          error={errors.intake}
          required
        />
      )}

      {selected && selected.study_modes.length > 0 && (
        <RadioCards
          label="How would you like to study?"
          value={studyModeLabel(studyMode) === '—' ? '' : studyModeLabel(studyMode)}
          onChange={(label) => onStudyMode(selected.study_modes.find((m) => studyModeLabel(m) === label) ?? '')}
          options={selected.study_modes.map(studyModeLabel)}
          error={errors.study_mode}
          required
        />
      )}
    </div>
  )
}
