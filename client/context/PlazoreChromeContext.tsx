/**
 * PlazoreChromeContext
 * Single source of truth for scroll-driven chrome (title bar + bottom tabs + room nav).
 *
 * Desired behaviour:
 * - On Home at top → title bar visible, bottom nav completely hidden
 * - Scroll down → title bar snaps out, bottom nav snaps in (fast & clean)
 * - No slow fades
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { Easing } from 'react-native'

/** Shared chrome timing — title bar, bottom tabs, room nav must all use these */
export const CHROME_IN_START = 0.08   // start a bit later so it never flashes on first paint
export const CHROME_IN_END   = 0.42   // finish quickly → snappy
export const CHROME_DURATION = 280    // short = snappy (was 520)
export const EASE_SMOOTH = Easing.bezier(0.16, 1, 0.3, 1) // decisive ease-out

type ChromeCtx = {
  /** 0 = on hero/banner, 1 = deep in showroom */
  scrollProgress: number
  setScrollProgress: (p: number) => void
  /** Home-only: hide tab bar until scrolled into showroom */
  homeChrome: boolean
  setHomeChrome: (v: boolean) => void
  hubOpen: boolean
  openHub: () => void
  closeHub: () => void
}

const Ctx = createContext<ChromeCtx | null>(null)

export function PlazoreChromeProvider({ children }: { children: React.ReactNode }) {
  const [scrollProgress, setScrollProgressRaw] = useState(0)
  const [homeChrome, setHomeChrome] = useState(false) // false on first load = nav hidden
  const [hubOpen, setHubOpen] = useState(false)

  // Always clamp so consumers never receive out-of-range values
  const setScrollProgress = useCallback((p: number) => {
    setScrollProgressRaw(Math.min(1, Math.max(0, p)))
  }, [])

  const openHub = useCallback(() => setHubOpen(true), [])
  const closeHub = useCallback(() => setHubOpen(false), [])

  const value = useMemo(
    () => ({
      scrollProgress,
      setScrollProgress,
      homeChrome,
      setHomeChrome,
      hubOpen,
      openHub,
      closeHub,
    }),
    [scrollProgress, setScrollProgress, homeChrome, hubOpen, openHub, closeHub]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlazoreChrome() {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlazoreChrome outside provider')
  return v
}