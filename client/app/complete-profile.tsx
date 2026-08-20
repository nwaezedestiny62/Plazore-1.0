/**
 * Complete profile — after email verify or Google/Apple
 * Writes only: name, phone, marketplaceRegion, image (if empty on server)
 * Route: /complete-profile
 */

import api from '@/constants/api'
import { DEFAULT_REGION, REGION_LIST, RegionCode } from '@/constants/regions'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

export default function CompleteProfileScreen() {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()

  const prefillName = useMemo(() => {
    const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    return n || user?.fullName || ''
  }, [user?.firstName, user?.lastName, user?.fullName])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<RegionCode>(DEFAULT_REGION)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (prefillName) setName(prefillName)
  }, [prefillName])

  const avatar = user?.imageUrl

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
        // Clerk name update optional — continue
      }

      const token = await getToken()
      if (!token) {
        Toast.show({ type: 'error', text1: 'Session expired', text2: 'Sign in again' })
        router.replace('/(auth)/sign-in')
        return
      }

      // Merge-only payload — matches User model fields
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

      // Real routes only — never invent paths
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>Plazore</Text>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.lead}>
            Name, phone, and country keep orders and the mall accurate. Photo
            comes from your sign-in account when available.
          </Text>

          <View style={styles.avatarCard}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={28} color={MUTED} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.avatarTitle}>
                {avatar ? 'Account photo' : 'No photo yet'}
              </Text>
              <Text style={styles.avatarHint}>
                {avatar
                  ? 'From Google or Apple — change later in Profile'
                  : 'You can add one later in Profile'}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#3D5268"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 08012345678"
            placeholderTextColor="#3D5268"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            returnKeyType="done"
          />

          <Text style={styles.label}>Country / marketplace</Text>
          <Text style={styles.subLabel}>
            Sets your currency and mall region
          </Text>
          <View style={styles.countryGrid}>
            {REGION_LIST.map((r) => {
              const on = country === r.code
              return (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => setCountry(r.code)}
                  activeOpacity={0.85}
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
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            onPress={onSave}
            disabled={loading}
            activeOpacity={0.9}
            style={styles.ctaWrap}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: { flex: 1, backgroundColor: BG },
  scroll: { padding: 24, paddingBottom: 48 },

  kicker: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  lead: {
    marginTop: 8,
    marginBottom: 22,
    color: SECONDARY,
    fontSize: 14,
    lineHeight: 21,
  },

  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE_2,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
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
    marginTop: -4,
    marginBottom: 10,
  },
  input: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 16,
    marginBottom: 16,
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
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    maxWidth: '100%',
  },
  countryChipOn: {
    borderColor: 'rgba(0,229,117,0.45)',
    backgroundColor: 'rgba(0,229,117,0.1)',
  },
  flag: { fontSize: 16, marginRight: 6 },
  countryText: {
    color: SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  countryTextOn: { color: TEXT },

  ctaWrap: {
    marginTop: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cta: {
    paddingVertical: 16,
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