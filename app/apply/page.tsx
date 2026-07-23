import { ApplicationWizard } from '@/components/application/wizard'

export const metadata = { title: "Apply — Ken's Training Institute" }

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-secondary px-4 py-10 sm:px-6">
      <ApplicationWizard />
    </div>
  )
}
