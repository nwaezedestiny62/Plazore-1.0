import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

type ChromeCtx = {
  /** 0 = on hero/banner, 1 = in showroom */
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
  const [scrollProgress, setScrollProgress] = useState(0)
  const [homeChrome, setHomeChrome] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)

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
    [scrollProgress, homeChrome, hubOpen, openHub, closeHub]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlazoreChrome() {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlazoreChrome outside provider')
  return v
}