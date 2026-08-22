/**
 * Plazore Ambient Soundtrack — one global player (hardened)
 * -------------------------------------------------------
 * Rules enforced:
 * 1. Exactly one Audio.Sound instance can exist at any time
 * 2. Music is COMPLETELY silent on opener + preloader + auth screens
 * 3. Only plays inside the real app environment (after releaseIntroGate)
 * 4. Respects last saved enabled + position
 * 5. Logout → force stop
 * 6. No overlapping / clashing tracks under any race condition
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
  holdIntroGate: () => void
  releaseIntroGate: () => void
  /** Call this on logout / auth screens */
  forceStop: () => void
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

  // ─── Refs (single source of truth) ───────────────────────────────────────
  const soundRef = useRef<Audio.Sound | null>(null)
  const indexRef = useRef(0)
  const positionRef = useRef(0)
  const trackIdRef = useRef<string | null>(null)
  const enabledRef = useRef(true)
  const volumeRef = useRef(DEFAULT_VOLUME)
  const appActiveRef = useRef(true)
  const unlockedRef = useRef(false)
  const introSilencedRef = useRef(true) // starts silenced → opener never gets audio
  const tracksRef = useRef<SoundtrackTrack[]>([])
  const prefsReady = useRef(false)

  // Critical: generation counter kills any stale async work
  const generationRef = useRef(0)
  // Serializes all play / load operations
  const operationLock = useRef(false)

  const persist = useCallback(async () => {
    await savePrefs({
      enabled: enabledRef.current,
      volume: volumeRef.current,
      trackId: trackIdRef.current,
      positionMs: positionRef.current,
    })
  }, [])

  /** Only true when we are allowed to make sound */
  const canPlay = useCallback(() => {
    return (
      enabledRef.current &&
      appActiveRef.current &&
      unlockedRef.current &&
      !introSilencedRef.current
    )
  }, [])

  const resolveIndex = useCallback((list: SoundtrackTrack[], trackId: string | null) => {
    if (!list.length) return 0
    if (trackId) {
      const i = list.findIndex((t) => t.id === trackId)
      if (i >= 0) return i
    }
    return 0
  }, [])

  // ─── Hard unload (kills any existing sound) ──────────────────────────────
  const unload = useCallback(async () => {
    const s = soundRef.current
    soundRef.current = null
    if (!s) return
    try {
      s.setOnPlaybackStatusUpdate(null)
      await s.stopAsync().catch(() => {})
      await s.unloadAsync().catch(() => {})
    } catch {}
  }, [])

  const fadeTo = useCallback(async (sound: Audio.Sound, target: number, gen: number) => {
    try {
      const st = await sound.getStatusAsync()
      if (!st.isLoaded || generationRef.current !== gen) return
      let current = typeof st.volume === 'number' ? st.volume : volumeRef.current
      const step = (target - current) / FADE_STEPS
      for (let i = 0; i < FADE_STEPS; i++) {
        if (generationRef.current !== gen) return
        current += step
        await sound.setVolumeAsync(clamp01(current))
        await new Promise((r) => setTimeout(r, FADE_MS / FADE_STEPS))
      }
      if (generationRef.current === gen) {
        await sound.setVolumeAsync(clamp01(target))
      }
    } catch {}
  }, [])

  // ─── Core play function (fully serialized + generation-guarded) ──────────
  const playIndex = useCallback(
    async (list: SoundtrackTrack[], index: number, seekMs: number) => {
      // Prevent concurrent operations
      if (operationLock.current) return
      operationLock.current = true

      const gen = ++generationRef.current

      try {
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

        // Kill any previous sound first
        await unload()

        // Abort if a newer operation started while we were unloading
        if (generationRef.current !== gen) return

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

        // Abort if generation changed while creating
        if (generationRef.current !== gen) {
          try {
            await sound.unloadAsync()
          } catch {}
          return
        }

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
          // Ignore status from old generations
          if (generationRef.current !== gen) return

          if (!status.isLoaded) {
            if ('error' in status && status.error) {
              console.warn('[soundtrack] error', status.error)
              // advance only if still current
              if (generationRef.current === gen) {
                void advance(true)
              }
            }
            return
          }
          positionRef.current = status.positionMillis ?? 0
          if (status.didJustFinish && !status.isLooping) {
            if (generationRef.current === gen) {
              void advance(true)
            }
          }
        })

        // Final gate check before making any sound
        if (generationRef.current !== gen) return

        if (canPlay()) {
          await sound.playAsync()
          await fadeTo(sound, volumeRef.current, gen)
          if (generationRef.current === gen) {
            setState('PLAYING')
          }
        } else if (!enabledRef.current) {
          setState('DISABLED')
        } else {
          setState('PAUSED')
        }

        await persist()
      } catch (e) {
        console.warn('[soundtrack] load failed', e)
        if (generationRef.current === gen) {
          setState('ERROR')
          setTimeout(() => {
            if (generationRef.current === gen) void advance(true)
          }, 400)
        }
      } finally {
        operationLock.current = false
      }
    },
    [unload, fadeTo, persist, canPlay]
  )

  // advance needs the latest playIndex
  const advance = useCallback(
    async (fromEnd: boolean) => {
      if (!enabledRef.current && fromEnd) return
      if (operationLock.current) return

      const list = tracksRef.current
      if (!list.length) return

      const next = (indexRef.current + 1) % list.length
      positionRef.current = 0
      await playIndex(list, next, 0)
    },
    [playIndex]
  )

  const refreshCatalog = useCallback(async (force = false) => {
    const list = await fetchActiveSoundtracks(force)
    setTracks(list)
    tracksRef.current = list
    return list
  }, [])

  const tryStartOrResume = useCallback(async () => {
    if (!canPlay()) return
    if (!tracksRef.current.length) return
    if (operationLock.current) return

    const sound = soundRef.current
    if (sound) {
      try {
        const st = await sound.getStatusAsync()
        if (st.isLoaded) {
          await sound.playAsync()
          await sound.setVolumeAsync(volumeRef.current)
          setState('PLAYING')
          return
        }
      } catch {
        // fall through and reload
      }
    }

    const idx = resolveIndex(tracksRef.current, trackIdRef.current)
    await playIndex(tracksRef.current, idx, positionRef.current)
  }, [canPlay, resolveIndex, playIndex])

  // ─── Boot ────────────────────────────────────────────────────────────────
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

  // Start only after unlock + intro gate released
  useEffect(() => {
    if (!prefsReady.current || !unlocked) return
    if (!canPlay()) return
    if (!tracksRef.current.length) return
    if (soundRef.current) return

    const idx = resolveIndex(tracksRef.current, trackIdRef.current)
    void playIndex(tracksRef.current, idx, positionRef.current)
  }, [unlocked, tracks, resolveIndex, canPlay, playIndex])

  // ─── App lifecycle ───────────────────────────────────────────────────────
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
      if (!canPlay()) return
      await tryStartOrResume()
    }

    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [persist, refreshCatalog, canPlay, tryStartOrResume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      generationRef.current++ // kill any in-flight work
      void unload()
    }
  }, [unload])

  // ─── Public API ──────────────────────────────────────────────────────────
  const setEnabled = useCallback(
    async (on: boolean) => {
      enabledRef.current = on
      setEnabledState(on)

      const sound = soundRef.current

      if (!on) {
        // Turning OFF → pause and freeze position
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

      // Turning ON
      unlockedRef.current = true
      setUnlocked(true)

      if (!appActiveRef.current || introSilencedRef.current) {
        setState('PAUSED')
        await persist()
        return
      }

      await tryStartOrResume()
      await persist()
    },
    [persist, tryStartOrResume]
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

  /** Call this on opener, preloader, sign-in, sign-out, logout */
  const holdIntroGate = useCallback(() => {
    introSilencedRef.current = true
    generationRef.current++ // cancel any pending play

    const sound = soundRef.current
    if (sound) {
      ;(async () => {
        try {
          const st = await sound.getStatusAsync()
          if (st.isLoaded) {
            positionRef.current = st.positionMillis ?? positionRef.current
            await sound.pauseAsync()
          }
        } catch {}
        if (enabledRef.current) setState('PAUSED')
        await persist()
      })()
    } else {
      if (enabledRef.current) setState('PAUSED')
    }
  }, [persist])

  /** Call this ONLY when user has fully entered the main environment */
  const releaseIntroGate = useCallback(() => {
    introSilencedRef.current = false
    unlockedRef.current = true
    setUnlocked(true)

    if (!enabledRef.current) {
      setState('DISABLED')
      return
    }
    if (!appActiveRef.current) {
      setState('PAUSED')
      return
    }

    // Small delay so everything is settled
    setTimeout(() => {
      void tryStartOrResume()
    }, 120)
  }, [tryStartOrResume])

  /** Hard stop — use on logout */
  const forceStop = useCallback(async () => {
    introSilencedRef.current = true
    generationRef.current++
    await unload()
    if (enabledRef.current) setState('PAUSED')
    else setState('DISABLED')
    await persist()
  }, [unload, persist])

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
    <SoundtrackContext.Provider value={value}>{children}</SoundtrackContext.Provider>
  )
}