'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Student } from '@/lib/types'

interface Props {
  student: Student
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function ExportStudentButton({ student }: Props) {
  function handleExport() {
    const rows: [string, string][] = [
      ['Student number', student.student_number ?? ''],
      ['Full name', student.full_name ?? ''],
      ['Phone', student.phone ?? ''],
      ['Email', student.email ?? ''],
      ['Programme', student.programme ?? ''],
      ['Status', student.status ?? ''],
      ['Joined date', student.joined_date ?? ''],
    ]

    const csv = rows.map(([label, value]) => `${csvEscape(label)},${csvEscape(value)}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const filename = `${student.student_number || student.full_name || 'student'}.csv`.replace(/\s+/g, '_')

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-1.5"
      title={`Export ${student.full_name}`}
    >
      <Download className="size-3.5" />
      Export
    </Button>
  )
}
