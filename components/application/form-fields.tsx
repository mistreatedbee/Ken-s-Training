'use client'

import { AlertCircle, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function FieldShell({
  label,
  helper,
  error,
  required,
  htmlFor,
  children,
}: {
  label: string
  helper?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-lg font-semibold text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </label>
      {helper && <p className="text-base leading-relaxed text-muted-foreground">{helper}</p>}
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-base font-medium text-destructive" role="alert">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

const inputBase =
  'h-14 w-full rounded-xl border-2 bg-background px-4 text-lg text-foreground placeholder:text-muted-foreground/60 transition outline-none focus:border-ring focus:ring-4 focus:ring-ring/15'

export function TextField({
  id,
  label,
  helper,
  example,
  error,
  value,
  onChange,
  type = 'text',
  required,
  inputMode,
  autoComplete,
  maxLength,
  min,
  max,
}: {
  id: string
  label: string
  helper?: string
  example?: string
  error?: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  maxLength?: number
  min?: number | string
  max?: number | string
}) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        min={min}
        max={max}
        placeholder={example ? `e.g. ${example}` : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn(inputBase, error ? 'border-destructive' : 'border-input')}
      />
    </FieldShell>
  )
}

export function TextArea({
  id,
  label,
  helper,
  example,
  error,
  value,
  onChange,
  required,
  rows = 5,
}: {
  id: string
  label: string
  helper?: string
  example?: string
  error?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  rows?: number
}) {
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={example}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn(
          'w-full rounded-xl border-2 bg-background p-4 text-lg leading-relaxed text-foreground placeholder:text-muted-foreground/60 transition outline-none focus:border-ring focus:ring-4 focus:ring-ring/15',
          error ? 'border-destructive' : 'border-input',
        )}
      />
      {value && (
        <p className="text-sm text-muted-foreground">{wordCount} word{wordCount !== 1 ? 's' : ''}</p>
      )}
    </FieldShell>
  )
}

export function SelectField({
  id,
  label,
  helper,
  error,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  required,
}: {
  id: string
  label: string
  helper?: string
  error?: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
}) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={cn(
            inputBase,
            'appearance-none pr-12',
            error ? 'border-destructive' : 'border-input',
            !value && 'text-muted-foreground/60',
          )}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="text-foreground">{o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </FieldShell>
  )
}

export function YesNo({
  label,
  helper,
  error,
  value,
  onChange,
  required,
}: {
  label: string
  helper?: string
  error?: string
  value: boolean | null
  onChange: (v: boolean) => void
  required?: boolean
}) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required}>
      <div className="grid grid-cols-2 gap-3">
        {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map((opt) => {
          const active = value === opt.val
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.val)}
              aria-pressed={active}
              className={cn(
                'flex h-14 items-center justify-center gap-2 rounded-xl border-2 text-lg font-semibold transition',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-foreground hover:border-primary/50 hover:bg-muted',
              )}
            >
              {active && <Check className="size-5" />}
              {opt.label}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

export function RadioCards({
  label,
  helper,
  error,
  value,
  onChange,
  options,
  required,
}: {
  label: string
  helper?: string
  error?: string
  value: string
  onChange: (v: string) => void
  options: string[]
  required?: boolean
}) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required}>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const active = value === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={active}
              className={cn(
                'flex h-14 items-center gap-3 rounded-xl border-2 px-4 text-lg font-medium transition',
                active
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-input bg-background text-foreground hover:border-primary/50 hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border-2',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                )}
              >
                {active && <Check className="size-4" />}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}

export function ProgrammeCards({
  label,
  helper,
  error,
  value,
  onChange,
  programmes,
  required,
}: {
  label: string
  helper?: string
  error?: string
  value: string
  onChange: (v: string) => void
  programmes: { id: string; name: string; duration_years: number; description: string | null }[]
  required?: boolean
}) {
  return (
    <FieldShell label={label} helper={helper} error={error} required={required}>
      <div className="flex flex-col gap-3">
        {programmes.map((p) => {
          const active = value === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              aria-pressed={active}
              className={cn(
                'flex items-start gap-4 rounded-xl border-2 p-5 text-left transition',
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-input bg-background hover:border-primary/50 hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                )}
              >
                {active && <Check className="size-4" />}
              </span>
              <div>
                <p className="text-lg font-semibold text-foreground">{p.name}</p>
                <p className="mt-0.5 text-base text-muted-foreground">
                  {p.duration_years} year{p.duration_years > 1 ? 's' : ''}
                </p>
                {p.description && (
                  <p className="mt-1 text-base leading-relaxed text-muted-foreground">{p.description}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}
