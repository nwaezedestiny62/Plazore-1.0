/**
 * AuthGate — blocks the mall until Clerk session exists and profile is complete.
 * Unsigned → /(auth)/sign-in
 * Signed, incomplete → /complete-profile
 * Signed, complete → app (bounce out of auth screens)
 */
import { useAuth } from '@clerk/clerk-expo'
import api from '@/constants/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter, useSegments, useRootNavigationState } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

const BG = '#090B0F'
const COMPLETE_KEY = '@plazore/profile_complete_v1'

async function hasLocalComplete(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return parsed?.complete === true
  } catch {
    return false
  }
}

async function serverProfileComplete(
  getToken: () => Promise<string | null>,
): Promise<boolean> {
  try {
    const token = await getToken()
    if (!token) return false
    const res = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const u = res.data?.data
    return !!(
      u?.name &&
      String(u.name).trim() &&
      u?.phone &&
      String(u.phone).trim()
    )
  } catch {
    return false
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const navState = useRootNavigationState()
  const [ready, setReady] = useState(false)
  const [profileOk, setProfileOk] = useState(false)
  const checkingRef = useRef(false)

  // Resolve profile completeness when signed in
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setProfileOk(false)
      setReady(true)
      return
    }

    let cancelled = false
    ;(async () => {
      if (checkingRef.current) return
      checkingRef.current = true
      try {
        const local = await hasLocalComplete()
        if (local) {
          if (!cancelled) {
            setProfileOk(true)
            setReady(true)
          }
          return
        }
        const server = await serverProfileComplete(getToken)
        if (!cancelled) {
          setProfileOk(server)
          setReady(true)
        }
      } finally {
        checkingRef.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, getToken])

  // Re-read local complete flag when routes change (after complete-profile saves)
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let cancelled = false
    ;(async () => {
      const local = await hasLocalComplete()
      if (!cancelled && local) setProfileOk(true)
    })()
    return () => {
      cancelled = true
    }
  }, [segments, isLoaded, isSignedIn])

  // Route enforcement
  useEffect(() => {
    if (!isLoaded || !ready || !navState?.key) return

    const root = String(segments[0] || '')
    const inAuth = root === '(auth)'
    const inComplete = root === 'complete-profile'

    if (!isSignedIn) {
      if (!inAuth) {
        router.replace('/(auth)/sign-in' as any)
      }
      return
    }

    // Signed in
    if (!profileOk) {
      if (!inComplete) {
        router.replace('/complete-profile' as any)
      }
      return
    }

    // Signed in + profile ok — leave auth / complete screens
    if (inAuth || inComplete) {
      router.replace('/(tabs)' as any)
    }
  }, [
    isLoaded,
    ready,
    isSignedIn,
    profileOk,
    segments,
    navState?.key,
    router,
  ])

  // Cold start: hold a dark frame until we know where to send them
  if (!isLoaded || !ready || !navState?.key) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    )
  }

  return <>{children}</>
}

/** Call after complete-profile saves so AuthGate can re-read */
export async function markProfileComplete(data: {
  name: string
  phone: string
  region: string
}) {
  try {
    await AsyncStorage.setItem(
      COMPLETE_KEY,
      JSON.stringify({
        complete: true,
        name: data.name,
        phone: data.phone,
        region: data.region,
        at: Date.now(),
      }),
    )
  } catch {
    /* ignore */
  }
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
