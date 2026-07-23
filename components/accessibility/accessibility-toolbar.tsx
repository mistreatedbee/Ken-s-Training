"use client"

import { useState } from "react"
import { Accessibility, Sun, Moon, Type, Contrast, Volume2, VolumeX, X } from "lucide-react"
import { useAccessibility } from "./accessibility-provider"
import { cn } from "@/lib/utils"

export function AccessibilityToolbar() {
  const [open, setOpen] = useState(false)
  const { theme, textSize, highContrast, voiceReading, toggleTheme, cycleTextSize, toggleHighContrast, toggleVoiceReading } =
    useAccessibility()

  const textSizeLabel = textSize === "normal" ? "Normal text" : textSize === "large" ? "Large text" : "Largest text"

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          role="region"
          aria-label="Accessibility options"
          className="w-72 rounded-2xl border border-border bg-card p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold text-card-foreground">Accessibility</h2>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close accessibility options"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <ToolbarButton
              icon={<Type className="size-5" />}
              label={textSizeLabel}
              hint="Tap to change size"
              onClick={cycleTextSize}
            />
            <ToolbarButton
              icon={theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
              label={theme === "dark" ? "Light mode" : "Dark mode"}
              hint="Switch screen colours"
              onClick={toggleTheme}
            />
            <ToolbarButton
              icon={<Contrast className="size-5" />}
              label="High contrast"
              hint={highContrast ? "On" : "Off"}
              active={highContrast}
              onClick={toggleHighContrast}
            />
            <ToolbarButton
              icon={voiceReading ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              label="Read aloud"
              hint={voiceReading ? "On — tap text to hear it" : "Off"}
              active={voiceReading}
              onClick={toggleVoiceReading}
            />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
        aria-expanded={open}
        aria-label="Accessibility options"
      >
        <Accessibility className="size-6" />
        <span className="hidden sm:inline">Accessibility</span>
      </button>
    </div>
  )
}

function ToolbarButton({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
        active ? "border-accent bg-accent/15" : "border-border bg-background hover:bg-muted",
      )}
    >
      <span className={cn("shrink-0", active ? "text-accent-foreground" : "text-primary")}>{icon}</span>
      <span className="flex flex-col">
        <span className="text-base font-medium text-foreground">{label}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </span>
    </button>
  )
}
