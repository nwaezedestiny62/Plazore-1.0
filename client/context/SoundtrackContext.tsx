/**
 * Plazore Ambient Soundtrack — no native audio module
 * ---------------------------------------------------
 * This file NEVER imports, requires, or dynamically loads expo-av.
 * That is what caused ExponentAV / TypeScript errors in Expo Go.
 *
 * Provider still exists so Settings + intro gates keep working.
 * Music is unavailable until you later add a separate native player
 * in a real dev build (not this file).
 */

import {
  fetchActiveSoundtracks,
  SoundtrackTrack,
} from '@/services/soundtrackApi'
import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState, AppStateStatus } from 'react-native'

const PREFS_KEY = '@plazore/soundtrack_prefs_v1'
const DEFAULT_VOLUME = 0.2
const DEFAULT_ENABLED = false

export type SoundtrackState =
  | 'IDLE'
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'DISABLED'
  | 'ERROR'
  | 'UNAVAILABLE'

type Prefs = {
  enabled: boolean
  volume: number
  trackId: string | null
  positionMs: number
}

type Ctx = {
  state: SoundtrackState
  enabled: boolean
  volume: number
  currentTitle: string | null
  tracks: SoundtrackTrack[]
  audioAvailable: boolean
  setEnabled: (on: boolean) => void
  setVolume: (v: number) => void
  refreshCatalog: () => Promise<void>
  unlock: () => void
  holdIntroGate: () => void
  releaseIntroGate: () => void
  forceStop: () => void
}

const SoundtrackContext = createContext<Ctx | null>(null)

export function useSoundtrack() {
  const ctx = useContext(SoundtrackContext)
  if (!ctx) {
    throw new Error('useSoundtrack must be used inside SoundtrackProvider')
  }
  return ctx
}

export function useSoundtrackOptional() {
  return useContext(SoundtrackContext)
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Prefs
      return {
        enabled: p.enabled === true,
        volume: clamp01(
          typeof p.volume === 'number' ? p.volume : DEFAULT_VOLUME
        ),
        trackId: p.trackId ?? null,
        positionMs: Math.max(0, Number(p.positionMs) || 0),
      }
    }
  } catch {
    /* ignore */
  }
  return {
    enabled: DEFAULT_ENABLED,
    volume: DEFAULT_VOLUME,
    trackId: null,
    positionMs: 0,
  }
}

async function savePrefs(p: Prefs) {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

export function SoundtrackProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [tracks, setTracks] = useState<SoundtrackTrack[]>([])
  const [enabled, setEnabledState] = useState(false)
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME)
  const [state, setState] = useState<SoundtrackState>('UNAVAILABLE')
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)

  const enabledRef = useRef(false)
  const volumeRef = useRef(DEFAULT_VOLUME)
  const trackIdRef = useRef<string | null>(null)
  const positionRef = useRef(0)
  const introSilencedRef = useRef(true)
  const unlockedRef = useRef(false)
  const tracksRef = useRef<SoundtrackTrack[]>([])

  const persist = useCallback(async () => {
    await savePrefs({
      enabled: false,
      volume: volumeRef.current,
      trackId: trackIdRef.current,
      positionMs: positionRef.current,
    })
  }, [])

  const refreshCatalog = useCallback(async (force = false) => {
    try {
      const list = await fetchActiveSoundtracks(force)
      setTracks(list)
      tracksRef.current = list
      if (list[0]?.title) setCurrentTitle(list[0].title)
      return list
    } catch {
      return tracksRef.current
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const prefs = await loadPrefs()
        if (cancelled) return
        volumeRef.current = prefs.volume
        trackIdRef.current = prefs.trackId
        positionRef.current = prefs.positionMs
        setVolumeState(prefs.volume)
        enabledRef.current = false
        setEnabledState(false)
        setState('UNAVAILABLE')
        await refreshCatalog(false)
      } catch {
        if (!cancelled) setState('UNAVAILABLE')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshCatalog])

  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      (_next: AppStateStatus) => {
        setState('UNAVAILABLE')
      }
    )
    return () => sub.remove()
  }, [])

  const setEnabled = useCallback(
    async (_on: boolean) => {
      enabledRef.current = false
      setEnabledState(false)
      setState('UNAVAILABLE')
      await persist()
    },
    [persist]
  )

  const setVolume = useCallback(
    async (v: number) => {
      const next = clamp01(v)
      volumeRef.current = next
      setVolumeState(next)
      await persist()
    },
    [persist]
  )

  const unlock = useCallback(() => {
    unlockedRef.current = true
  }, [])

  const holdIntroGate = useCallback(() => {
    introSilencedRef.current = true
    setState('UNAVAILABLE')
  }, [])

  const releaseIntroGate = useCallback(() => {
    introSilencedRef.current = false
    unlockedRef.current = true
    setState('UNAVAILABLE')
  }, [])

  const forceStop = useCallback(async () => {
    introSilencedRef.current = true
    setState('UNAVAILABLE')
    await persist()
  }, [persist])

  const value = useMemo<Ctx>(
    () => ({
      state,
      enabled,
      volume,
      currentTitle,
      tracks,
      audioAvailable: false,
      setEnabled,
      setVolume,
      refreshCatalog: async () => {
        await refreshCatalog(true)
      },
      unlock,
      holdIntroGate,
      releaseIntroGate,
      forceStop,
    }),
    [
      state,
      enabled,
      volume,
      currentTitle,
      tracks,
      setEnabled,
      setVolume,
      refreshCatalog,
      unlock,
      holdIntroGate,
      releaseIntroGate,
      forceStop,
    ]
  )

  return (
    <SoundtrackContext.Provider value={value}>
      {children}
    </SoundtrackContext.Provider>
  )
}