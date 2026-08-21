/**
 * Plazore Ambient Soundtrack — one global player
 * OFF freezes position · volume 0% ≠ OFF · cycle active tracks only
 */

import {
  fetchActiveSoundtracks,
  SoundtrackTrack,
} from '@/services/soundtrackApi'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Audio, AVPlaybackStatus } from 'expo-av'
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
const FADE_MS = 700
const FADE_STEPS = 14

export type SoundtrackState =
  | 'IDLE'
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'DISABLED'
  | 'ERROR'

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
  setEnabled: (on: boolean) => void
  setVolume: (v: number) => void
  refreshCatalog: () => Promise<void>
  unlock: () => void
}

const SoundtrackContext = createContext<Ctx | null>(null)

export function useSoundtrack() {
  const ctx = useContext(SoundtrackContext)
  if (!ctx) throw new Error('useSoundtrack must be used inside SoundtrackProvider')
  return ctx
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
        enabled: p.enabled !== false,
        volume: clamp01(typeof p.volume === 'number' ? p.volume : DEFAULT_VOLUME),
        trackId: p.trackId ?? null,
        positionMs: Math.max(0, Number(p.positionMs) || 0),
      }
    }
  } catch {}
  return {
    enabled: true,
    volume: DEFAULT_VOLUME,
    trackId: null,
    positionMs: 0,
  }
}

async function savePrefs(p: Prefs) {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {}
}

