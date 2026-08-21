/**
 * Complete profile — after email verify or Google sign-up
 * Video bg: assets/video-3.mp4 → fallback external image on failure
 * Route: /complete-profile
 */

import api from '@/constants/api'
import { DEFAULT_REGION, REGION_LIST, RegionCode } from '@/constants/regions'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'
import { useRouter } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

const GREEN = '#00E575'
const BLUE = '#3B82F6'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.78)'
const MUTED = 'rgba(255,255,255,0.55)'

/** Fallback if video fails / network / missing asset */
const FALLBACK_BG =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80'

export default function CompleteProfileScreen() {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  const videoRef = useRef<Video>(null)

  const prefillName = useMemo(() => {
    const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    return n || user?.fullName || ''
  }, [user?.firstName, user?.lastName, user?.fullName])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<RegionCode>(DEFAULT_REGION)
  const [loading, setLoading] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [useFallback, setUseFallback] = useState(false)

  useEffect(() => {
    if (prefillName) setName(prefillName)
  }, [prefillName])

  const avatar = user?.imageUrl

  const onVideoStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // error or not loaded
      if ('error' in status && status.error) {
        setUseFallback(true)
      }
    }
  }

  const onSave = async () => {
    const cleanedName = name.trim()
    const cleanedPhone = phone.trim().replace(/\s+/g, '')

    if (!cleanedName) {
      Toast.show({ type: 'error', text1: 'Name required' })
      return
    }
    if (cleanedPhone.length < 7 || !/^[+]?[\d]+$/.test(cleanedPhone)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid phone',
        text2: 'Enter a valid phone number',
      })
      return
    }
    if (!country) {
      Toast.show({ type: 'error', text1: 'Select your country' })
      return
    }

    setLoading(true)
    try {
      try {
        const parts = cleanedName.split(/\s+/)
        await user?.update({
          firstName: parts[0] || cleanedName,
          lastName: parts.slice(1).join(' ') || undefined,
        })
      } catch {
        // optional
      }

      const token = await getToken()
      if (!token) {
        Toast.show({
          type: 'error',
          text1: 'Session expired',
          text2: 'Sign in again',
        })
        router.replace('/(auth)/sign-in')
        return
      }

      await api.patch(
        '/users/me',
        {
          name: cleanedName,
          phone: cleanedPhone,
          marketplaceRegion: country,
          ...(avatar ? { image: avatar } : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      router.replace('/(tabs)')
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not save',
        text2: e?.response?.data?.message ?? 'Try again',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!userLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {/* ── Background: video or fallback image ── */}
      {!useFallback ? (
        <Video
          ref={videoRef}
          source={require('@/assets/video-3.mp4')}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          onPlaybackStatusUpdate={onVideoStatus}
          onError={() => setUseFallback(true)}
        />
      ) : (
        <ImageBackground
          source={{ uri: FALLBACK_BG }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}

      {/* Hero veil — keeps text readable over motion */}
      <LinearGradient
        colors={[
          'rgba(5,8,12,0.72)',
          'rgba(9,11,15,0.82)',
          'rgba(6,18,16,0.92)',
          'rgba(9,11,15,0.96)',
        ]}
        locations={[0, 0.28, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
          >
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={styles.kicker}>Almost there</Text>
              <Text style={styles.title}>Complete your profile</Text>
              <Text style={styles.lead}>
                Name, phone, and country keep orders and the mall accurate.
              </Text>
            </View>

            {/* Avatar strip */}
            <View style={styles.avatarCard}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={26} color={MUTED} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.avatarTitle}>
                  {avatar ? 'Account photo' : 'No photo yet'}
                </Text>
                <Text style={styles.avatarHint}>
                  {avatar
                    ? 'From your sign-in — change later in Profile'
                    : 'You can add one later in Profile'}
                </Text>
              </View>
            </View>

            {/* Name */}
            <Text style={styles.label}>Full name</Text>
            <View style={[styles.field, nameFocused && styles.fieldFocused]}>
              <Ionicons
                name="person-outline"
                size={18}
                color={nameFocused ? GREEN : MUTED}
                style={styles.fieldIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                textContentType="name"
                returnKeyType="next"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>

            {/* Phone */}
            <Text style={styles.label}>Phone</Text>
            <View style={[styles.field, phoneFocused && styles.fieldFocused]}>
              <Ionicons
                name="call-outline"
                size={18}
                color={phoneFocused ? GREEN : MUTED}
                style={styles.fieldIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. 08012345678"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
            </View>

            {/* Country */}
            <Text style={styles.label}>Country / marketplace</Text>
            <Text style={styles.subLabel}>
              Sets your currency and mall region
            </Text>
            <View style={styles.countryGrid}>
              {REGION_LIST.map((r) => {
                const on = country === r.code
                return (
                  <Pressable
                    key={r.code}
                    onPress={() => setCountry(r.code)}
                    style={[styles.countryChip, on && styles.countryChipOn]}
                  >
                    <Text style={styles.flag}>{r.flag}</Text>
                    <Text
                      style={[styles.countryText, on && styles.countryTextOn]}
                      numberOfLines={1}
                    >
                      {r.name}
                    </Text>
                    {on && (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={GREEN}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </Pressable>
                )
              })}
            </View>

            {/* CTA — sharp, matches auth */}
            <TouchableOpacity
              onPress={onSave}
              disabled={loading}
              activeOpacity={0.88}
              style={styles.ctaOuter}
            >
              <LinearGradient
                colors={[GREEN, '#14B8A6', BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {loading ? (
                  <ActivityIndicator color="#041412" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Save & enter Plazore</Text>
                    <Ionicons name="arrow-forward" size={18} color="#041412" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              You can update these later in settings
            </Text>

            <View style={{ height: 80 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#090B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: '#090B0F',
  },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },

  hero: {
    marginBottom: 22,
  },
  kicker: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  lead: {
    marginTop: 8,
    color: TEXT_DIM,
    fontSize: 15,
    lineHeight: 22,
  },

  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
    marginBottom: 26,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  avatarHint: {
    marginTop: 3,
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },

  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  subLabel: {
    color: MUTED,
    fontSize: 12,
    marginTop: -2,
    marginBottom: 10,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 16,
  },
  fieldFocused: {
    borderColor: GREEN,
    backgroundColor: 'rgba(0,229,117,0.06)',
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    paddingVertical: 0,
  },

  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '100%',
  },
  countryChipOn: {
    borderColor: 'rgba(0,229,117,0.5)',
    backgroundColor: 'rgba(0,229,117,0.12)',
  },
  flag: { fontSize: 16, marginRight: 6 },
  countryText: {
    color: TEXT_DIM,
    fontSize: 13,
    fontWeight: '600',
  },
  countryTextOn: { color: TEXT },

  ctaOuter: {
    marginTop: 28,
    overflow: 'hidden',
  },
  cta: {
    height: 56,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 16,
  },
  footerNote: {
    marginTop: 16,
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
  },
})