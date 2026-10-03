/**
 * Complete profile — required once before the mall.
 * All fields required. Background = mall warming up.
 * After save, never shown again (AsyncStorage + server).
 */
import api from '@/constants/api'
import {
  DEFAULT_REGION,
  REGION_LIST,
  type RegionCode,
} from '@/constants/regions'
import { useMarketplace } from '@/context/MarketplaceContext'
import { markProfileComplete } from '@/components/AuthGate'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { Image as ExpoImage } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
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

const BG = '#090B0F'
const SURFACE = 'rgba(17,20,26,0.92)'
const LINE = 'rgba(255,255,255,0.1)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = 'rgba(255,255,255,0.45)'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const GRAD = [GREEN, '#14B8A6', BLUE] as const

const WARM_BG =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80'

const DIAL: Record<
  string,
  { dial: string; min: number; max: number; example: string }
> = {
  NG: { dial: '+234', min: 10, max: 10, example: '801 234 5678' },
  GH: { dial: '+233', min: 9, max: 9, example: '24 123 4567' },
  BJ: { dial: '+229', min: 8, max: 10, example: '90 12 34 56' },
  CM: { dial: '+237', min: 9, max: 9, example: '6 12 34 56 78' },
  KE: { dial: '+254', min: 9, max: 9, example: '712 345 678' },
  ZA: { dial: '+27', min: 9, max: 9, example: '82 123 4567' },
  EG: { dial: '+20', min: 10, max: 10, example: '100 123 4567' },
  US: { dial: '+1', min: 10, max: 10, example: '202 555 0147' },
  CA: { dial: '+1', min: 10, max: 10, example: '416 555 0199' },
  GB: { dial: '+44', min: 10, max: 10, example: '7400 123456' },
  DE: { dial: '+49', min: 10, max: 11, example: '1512 3456789' },
  FR: { dial: '+33', min: 9, max: 9, example: '6 12 34 56 78' },
  AU: { dial: '+61', min: 9, max: 9, example: '412 345 678' },
}

function digitsOnly(s: string) {
  return s.replace(/\D/g, '')
}

function normalizeNational(raw: string): string {
  let d = digitsOnly(raw)
  if (d.startsWith('0') && d.length > 1) d = d.slice(1)
  return d
}

function isValidNational(raw: string, region: string): boolean {
  const meta = DIAL[region] || DIAL.NG
  const d = normalizeNational(raw)
  return d.length >= meta.min && d.length <= meta.max
}

function toE164(raw: string, region: string): string {
  const meta = DIAL[region] || DIAL.NG
  return `${meta.dial}${normalizeNational(raw)}`
}

