import Image from "next/image"
import { cn } from "@/lib/utils"

// Logo file is 1894x830 (~2.28:1). Use height-based sizing (h-* w-auto) to
// preserve the aspect ratio — a square box squashes the wide lockup.
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
          <span className="font-serif text-sm font-semibold sm:text-base">Ken&apos;s Training Institute</span>
          <span className="text-xs font-bold sm:text-sm">Theological College</span>
        </span>
      )}
    </span>
  )
}
