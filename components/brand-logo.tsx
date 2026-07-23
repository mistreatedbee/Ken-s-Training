import Image from "next/image"
import { cn } from "@/lib/utils"

export function BrandLogo({
  className,
  showText = true,
  textClassName,
}: {
  className?: string
  showText?: boolean
  textClassName?: string
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image
        src="/kti-logo.png"
        alt="Ken's Training Institute crest"
        width={48}
        height={48}
        className="size-10 shrink-0 object-contain sm:size-12"
        priority
      />
      {showText && (
        <span className={cn("flex flex-col leading-tight", textClassName)}>
          <span className="font-serif text-base font-bold sm:text-lg">Ken&apos;s Training</span>
          <span className="text-xs font-medium uppercase tracking-wide opacity-80 sm:text-sm">Institute</span>
        </span>
      )}
    </span>
  )
}
