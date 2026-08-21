/**
 * Seller register — video-4.mp4 bg + robust play + image fallback
 * Route: /seller-register
 */

import api from '@/constants/api'
import { REGION_LIST } from '@/constants/regions'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

const GREEN = '#00E575'
const BLUE = '#3B82F6'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.78)'
const MUTED = 'rgba(255,255,255,0.55)'

const FALLBACK_BG =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80'

const VIDEO_SOURCE = require('@/assets/video-4.mp4')

export default function SellerRegister() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const videoRef = useRef<Video>(null)

  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [businessGoal, setBusinessGoal] = useState('')
  const [phone, setPhone] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [marketplaceRegion, setMarketplaceRegion] = useState('NG')
  const [showRegions, setShowRegions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken()
        const res = await api.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data.success && res.data.data?.phone) {
          setPhone(res.data.data.phone)
        }
        if (res.data.success && res.data.data?.marketplaceRegion) {
          setMarketplaceRegion(res.data.data.marketplaceRegion)
        }
      } catch (e) {
        console.log(e)
      }
    }
    load()
  }, [getToken])

  /** Force play when loaded — Android often ignores shouldPlay alone */
  const onVideoStatus = useCallback(async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ('error' in status && status.error) {
        setUseFallback(true)
      }
      return
    }
    try {
      if (!status.isPlaying) {
        await videoRef.current?.playAsync()
      }
    } catch {
      setUseFallback(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Small delay so the native view is mounted
        await new Promise((r) => setTimeout(r, 120))
        if (cancelled) return
        await videoRef.current?.playAsync()
      } catch {
        if (!cancelled) setUseFallback(true)
      }
    })()
    return () => {
      cancelled = true
      videoRef.current?.stopAsync().catch(() => {})
    }
  }, [])

  const handleRegister = async () => {
    if (!storeName.trim()) {
      Alert.alert('Required', 'Please enter your store name')
      return
    }
    if (!storeDescription.trim()) {
      Alert.alert('Required', 'Please enter a business description')
      return
    }
    if (!businessGoal.trim()) {
      Alert.alert('Required', 'Please enter your business goal')
      return
    }
    if (!phone.trim() || phone.trim().length < 7) {
      Alert.alert('Required', 'Please enter a valid phone number')
      return
    }
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      Alert.alert('Required', 'Please fill in all payout / bank details')
      return
    }
    if (!marketplaceRegion) {
      Alert.alert('Required', 'Please select your marketplace region')
      return
    }

    try {
      setLoading(true)
      const token = await getToken()

      const res = await api.post(
        '/seller/apply',
        {
          storeName: storeName.trim(),
          storeDescription: storeDescription.trim(),
          businessGoal: businessGoal.trim(),
          phone: phone.trim().replace(/\s+/g, ''),
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          marketplaceRegion,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data.success) {
        await user?.reload()
        Alert.alert(
          'Store Created',
          'Your seller account is now active. Welcome to the Plazore Seller Lounge.',
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace('/seller' as any),
            },
          ]
        )
      }
    } catch (error: any) {
      console.log('Full error:', error.response?.data || error.message)
      Alert.alert(
        'Registration Failed',
        error.response?.data?.message ||
          error.message ||
          'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  const selectedRegion = REGION_LIST.find((r) => r.code === marketplaceRegion)

  const fieldStyle = (key: string) => [
    styles.field,
    focus === key && styles.fieldFocused,
  ]

  return (
    <View style={styles.root}>
      {/* Background media */}
      <View style={styles.bgLayer} pointerEvents="none">
        {!useFallback ? (
          <Video
            ref={videoRef}
            source={VIDEO_SOURCE}
            style={styles.bgMedia}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted
            volume={0}
            useNativeControls={false}
            onPlaybackStatusUpdate={onVideoStatus}
            onError={() => setUseFallback(true)}
          />
        ) : (
          <ImageBackground
            source={{ uri: FALLBACK_BG }}
            style={styles.bgMedia}
            resizeMode="cover"
          />
        )}
      </View>

      <LinearGradient
        colors={[
          'rgba(5,8,12,0.72)',
          'rgba(9,11,15,0.84)',
          'rgba(6,18,16,0.93)',
          'rgba(9,11,15,0.97)',
        ]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={12}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={22} color={TEXT} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Become a Seller</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
          >
            <View style={styles.hero}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="storefront-outline" size={28} color={GREEN} />
              </View>
              <Text style={styles.kicker}>Seller lounge</Text>
              <Text style={styles.title}>Open your store</Text>
              <Text style={styles.lead}>
                Create your seller profile. You receive access to the Lounge
                after registration is complete.
              </Text>
            </View>

            <Text style={styles.section}>Store</Text>

            <Text style={styles.label}>Business / store name *</Text>
            <View style={fieldStyle('storeName')}>
              <TextInput
                style={styles.input}
                value={storeName}
                onChangeText={setStoreName}
                placeholder="e.g. Midnight Atelier"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="words"
                onFocus={() => setFocus('storeName')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <Text style={styles.label}>Business description *</Text>
            <View style={[fieldStyle('desc'), styles.fieldMulti]}>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={storeDescription}
                onChangeText={setStoreDescription}
                placeholder="Tell buyers what you sell..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={() => setFocus('desc')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <Text style={styles.label}>Business goal *</Text>
            <View style={[fieldStyle('goal'), styles.fieldMulti]}>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={businessGoal}
                onChangeText={setBusinessGoal}
                placeholder="e.g. Reach 100 monthly orders"
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                textAlignVertical="top"
                onFocus={() => setFocus('goal')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <Text style={styles.label}>Phone number *</Text>
            <View style={fieldStyle('phone')}>
              <Ionicons
                name="call-outline"
                size={18}
                color={focus === 'phone' ? GREEN : MUTED}
                style={styles.fieldIcon}
              />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 08012345678"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="phone-pad"
                onFocus={() => setFocus('phone')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <Text style={styles.label}>Marketplace region *</Text>
            <Pressable
              onPress={() => setShowRegions((v) => !v)}
              style={styles.regionBtn}
            >
              <Text style={styles.flag}>{selectedRegion?.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.regionName}>{selectedRegion?.name}</Text>
                <Text style={styles.regionMeta}>
                  Currency {selectedRegion?.currency?.symbol}
                </Text>
              </View>
              <Ionicons
                name={showRegions ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={MUTED}
              />
            </Pressable>

            {showRegions && (
              <View style={styles.regionList}>
                {REGION_LIST.map((r) => {
                  const on = marketplaceRegion === r.code
                  return (
                    <Pressable
                      key={r.code}
                      onPress={() => {
                        setMarketplaceRegion(r.code)
                        setShowRegions(false)
                      }}
                      style={[styles.regionRow, on && styles.regionRowOn]}
                    >
                      <Text style={styles.flag}>{r.flag}</Text>
                      <Text style={styles.regionRowText}>{r.name}</Text>
                      {on && (
                        <Ionicons name="checkmark" size={18} color={GREEN} />
                      )}
                    </Pressable>
                  )
                })}
              </View>
            )}

            {/* Payout */}
            <Text style={[styles.section, { marginTop: 28 }]}>
              Payout / bank details
            </Text>

            <View style={styles.notice}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={GREEN}
                style={{ marginTop: 1 }}
              />
              <Text style={styles.noticeText}>
                Please ensure this bank account is valid and belongs to you.
                Once Plazore reviews and approves your application, this account
                becomes the default payout destination for sales on Plazore.
                Changing payout details later will require verification using
                the last four digits of the account number filled in.
              </Text>
            </View>

            <Text style={styles.label}>Bank name *</Text>
            <View style={fieldStyle('bank')}>
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. GTBank"
                placeholderTextColor="rgba(255,255,255,0.35)"
                onFocus={() => setFocus('bank')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <Text style={styles.label}>Account name *</Text>
            <View style={fieldStyle('accName')}>
              <TextInput
                style={styles.input}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Name on the account"
                placeholderTextColor="rgba(255,255,255,0.35)"
                onFocus={() => setFocus('accName')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <Text style={styles.label}>Account number *</Text>
            <View style={fieldStyle('accNum')}>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="0123456789"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="number-pad"
                onFocus={() => setFocus('accNum')}
                onBlur={() => setFocus(null)}
              />
            </View>

            <TouchableOpacity
              onPress={handleRegister}
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
                    <Text style={styles.ctaText}>Launch my store</Text>
                    <Ionicons name="arrow-forward" size={18} color="#041412" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footer}>
              By continuing, your store and payout information are saved to your
              Plazore account. You can manage details later from Seller Lounge,
              subject to verification.
            </Text>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090B0F' },
  safe: { flex: 1 },

  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  bgMedia: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '700',
  },

  hero: { marginBottom: 28 },
  heroIconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,229,117,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,117,0.35)',
    marginBottom: 16,
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

  section: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  notice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(0,229,117,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,117,0.28)',
    padding: 14,
    marginBottom: 18,
  },
  noticeText: {
    flex: 1,
    color: TEXT_DIM,
    fontSize: 13,
    lineHeight: 19,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    minHeight: 54,
    marginBottom: 16,
  },
  fieldMulti: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    minHeight: 100,
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
  inputMulti: {
    minHeight: 76,
    paddingTop: 0,
  },

  regionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  flag: { fontSize: 22, marginRight: 12 },
  regionName: { color: TEXT, fontSize: 16, fontWeight: '600' },
  regionMeta: { color: MUTED, fontSize: 12, marginTop: 2 },
  regionList: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  regionRowOn: {
    backgroundColor: 'rgba(0,229,117,0.1)',
  },
  regionRowText: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
  },

  ctaOuter: {
    marginTop: 12,
    overflow: 'hidden',
  },
  cta: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 16,
  },
  footer: {
    marginTop: 18,
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
})