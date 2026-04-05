import { useState, useEffect } from "react"

// A curated palette of 12 maximally distinct OKLCH colors.
// Chosen for perceptual separation on both light and dark backgrounds.
// Each entry: { dark: oklch(...), light: oklch(...) }
const MODEL_PALETTE = [
  { dark: "oklch(0.80 0.16 140)", light: "oklch(0.42 0.13 140)" },  // green
  { dark: "oklch(0.80 0.18 250)", light: "oklch(0.42 0.15 250)" },  // blue
  { dark: "oklch(0.82 0.16 340)", light: "oklch(0.40 0.13 340)" },  // pink/red
  { dark: "oklch(0.85 0.14  70)", light: "oklch(0.40 0.12  70)" },  // orange
  { dark: "oklch(0.82 0.14 180)", light: "oklch(0.40 0.12 180)" },  // teal
  { dark: "oklch(0.80 0.16  30)", light: "oklch(0.40 0.14  30)" },  // amber
  { dark: "oklch(0.78 0.18 290)", light: "oklch(0.42 0.16 290)" },  // purple
  { dark: "oklch(0.83 0.16 110)", light: "oklch(0.40 0.13 110)" },  // lime
  { dark: "oklch(0.80 0.15 210)", light: "oklch(0.42 0.14 210)" },  // sky blue
  { dark: "oklch(0.78 0.16  15)", light: "oklch(0.40 0.14  15)" },  // coral
  { dark: "oklch(0.82 0.14 160)", light: "oklch(0.40 0.12 160)" },  // emerald
  { dark: "oklch(0.80 0.16 310)", light: "oklch(0.42 0.15 310)" },  // magenta
] as const

// Hash a model name to a palette index (0-11).
// Uses FNV-1a with murmur3 finalizer for strong avalanche.
function modelToPaletteIndex(name: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  hash = hash ^ (hash >>> 16)
  return ((hash >>> 0) % MODEL_PALETTE.length)
}

// Detect dark mode from the Tailwind class strategy
function useDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return dark
}

/**
 * Get a visually distinct OKLCH color for a model name from a curated palette.
 * Returns undefined for empty/none model names.
 */
export function useModelColor(modelName: string | undefined | null): string | undefined {
  const dark = useDarkMode()
  if (!modelName || modelName === "none" || modelName === "None") return undefined
  const idx = modelToPaletteIndex(modelName)
  return dark ? MODEL_PALETTE[idx].dark : MODEL_PALETTE[idx].light
}
