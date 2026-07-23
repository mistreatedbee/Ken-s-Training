"use client"

import { useEffect } from "react"
import { useAccessibility } from "./accessibility-provider"

const READABLE = "h1, h2, h3, h4, p, li, a, button, label, [data-speak]"

/**
 * When "Read aloud" is enabled, moving the pointer over (or focusing) any
 * readable element speaks its text. Designed for low-literacy and low-vision
 * users. Uses the browser SpeechSynthesis API.
 */
export function VoiceReader() {
  const { voiceReading, speak } = useAccessibility()

  useEffect(() => {
    if (!voiceReading) return

    let lastText = ""
    let timer: ReturnType<typeof setTimeout> | null = null

    const getText = (el: HTMLElement): string => {
      const explicit = el.getAttribute("data-speak") || el.getAttribute("aria-label")
      const text = (explicit || el.innerText || "").trim().replace(/\s+/g, " ")
      return text.length > 240 ? text.slice(0, 240) : text
    }

    const handle = (e: Event) => {
      const target = (e.target as HTMLElement)?.closest?.(READABLE) as HTMLElement | null
      if (!target) return
      const text = getText(target)
      if (!text || text === lastText) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        lastText = text
        speak(text)
      }, 250)
    }

    document.addEventListener("mouseover", handle)
    document.addEventListener("focusin", handle)
    return () => {
      document.removeEventListener("mouseover", handle)
      document.removeEventListener("focusin", handle)
      if (timer) clearTimeout(timer)
    }
  }, [voiceReading, speak])

  return null
}
