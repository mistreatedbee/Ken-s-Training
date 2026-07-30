import Image from "next/image"
import { cn } from "@/lib/utils"

// Real file is 1894x830 (~2.28:1). Sizing by height + w-auto keeps that
// ratio intact — a square box would squash it down to a sliver.
export function BrandLogo({
  className,
  showText = true,
  textClassName,
  imgClassName = "h-10 w-auto shrink-0 object-contain",
  imgWidth = 1894,
  imgHeight = 830,
}: {
  className?: string
  showText?: boolean
  textClassName?: string
  imgClassName?: string
  imgWidth?: number
  imgHeight?: number
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image
        src="/kti-logo.png"
        alt="Ken's Training Institute logo"
        width={imgWidth}
        height={imgHeight}
        className={imgClassName}
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
