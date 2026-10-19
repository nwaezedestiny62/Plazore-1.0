/**
 * Complete profile — required once before the mall.
 * Country sets marketplace region + currency. Smooth Plazore UI.
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
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

const BG = '#090B0F'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = 'rgba(255,255,255,0.45)'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const TEAL = '#14B8A6'
const GRAD = [GREEN, TEAL, BLUE] as const

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

  const pulse = useRef(new Animated.Value(0.35)).current
  const enter = useRef(new Animated.Value(0)).current
  const cardY = useRef(new Animated.Value(28)).current
  const glow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardY, {
        toValue: 0,
        friction: 9,
        tension: 48,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 900,
        delay: 120,
        useNativeDriver: true,
      }),
    ]).start()
  }, [enter, cardY, glow])

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
        <LinearGradient
          colors={['#090B0F', '#0d1520']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bootOrb} />
        <ActivityIndicator color={GREEN} size="large" />
        <Text style={styles.bootText}>Warming up the mall…</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ExpoImage
        source={{ uri: WARM_BG }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
      />
      <View style={styles.veil} />
      <LinearGradient
        colors={['rgba(9,11,15,0.45)', 'rgba(9,11,15,0.82)', '#090B0F']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.55],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(0,229,117,0.18)', 'transparent', 'rgba(59,130,246,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={[styles.warmBanner, { opacity: pulse }]}>
          <LinearGradient
            colors={[GREEN, TEAL]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.warmDot}
          />
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
            <Animated.View
              style={{
                opacity: enter,
                transform: [
                  {
                    translateY: enter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.hero}>
                <View style={styles.kickerRow}>
                  <LinearGradient
                    colors={[...GRAD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.kickerLine}
                  />
                  <Text style={styles.kicker}>One last step</Text>
                </View>
                <Text style={styles.title}>Finish your profile</Text>
                <Text style={styles.lead}>
                  Country sets your mall region and currency. Phone and name
                  unlock the full Plazore experience — once only.
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              style={{
                opacity: enter,
                transform: [{ translateY: cardY }],
              }}
            >
              <View style={styles.card}>
                <LinearGradient
                  colors={[GREEN, TEAL, BLUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardAccent}
                />

                <View style={styles.avatarRow}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                  ) : (
                    <LinearGradient
                      colors={['rgba(0,229,117,0.2)', 'rgba(59,130,246,0.15)']}
                      style={[styles.avatar, styles.avatarFallback]}
                    >
                      <Ionicons name="person" size={22} color={GREEN} />
                    </LinearGradient>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.avatarTitle}>Your account</Text>
                    <Text style={styles.avatarHint} numberOfLines={1}>
                      {user?.primaryEmailAddress?.emailAddress || 'Signed in'}
                    </Text>
                  </View>
                  <View style={styles.securePill}>
                    <Ionicons name="shield-checkmark" size={12} color={GREEN} />
                    <Text style={styles.secureText}>Secure</Text>
                  </View>
                </View>

                {formError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
                    <Text style={styles.errorText}>{formError}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Country *</Text>
                <Text style={styles.fieldHint}>
                  Sets dial code, currency & mall region
                </Text>
                <Pressable
                  onPress={() => setCountryOpen(true)}
                  style={[
                    styles.field,
                    styles.fieldRounded,
                    !country && styles.fieldEmpty,
                    !!country && styles.fieldFilled,
                  ]}
                >
                  <Text style={styles.flag}>{regionCfg?.flag || '🌍'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.fieldText, !country && styles.placeholder]}
                      numberOfLines={1}
                    >
                      {regionCfg?.name || 'Select country first'}
                    </Text>
                    {regionCfg?.currency ? (
                      <Text style={styles.fieldSub}>
                        {dialMeta?.dial}
                        {' · '}
                        {regionCfg.currency.symbol} {regionCfg.currency.code}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-down" size={18} color={MUTED} />
                </Pressable>

                <Text style={styles.label}>Phone *</Text>
                <View
                  style={[
                    styles.field,
                    styles.fieldRounded,
                    phoneFocused && styles.fieldFocused,
                    !country && styles.fieldDisabled,
                  ]}
                >
                  <Text
                    style={[styles.dialPrefix, !country && styles.placeholder]}
                  >
                    {dialMeta?.dial || '+—'}
                  </Text>
                  <View style={styles.fieldDivider} />
                  <TextInput
                    style={styles.input}
                    placeholder={
                      country
                        ? dialMeta?.example || 'Number'
                        : 'Select country first'
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
                <Text style={styles.hint}>
                  {country && dialMeta
                    ? `Local number only · we add ${dialMeta.dial}`
                    : 'Pick a country to unlock phone entry'}
                </Text>

                <Text style={styles.label}>Full name *</Text>
                <View
                  style={[
                    styles.field,
                    styles.fieldRounded,
                    nameFocused && styles.fieldFocused,
                  ]}
                >
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

                <Pressable
                  onPress={onSave}
                  disabled={!formReady || loading}
                  style={styles.ctaOuter}
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
                        <>
                          <Text style={styles.ctaTextReady}>
                            Continue to mall
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={18}
                            color="#041412"
                          />
                        </>
                      )}
                    </LinearGradient>
                  ) : (
                    <View style={[styles.cta, styles.ctaMuted]}>
                      <Text style={styles.ctaTextMuted}>
                        Fill all fields to continue
                      </Text>
                    </View>
                  )}
                </Pressable>

                <Text style={styles.footerNote}>
                  Required once — you won{"'"}t see this again after you continue.
                </Text>
              </View>
            </Animated.View>
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
            <View style={styles.modalHandle} />
            <LinearGradient
              colors={[GREEN, TEAL, BLUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalAccent}
            />
            <Text style={styles.modalTitle}>Select country</Text>
            <Text style={styles.modalSub}>
              This sets your marketplace currency
            </Text>
            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
            >
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
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.countryRowText,
                          on && styles.countryRowTextOn,
                        ]}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                      <Text style={styles.countryMeta}>
                        {d}
                        {r.currency?.code
                          ? ` · ${r.currency.symbol} ${r.currency.code}`
                          : ''}
                      </Text>
                    </View>
                    {on ? (
                      <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={14} color="#041412" />
                      </View>
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
    gap: 14,
  },
  bootOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,229,117,0.08)',
  },
  bootText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
   fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  ambientGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  warmText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 40,
  },
  hero: { marginBottom: 18 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  kickerLine: {
    width: 28,
    height: 3,
    borderRadius: 2,
  },
  kicker: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  lead: {
    color: SECONDARY,
    fontSize: 14.5,
    lineHeight: 22,
  },
  card: {
    backgroundColor: 'rgba(14,17,23,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    marginTop: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#171B22',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTitle: { color: TEXT, fontSize: 15, fontWeight: '700' },
  avatarHint: { color: MUTED, fontSize: 12, marginTop: 3 },
  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(0,229,117,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.25)',
  },
  secureText: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 12,
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
    marginBottom: 6,
    marginTop: 10,
  },
  fieldHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginBottom: 8,
    marginTop: -2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,11,15,0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    minHeight: 56,
    gap: 10,
  },
  fieldRounded: { borderRadius: 14 },
  fieldEmpty: { borderColor: 'rgba(255,255,255,0.14)' },
  fieldFilled: {
    borderColor: 'rgba(0,229,117,0.22)',
    backgroundColor: 'rgba(0,229,117,0.05)',
  },
  fieldFocused: {
    borderColor: 'rgba(0,229,117,0.5)',
    backgroundColor: 'rgba(0,229,117,0.06)',
  },
  fieldDisabled: { opacity: 0.55 },
  fieldText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  fieldSub: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  placeholder: { color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  flag: { fontSize: 24 },
  dialPrefix: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 48,
  },
  fieldDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  hint: {
    color: MUTED,
    fontSize: 12,
    marginTop: 7,
    marginBottom: 2,
  },
  ctaOuter: { marginTop: 22 },
  cta: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaMuted: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaTextReady: {
    color: '#041412',
    fontSize: 16,
    fontWeight: '800',
  },
  ctaTextMuted: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.32)',
    fontSize: 12,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0E1116',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 16,
    maxHeight: '72%',
    overflow: 'hidden',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  modalAccent: {
    height: 2,
    borderRadius: 1,
    marginBottom: 14,
    opacity: 0.9,
  },
  modalTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    color: MUTED,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  countryRowOn: {
    backgroundColor: 'rgba(0,229,117,0.1)',
    borderBottomColor: 'transparent',
  },
  countryRowText: {
    color: SECONDARY,
    fontSize: 15,
    fontWeight: '600',
  },
  countryRowTextOn: { color: TEXT, fontWeight: '800' },
  countryMeta: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