export default function CompleteProfileScreen() {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken, isSignedIn } = useAuth()
  const { setRegionLocal } = useMarketplace()
  const router = useRouter()
  const gatedRef = useRef(false)

  const pulse = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  const prefillName = useMemo(() => {
    const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    return n || user?.fullName || ''
  }, [user?.firstName, user?.lastName, user?.fullName])

  const [name, setName] = useState('')
  const [phoneLocal, setPhoneLocal] = useState('')
  const [country, setCountry] = useState<RegionCode | ''>('')
  const [countryOpen, setCountryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [nameFocused, setNameFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (prefillName) setName((prev) => prev || prefillName)
  }, [prefillName])

  const dialMeta = country ? DIAL[country] || DIAL.NG : null
  const regionCfg = country
    ? REGION_LIST.find((r) => r.code === country)
    : null

  const formReady =
    !!country &&
    name.trim().length > 1 &&
    !!dialMeta &&
    isValidNational(phoneLocal, country)

  const enterMall = useCallback(
    (region?: string) => {
      if (region) {
        try {
          setRegionLocal(String(region))
        } catch {
          /* ignore */
        }
      }
      router.replace('/(tabs)' as any)
    },
    [setRegionLocal, router],
  )

  useEffect(() => {
    if (!userLoaded || gatedRef.current) return
    gatedRef.current = true

    ;(async () => {
      try {
        if (!isSignedIn) {
          setChecking(false)
          return
        }
        const token = await getToken()
        if (!token) {
          setChecking(false)
          return
        }
        const res = await api.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const u = res.data?.data
        const hasName = !!(u?.name && String(u.name).trim())
        const hasPhone = !!(u?.phone && String(u.phone).trim())

        if (hasName && hasPhone) {
          await markProfileComplete({
            name: String(u.name).trim(),
            phone: String(u.phone).trim(),
            region: String(u.marketplaceRegion || DEFAULT_REGION),
          })
          enterMall(u.marketplaceRegion)
          return
        }

        if (hasName) setName(String(u.name).trim())
        if (u?.marketplaceRegion) setCountry(u.marketplaceRegion as RegionCode)
        if (hasPhone && u?.marketplaceRegion) {
          const ph = String(u.phone).trim()
          const meta = DIAL[u.marketplaceRegion] || DIAL.NG
          if (ph.startsWith(meta.dial)) setPhoneLocal(ph.slice(meta.dial.length))
        }
      } catch {
        /* stay */
      } finally {
        setChecking(false)
      }
    })()
  }, [userLoaded, isSignedIn, getToken, enterMall])

  const avatar = user?.imageUrl

  const onSave = async () => {
    if (!formReady || !country || !dialMeta) {
      setFormError('Fill country, phone, and name to continue')
      return
    }

    const cleanedName = name.trim()
    const e164 = toE164(phoneLocal, country)
    setFormError(null)
    setLoading(true)

    try {
      try {
        const parts = cleanedName.split(/\s+/)
        await user?.update({
          firstName: parts[0] || cleanedName,
          lastName: parts.slice(1).join(' ') || undefined,
        })
      } catch {
        /* optional */
      }

      const token = await getToken()
      if (!token) {
        setFormError('Session expired — sign in again')
        setLoading(false)
        return
      }

      await api.patch(
        '/users/me',
        {
          name: cleanedName,
          phone: e164,
          marketplaceRegion: country,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      await markProfileComplete({
        name: cleanedName,
        phone: e164,
        region: country,
      })

      try {
        setRegionLocal(country)
      } catch {
        /* ignore */
      }

      Toast.show({ type: 'success', text1: 'Welcome to Plazore' })
      enterMall(country)
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || 'Could not save profile'
      setFormError(msg)
      Toast.show({ type: 'error', text1: 'Could not save', text2: msg })
    } finally {
      setLoading(false)
    }
  }

  if (!userLoaded || checking) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#FFF" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {/* Mall warming up */}
      <ExpoImage
        source={{ uri: WARM_BG }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
      />
      <View style={styles.veil} />
      <LinearGradient
        colors={['rgba(9,11,15,0.55)', 'rgba(9,11,15,0.88)', '#090B0F']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={[styles.warmBanner, { opacity: pulse }]}>
          <View style={styles.warmDot} />
          <Text style={styles.warmText}>Warming up the mall…</Text>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Text style={styles.kicker}>One last step</Text>
              <Text style={styles.title}>Finish your profile</Text>
              <Text style={styles.lead}>
                Country, phone, and name are required before you enter Plazore.
                This only happens once.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.avatarRow}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="person" size={22} color={MUTED} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.avatarTitle}>Your account</Text>
                  <Text style={styles.avatarHint}>
                    {user?.primaryEmailAddress?.emailAddress || 'Signed in'}
                  </Text>
                </View>
              </View>

              {formError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Country *</Text>
              <Pressable
                onPress={() => setCountryOpen(true)}
                style={[styles.field, !country && styles.fieldEmpty]}
              >
                <Text style={styles.flag}>{regionCfg?.flag || '🌍'}</Text>
                <Text
                  style={[styles.fieldText, !country && styles.placeholder]}
                  numberOfLines={1}
                >
                  {regionCfg?.name || 'Select country first'}
                </Text>
                {dialMeta ? (
                  <Text style={styles.dialChip}>{dialMeta.dial}</Text>
                ) : null}
                <Ionicons name="chevron-down" size={18} color={MUTED} />
              </Pressable>

              <Text style={styles.label}>Phone *</Text>
              <View
                style={[
                  styles.field,
                  phoneFocused && styles.fieldFocused,
                  !country && styles.fieldDisabled,
                ]}
              >
                <Text style={[styles.dialPrefix, !country && styles.placeholder]}>
                  {dialMeta?.dial || '+—'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    country ? dialMeta?.example || 'Number' : 'Select country first'
                  }
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  keyboardType="phone-pad"
                  editable={!!country}
                  value={phoneLocal}
                  onChangeText={(t) => {
                    setPhoneLocal(t)
                    setFormError(null)
                  }}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  maxLength={18}
                />
              </View>
              {country && dialMeta ? (
                <Text style={styles.hint}>
                  Local number only · we add {dialMeta.dial}
                </Text>
              ) : (
                <Text style={styles.hint}>Pick a country to unlock phone entry</Text>
              )}

              <Text style={styles.label}>Full name *</Text>
              <View style={[styles.field, nameFocused && styles.fieldFocused]}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={nameFocused ? GREEN : MUTED}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  value={name}
                  onChangeText={(t) => {
                    setName(t)
                    setFormError(null)
                  }}
                  autoCapitalize="words"
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                />
              </View>

              <TouchableOpacity
                onPress={onSave}
                disabled={!formReady || loading}
                activeOpacity={0.88}
                style={[styles.ctaOuter, !formReady && styles.ctaDisabled]}
              >
                {formReady ? (
                  <LinearGradient
                    colors={[...GRAD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cta}
                  >
                    {loading ? (
                      <ActivityIndicator color="#041412" />
                    ) : (
                      <Text style={styles.ctaTextReady}>Continue to mall</Text>
                    )}
                  </LinearGradient>
                ) : (
                  <View style={[styles.cta, styles.ctaMuted]}>
                    <Text style={styles.ctaTextMuted}>Fill all fields to continue</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={countryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryOpen(false)}
      >
        <Pressable
          style={styles.modalScrim}
          onPress={() => setCountryOpen(false)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Select country</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {REGION_LIST.map((r) => {
                const on = r.code === country
                const d = DIAL[r.code]?.dial || ''
                return (
                  <Pressable
                    key={r.code}
                    onPress={() => {
                      setCountry(r.code as RegionCode)
                      setPhoneLocal('')
                      setFormError(null)
                      setCountryOpen(false)
                    }}
                    style={[styles.countryRow, on && styles.countryRowOn]}
                  >
                    <Text style={styles.flag}>{r.flag}</Text>
                    <Text
                      style={[
                        styles.countryRowText,
                        on && styles.countryRowTextOn,
                      ]}
                      numberOfLines={1}
                    >
                      {r.name}
                    </Text>
                    <Text style={styles.countryDial}>{d}</Text>
                    {on ? (
                      <Ionicons name="checkmark" size={18} color={GREEN} />
                    ) : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  boot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  safe: { flex: 1 },
  warmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
  },
  warmDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  warmText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
  },
  hero: { marginBottom: 16 },
  kicker: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  lead: {
    color: SECONDARY,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: '#171B22',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  avatarHint: { color: MUTED, fontSize: 12, marginTop: 2 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.35)',
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: '#FCA5A5', fontSize: 13, flex: 1 },
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,11,15,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 10,
  },
  fieldEmpty: { borderColor: 'rgba(255,255,255,0.14)' },
  fieldFocused: { borderColor: 'rgba(0,229,117,0.45)' },
  fieldDisabled: { opacity: 0.55 },
  fieldText: { flex: 1, color: TEXT, fontSize: 15, fontWeight: '700' },
  placeholder: { color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  flag: { fontSize: 22 },
  dialChip: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '800',
  },
  dialPrefix: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 48,
  },
  hint: {
    color: MUTED,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  ctaOuter: { marginTop: 22 },
  ctaDisabled: { opacity: 1 },
  cta: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaMuted: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  ctaTextReady: {
    color: '#041412',
    fontSize: 15,
    fontWeight: '800',
  },
  ctaTextMuted: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#11141A',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  countryRowOn: { backgroundColor: 'rgba(0,229,117,0.06)' },
  countryRowText: {
    flex: 1,
    color: SECONDARY,
    fontSize: 15,
    fontWeight: '600',
  },
  countryRowTextOn: { color: TEXT, fontWeight: '800' },
  countryDial: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
})
