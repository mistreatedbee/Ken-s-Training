'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Download, Loader2, MessageCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/admin/confirm-dialog'
import { DataCard, EmptyState, Field, Notice, fieldClass, textareaClass } from '@/components/admin/ui'
import { addStudent, removeStudent, updateStudent, type StudentInput } from '@/app/actions/admin/students'
import { buildWhatsAppUrl, isValidWhatsAppNumber } from '@/lib/whatsapp'
import { formatDate, toCsv } from '@/lib/format'

export interface StudentRow {
  id: string
  student_number: string
  application_id: string | null
  full_name: string
  phone: string | null
  email: string | null
  id_number: string | null
  programme: string | null
  course_id: string | null
  status: string
  joined_date: string
  notes: string | null
  courses: { name: string } | null
}

type Course = { id: string; name: string; status: string }

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Active', variant: 'success' },
  completed: { label: 'Completed', variant: 'default' },
  suspended: { label: 'Suspended', variant: 'warning' },
  inactive: { label: 'Inactive', variant: 'outline' },
}

const PAGE = 25

function toInput(s?: StudentRow): StudentInput {
  return {
    full_name: s?.full_name ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? '',
    id_number: s?.id_number ?? '',
    course_id: s?.course_id ?? '',
    status: s?.status ?? 'active',
    joined_date: s?.joined_date ?? new Date().toISOString().slice(0, 10),
    notes: s?.notes ?? '',
  }
}

function StudentForm({
  initial, courses, onSubmit, onCancel, submitLabel,
}: {
  initial: StudentInput
  courses: Course[]
  onSubmit: (v: StudentInput) => Promise<{ ok: true } | { ok: false; error: string; errors?: Record<string, string> }>
  onCancel: () => void
  submitLabel: string
}) {
  const [v, setV] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof StudentInput>(k: K, val: StudentInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const id = useMemo(() => Math.random().toString(36).slice(2, 8), [])

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await onSubmit(v)
          if (!res.ok) { setErrors(res.errors ?? {}); setError(res.error) }
        })
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {error && <div className="sm:col-span-2"><Notice tone="error">{error}</Notice></div>}
      <Field label="Full name" htmlFor={`sn-${id}`} required error={errors.full_name}>
        <input id={`sn-${id}`} className={fieldClass} value={v.full_name} onChange={(e) => set('full_name', e.target.value)} />
      </Field>
      <Field label="ID / passport number" htmlFor={`si-${id}`}>
        <input id={`si-${id}`} className={fieldClass} value={v.id_number} onChange={(e) => set('id_number', e.target.value)} />
      </Field>
      <Field label="Phone / WhatsApp" htmlFor={`sp-${id}`} error={errors.phone}>
        <input id={`sp-${id}`} type="tel" className={fieldClass} value={v.phone} onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <Field label="Email" htmlFor={`se-${id}`} error={errors.email}>
        <input id={`se-${id}`} type="email" className={fieldClass} value={v.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label="Course" htmlFor={`sc-${id}`} error={errors.course_id}>
        <select id={`sc-${id}`} className={fieldClass} value={v.course_id} onChange={(e) => set('course_id', e.target.value)}>
          <option value="">— No course —</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== 'active' ? ` (${c.status})` : ''}</option>)}
        </select>
      </Field>
      <Field label="Status" htmlFor={`ss-${id}`} error={errors.status}>
        <select id={`ss-${id}`} className={fieldClass} value={v.status} onChange={(e) => set('status', e.target.value)}>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Joined on" htmlFor={`sj-${id}`} error={errors.joined_date}>
        <input id={`sj-${id}`} type="date" className={fieldClass} value={v.joined_date} onChange={(e) => set('joined_date', e.target.value)} />
      </Field>
      <Field label="Notes" htmlFor={`so-${id}`} error={errors.notes} className="sm:col-span-2" hint="Internal — not visible to the student">
        <textarea id={`so-${id}`} rows={3} className={textareaClass} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending} className="h-10 gap-2 px-4">{pending && <Loader2 className="size-4 animate-spin" />} {submitLabel}</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending} className="h-10 px-4">Cancel</Button>
      </div>
    </form>
  )
}

