"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = "light" | "dark"

type TextSize = "normal" | "large" | "larger"

type AccessibilityState = {
  theme: Theme
  textSize: TextSize
  highContrast: boolean
  voiceReading: boolean
}

type AccessibilityContextValue = AccessibilityState & {
  toggleTheme: () => void
  setTextSize: (size: TextSize) => void
  cycleTextSize: () => void
  toggleHighContrast: () => void
  toggleVoiceReading: () => void
  speak: (text: string) => void
}

const STORAGE_KEY = "kti-accessibility"

const TEXT_SCALE: Record<TextSize, string> = {
  normal: "1",
  large: "1.15",
  larger: "1.3",
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

const defaultState: AccessibilityState = {
  theme: "light",
  textSize: "normal",
  highContrast: false,
  voiceReading: false,
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccessibilityState>(defaultState)
  const [hydrated, setHydrated] = useState(false)

  // Load saved preferences on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AccessibilityState>
        setState((prev) => ({ ...prev, ...parsed }))
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setState((prev) => ({ ...prev, theme: "dark" }))
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true)
  }, [])

  // Apply preferences to <html> and persist
  useEffect(() => {
    if (!hydrated) return
    const root = document.documentElement
    root.classList.toggle("dark", state.theme === "dark")
    root.classList.toggle("light", state.theme === "light")
    root.classList.toggle("contrast-high", state.highContrast)
    root.style.setProperty("--text-scale", TEXT_SCALE[state.textSize])
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore
    }
  }, [state, hydrated])

  const toggleTheme = useCallback(() => {
    setState((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))
  }, [])

  const setTextSize = useCallback((size: TextSize) => {
    setState((p) => ({ ...p, textSize: size }))
  }, [])

  const cycleTextSize = useCallback(() => {
    setState((p) => {
      const order: TextSize[] = ["normal", "large", "larger"]
      const next = order[(order.indexOf(p.textSize) + 1) % order.length]
      return { ...p, textSize: next }
    })
  }, [])

  const toggleHighContrast = useCallback(() => {
    setState((p) => ({ ...p, highContrast: !p.highContrast }))
  }, [])

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }, [])

  const toggleVoiceReading = useCallback(() => {
    setState((p) => {
      const next = !p.voiceReading
      if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      return { ...p, voiceReading: next }
    })
  }, [])

  return (
    <AccessibilityContext.Provider
      value={{
        ...state,
        toggleTheme,
        setTextSize,
        cycleTextSize,
        toggleHighContrast,
        toggleVoiceReading,
        speak,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) {
    throw new Error("useAccessibility must be used within AccessibilityProvider")
  }
  return ctx
}
