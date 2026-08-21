import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase, soundtrackPublicUrl } from '@/lib/supabase'

export type SoundtrackTrack = {
  id: string
  title: string
  audio_url: string
  track_order: number
  is_active: boolean
}

const CACHE_KEY = '@plazore/soundtrack_catalog_v1'
const CACHE_TTL_MS = 15 * 60 * 1000

type CacheBlob = { at: number; tracks: SoundtrackTrack[] }

export async function fetchActiveSoundtracks(
  force = false
): Promise<SoundtrackTrack[]> {
  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CacheBlob
        if (Date.now() - parsed.at < CACHE_TTL_MS && parsed.tracks?.length) {
          return parsed.tracks
        }
      }
    } catch {}
  }

  const { data, error } = await supabase
    .from('plazore_soundtracks')
    .select('id, title, storage_path, audio_url, track_order, is_active')
    .eq('is_active', true)
    .order('track_order', { ascending: true })

  if (error) {
    console.warn('[soundtrack] fetch error', error.message)
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY)
      if (raw) return (JSON.parse(raw) as CacheBlob).tracks ?? []
    } catch {}
    return []
  }

  const tracks: SoundtrackTrack[] = (data ?? [])
    .map((row: any) => {
      const url =
        (row.audio_url && String(row.audio_url).trim()) ||
        soundtrackPublicUrl(row.storage_path || '')
      return {
        id: String(row.id),
        title: String(row.title || 'Track'),
        track_order: Number(row.track_order) || 0,
        is_active: !!row.is_active,
        audio_url: url,
      }
    })
    .filter((t) => !!t.audio_url)

  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), tracks } satisfies CacheBlob)
    )
  } catch {}

  return tracks
}