export function StudentsManager({
  students, courses, canEdit, canExport,
}: { students: StudentRow[]; courses: Course[]; canEdit: boolean; canExport: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<StudentRow | null>(null)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [pending, start] = useTransition()

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return students.filter((s) =>
      (!course || (course === 'none' ? !s.course_id : s.course_id === course)) &&
      (!status || s.status === status) &&
      (!term || [s.full_name, s.student_number, s.phone, s.email, s.id_number].some((x) => x?.toLowerCase().includes(term))),
    )
  }, [students, q, course, status])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE)
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of students) c[s.status] = (c[s.status] ?? 0) + 1
    return c
  }, [students])

  function exportCsv(list: StudentRow[] = filtered, name = `kti-students-${new Date().toISOString().slice(0, 10)}`) {
    const rows = [
      ['Student number', 'Full name', 'ID number', 'Phone', 'Email', 'Course', 'Status', 'Joined', 'Source', 'Notes'],
      ...list.map((s) => [
        s.student_number, s.full_name, s.id_number, s.phone, s.email, s.courses?.name ?? s.programme,
        STATUS[s.status]?.label ?? s.status, s.joined_date, s.application_id ? 'Online application' : 'Added by staff', s.notes,
      ]),
    ]
    const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[^\w.-]+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const done = (text: string) => { setMsg({ tone: 'success', text }); router.refresh() }

  return (
    <div className="flex flex-col gap-5">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(STATUS).map(([k, s]) => (
          <button key={k} type="button" onClick={() => { setStatus(status === k ? '' : k); setPage(1) }}
            aria-pressed={status === k}
            className={`rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40 ${status === k ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="font-serif text-2xl font-bold">{counts[k] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <label htmlFor="st-q" className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
          <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-muted-foreground" />
          <input id="st-q" className={`${fieldClass} pl-9`} placeholder="Name, student number, phone, email or ID" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <div className="lg:w-64">
          <label htmlFor="st-c" className="mb-1 block text-xs font-medium text-muted-foreground">Course</label>
          <select id="st-c" className={fieldClass} value={course} onChange={(e) => { setCourse(e.target.value); setPage(1) }}>
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">No course</option>
          </select>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" onClick={() => exportCsv()} disabled={filtered.length === 0} className="h-10 gap-2">
              <Download className="size-4" /> Export {filtered.length}
            </Button>
          )}
          {canEdit && !adding && (
            <Button onClick={() => { setAdding(true); setMsg(null) }} className="h-10 gap-2"><Plus className="size-4" /> Add student</Button>
          )}
        </div>
      </div>

      {adding && (
        <DataCard title="Add a student">
          <p className="mb-4 text-sm text-muted-foreground">
            For students who didn&apos;t apply online. They get a student number automatically.
          </p>
          <StudentForm
            initial={toInput()}
            courses={courses}
            submitLabel="Add student"
            onCancel={() => setAdding(false)}
            onSubmit={async (v) => {
              const res = await addStudent(v)
              if (res.ok) { setAdding(false); done(`${v.full_name} added.`) }
              return res
            }}
          />
        </DataCard>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={students.length === 0 ? 'No students yet' : 'No students match'}
          description={students.length === 0 ? 'Accepted applicants appear here automatically. You can also add students by hand.' : 'Try a different search or filter.'}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((s) => {
            const isOpen = open === s.id
            const wa = s.phone && isValidWhatsAppNumber(s.phone) ? buildWhatsAppUrl(s.phone) : null
            return (
              <li key={s.id} className="rounded-2xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}
                    onClick={() => { setOpen(isOpen ? null : s.id); setEditing(null) }}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                      {s.full_name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">{s.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className="font-mono">{s.student_number}</span> · {s.courses?.name ?? s.programme ?? 'No course'}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS[s.status]?.variant ?? 'outline'}>{STATUS[s.status]?.label ?? s.status}</Badge>
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${s.full_name}`}
                        className="rounded-lg p-2 text-[#25D366] hover:bg-[#25D366]/10"><MessageCircle className="size-4" /></a>
                    )}
                    <button type="button" aria-label={isOpen ? 'Hide details' : 'Show details'} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                      onClick={() => { setOpen(isOpen ? null : s.id); setEditing(null) }}>
                      {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border p-4">
                    {editing === s.id ? (
                      <StudentForm
                        initial={toInput(s)}
                        courses={courses}
                        submitLabel="Save changes"
                        onCancel={() => setEditing(null)}
                        onSubmit={async (v) => {
                          const res = await updateStudent(s.id, v)
                          if (res.ok) { setEditing(null); done('Student updated.') }
                          return res
                        }}
                      />
                    ) : (
                      <div className="flex flex-col gap-4">
                        <dl className="grid gap-3 text-sm sm:grid-cols-3">
                          <div><dt className="text-muted-foreground">Phone</dt><dd>{s.phone || '—'}</dd></div>
                          <div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{s.email || '—'}</dd></div>
                          <div><dt className="text-muted-foreground">ID number</dt><dd>{s.id_number || '—'}</dd></div>
                          <div><dt className="text-muted-foreground">Joined</dt><dd>{formatDate(s.joined_date)}</dd></div>
                          <div><dt className="text-muted-foreground">Source</dt><dd>{s.application_id ? 'Online application' : 'Added by staff'}</dd></div>
                          {s.notes && <div className="sm:col-span-3"><dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap">{s.notes}</dd></div>}
                        </dl>
                        <div className="flex flex-wrap gap-2">
                          {canEdit && (
                            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => { setEditing(s.id); setMsg(null) }}>
                              <Pencil className="size-4" /> Edit details &amp; status
                            </Button>
                          )}
                          {canExport && (
                            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => exportCsv([s], s.student_number || s.full_name)}>
                              <Download className="size-4" /> Export
                            </Button>
                          )}
                          {s.application_id && (
                            <Link href={`/admin/applications/${s.application_id}`} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                              View application
                            </Link>
                          )}
                          {canEdit && !s.application_id && (
                            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={() => setRemoving(s)}>
                              <Trash2 className="size-4" /> Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}</span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
          </span>
        </nav>
      )}

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.full_name}?`}
        description="This student was added by hand and will be removed permanently. Students who applied online can only be set to Inactive."
        confirmLabel="Remove"
        destructive
        busy={pending}
        onConfirm={() => removing && start(async () => {
          const res = await removeStudent(removing.id)
          setRemoving(null)
          if (!res.ok) setMsg({ tone: 'error', text: res.error })
          else done('Student removed.')
        })}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