export function SoundtrackProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<SoundtrackTrack[]>([])
  const [enabled, setEnabledState] = useState(true)
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME)
  const [state, setState] = useState<SoundtrackState>('IDLE')
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  const soundRef = useRef<Audio.Sound | null>(null)
  const indexRef = useRef(0)
  const positionRef = useRef(0)
  const trackIdRef = useRef<string | null>(null)
  const enabledRef = useRef(true)
  const volumeRef = useRef(DEFAULT_VOLUME)
  const appActiveRef = useRef(true)
  const advancingRef = useRef(false)
  const prefsReady = useRef(false)
  const tracksRef = useRef<SoundtrackTrack[]>([])
  const unlockedRef = useRef(false)

  const persist = useCallback(async () => {
    await savePrefs({
      enabled: enabledRef.current,
      volume: volumeRef.current,
      trackId: trackIdRef.current,
      positionMs: positionRef.current,
    })
  }, [])

  const resolveIndex = useCallback((list: SoundtrackTrack[], trackId: string | null) => {
    if (!list.length) return 0
    if (trackId) {
      const i = list.findIndex((t) => t.id === trackId)
      if (i >= 0) return i
    }
    return 0
  }, [])

  const unload = useCallback(async () => {
    const s = soundRef.current
    soundRef.current = null
    if (!s) return
    try {
      s.setOnPlaybackStatusUpdate(null)
      await s.unloadAsync()
    } catch {}
  }, [])

  const fadeTo = useCallback(async (sound: Audio.Sound, target: number) => {
    try {
      const st = await sound.getStatusAsync()
      if (!st.isLoaded) return
      let current = typeof st.volume === 'number' ? st.volume : volumeRef.current
      const step = (target - current) / FADE_STEPS
      for (let i = 0; i < FADE_STEPS; i++) {
        current += step
        await sound.setVolumeAsync(clamp01(current))
        await new Promise((r) => setTimeout(r, FADE_MS / FADE_STEPS))
      }
      await sound.setVolumeAsync(clamp01(target))
    } catch {}
  }, [])

  const playIndexRef = useRef<(list: SoundtrackTrack[], index: number, seekMs: number) => Promise<void>>(
    async () => {}
  )

  const advance = useCallback(async (fromEnd: boolean) => {
    if (advancingRef.current) return
    if (!enabledRef.current && fromEnd) return
    advancingRef.current = true
    try {
      const list = tracksRef.current
      if (!list.length) return
      const next = (indexRef.current + 1) % list.length
      positionRef.current = 0
      await playIndexRef.current(list, next, 0)
    } finally {
      advancingRef.current = false
    }
  }, [])

  const playIndex = useCallback(
    async (list: SoundtrackTrack[], index: number, seekMs: number) => {
      if (!list.length) {
        setState('IDLE')
        return
      }
      const safeIndex = ((index % list.length) + list.length) % list.length
      const track = list[safeIndex]
      indexRef.current = safeIndex
      trackIdRef.current = track.id
      setCurrentTitle(track.title)
      setState('LOADING')

      await unload()

      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        })

        const { sound } = await Audio.Sound.createAsync(
          { uri: track.audio_url },
          {
            shouldPlay: false,
            volume: 0,
            progressUpdateIntervalMillis: 500,
          },
          undefined,
          true
        )
        soundRef.current = sound

        if (seekMs > 0) {
          try {
            await sound.setPositionAsync(seekMs)
            positionRef.current = seekMs
          } catch {
            positionRef.current = 0
          }
        } else {
          positionRef.current = 0
        }

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) {
            if ('error' in status && status.error) {
              console.warn('[soundtrack] error', status.error)
              void advance(true)
            }
            return
          }
          positionRef.current = status.positionMillis ?? 0
          if (status.didJustFinish && !status.isLooping) {
            void advance(true)
          }
        })

        if (enabledRef.current && appActiveRef.current && unlockedRef.current) {
          await sound.playAsync()
          await fadeTo(sound, volumeRef.current)
          setState('PLAYING')
        } else if (!enabledRef.current) {
          setState('DISABLED')
        } else {
          setState('PAUSED')
        }

        await persist()
      } catch (e) {
        console.warn('[soundtrack] load failed', track.title, e)
        setState('ERROR')
        setTimeout(() => void advance(true), 400)
      }
    },
    [unload, fadeTo, persist, advance]
  )

  playIndexRef.current = playIndex

  const refreshCatalog = useCallback(async (force = false) => {
    const list = await fetchActiveSoundtracks(force)
    setTracks(list)
    tracksRef.current = list
    return list
  }, [])

  // Boot
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const prefs = await loadPrefs()
      if (cancelled) return
      enabledRef.current = prefs.enabled
      volumeRef.current = prefs.volume
      trackIdRef.current = prefs.trackId
      positionRef.current = prefs.positionMs
      setEnabledState(prefs.enabled)
      setVolumeState(prefs.volume)
      prefsReady.current = true

      const list = await fetchActiveSoundtracks(false)
      if (cancelled) return
      setTracks(list)
      tracksRef.current = list

      if (!list.length) {
        setState('IDLE')
        return
      }
      const idx = resolveIndex(list, prefs.trackId)
      indexRef.current = idx
      setCurrentTitle(list[idx]?.title ?? null)
      setState(prefs.enabled ? 'PAUSED' : 'DISABLED')
    })()
    return () => {
      cancelled = true
    }
  }, [resolveIndex])

  // Start after unlock
  useEffect(() => {
    if (!prefsReady.current || !unlocked) return
    if (!enabledRef.current || !appActiveRef.current) return
    if (!tracksRef.current.length) return
    if (soundRef.current) return

    const idx = resolveIndex(tracksRef.current, trackIdRef.current)
    void playIndexRef.current(tracksRef.current, idx, positionRef.current)
  }, [unlocked, tracks, resolveIndex])

  // App lifecycle
  useEffect(() => {
    const onChange = async (next: AppStateStatus) => {
      const active = next === 'active'
      appActiveRef.current = active
      const sound = soundRef.current

      if (!active) {
        if (sound) {
          try {
            const st = await sound.getStatusAsync()
            if (st.isLoaded) {
              positionRef.current = st.positionMillis ?? positionRef.current
              await sound.pauseAsync()
            }
          } catch {}
        }
        await persist()
        if (enabledRef.current) setState('PAUSED')
        return
      }

      await refreshCatalog(false)
      if (!enabledRef.current) {
        setState('DISABLED')
        return
      }
      if (!unlockedRef.current) return

      if (sound) {
        try {
          await sound.playAsync()
          await sound.setVolumeAsync(volumeRef.current)
          setState('PLAYING')
        } catch {
          const idx = resolveIndex(tracksRef.current, trackIdRef.current)
          void playIndexRef.current(tracksRef.current, idx, positionRef.current)
        }
      } else if (tracksRef.current.length) {
        const idx = resolveIndex(tracksRef.current, trackIdRef.current)
        void playIndexRef.current(tracksRef.current, idx, positionRef.current)
      }
    }

    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [persist, refreshCatalog, resolveIndex])

  useEffect(() => {
    return () => {
      void unload()
    }
  }, [unload])

  const setEnabled = useCallback(
    async (on: boolean) => {
      enabledRef.current = on
      setEnabledState(on)
      const sound = soundRef.current

      if (!on) {
        if (sound) {
          try {
            const st = await sound.getStatusAsync()
            if (st.isLoaded) {
              positionRef.current = st.positionMillis ?? positionRef.current
              await sound.pauseAsync()
            }
          } catch {}
        }
        setState('DISABLED')
        await persist()
        return
      }

      if (!unlockedRef.current) setUnlocked(true)
      unlockedRef.current = true

      if (!appActiveRef.current) {
        setState('PAUSED')
        await persist()
        return
      }

      if (sound) {
        try {
          await sound.setPositionAsync(positionRef.current)
          await sound.playAsync()
          await fadeTo(sound, volumeRef.current)
          setState('PLAYING')
        } catch {
          const idx = resolveIndex(tracksRef.current, trackIdRef.current)
          await playIndexRef.current(tracksRef.current, idx, positionRef.current)
        }
      } else if (tracksRef.current.length) {
        const idx = resolveIndex(tracksRef.current, trackIdRef.current)
        await playIndexRef.current(tracksRef.current, idx, positionRef.current)
      }
      await persist()
    },
    [fadeTo, persist, resolveIndex]
  )

  const setVolume = useCallback(
    async (v: number) => {
      const next = clamp01(v)
      volumeRef.current = next
      setVolumeState(next)
      const sound = soundRef.current
      if (sound) {
        try {
          await sound.setVolumeAsync(next)
        } catch {}
      }
      await persist()
    },
    [persist]
  )

  const unlock = useCallback(() => {
    unlockedRef.current = true
    setUnlocked(true)
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      state,
      enabled,
      volume,
      currentTitle,
      tracks,
      setEnabled,
      setVolume,
      refreshCatalog: async () => {
        await refreshCatalog(true)
      },
      unlock,
    }),
    [state, enabled, volume, currentTitle, tracks, setEnabled, setVolume, refreshCatalog, unlock]
  )

  return (
    <SoundtrackContext.Provider value={value}>{children}</SoundtrackContext.Provider>
  )
}