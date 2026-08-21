import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
})

/** Bucket name must match Supabase Storage (yours is singular: soundtrack) */
const BUCKET = 'soundtrack'

export function soundtrackPublicUrl(storagePath: string): string {
  if (!storagePath) return ''
  if (storagePath.startsWith('http')) return storagePath
  const path = storagePath.replace(/^soundtrack\//, '')
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}