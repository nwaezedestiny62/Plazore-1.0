import api from '@/constants/api'
import { getRegion, REGION_LIST } from '@/constants/regions'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
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
const BG = '#090B0F'
const CARD = '#11151C'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.55)'
const TEXT_MUTED = 'rgba(255,255,255,0.38)'

function OrbLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={GREEN} size="large" />
      <Text style={styles.loaderLabel}>Loading identity…</Text>
    </View>
  )
}

export default function SellerIdentityScreen() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const { user: clerkUser } = useUser()
  const { region: appRegion, setRegionLocal } = useMarketplace()
  const router = useRouter()

  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  const clerkName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    clerkUser?.fullName ||
    ''

  const [name, setName] = useState(clerkName)
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState(appRegion || 'NG')
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showRegions, setShowRegions] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)

  const regionTouched = useRef(false)
  const loadedOnce = useRef(false)

  useEffect(() => {
    if (!isLoaded || loadedOnce.current) return
    if (!isSignedIn) {
      setLoading(false)
      return
    }
    loadedOnce.current = true

    ;(async () => {
      try {
        const token = await getTokenRef.current()
        if (!token) {
          setLoading(false)
          return
        }

        const [meRes, storeRes] = await Promise.all([
          api.get('/users/me', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api
            .get('/seller/store', {
              headers: { Authorization: `Bearer ${token}` },
            })
            .catch(() => null),
        ])

        if (meRes.data?.success) {
          const u = meRes.data.data
          setName(u.name || clerkName || '')
          setPhone(u.phone || '')
          if (!regionTouched.current) {
            setRegion(u.marketplaceRegion || appRegion || 'NG')
          }
        }

        if (storeRes?.data?.success && storeRes.data.data?.storeName) {
          setStoreName(String(storeRes.data.data.storeName))
        }
      } catch {
        if (clerkName) setName(clerkName)
      } finally {
        setLoading(false)
      }
    })()
  }, [isLoaded, isSignedIn, clerkName, appRegion])

  const handleSelectRegion = (code: string) => {
    regionTouched.current = true
    setRegion(code)
    setShowRegions(false)
  }

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      Toast.show({
        type: 'error',
        text1: 'Name is required',
        text2: 'Enter the name used on your seller account',
      })
      return
    }
    if (saving) return
    setSaving(true)
    try {
      const token = await getTokenRef.current()
      if (!token) {
        Toast.show({
          type: 'error',
          text1: 'Not signed in',
          text2: 'Sign out and sign in again',
        })
        return
      }

      // Identity only — never payout / shipping
      const res = await api.patch(
        '/users/me',
        {
          name: trimmedName,
          phone: phone.trim(),
          marketplaceRegion: region,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Save failed')
      }

      const savedRegion = res.data.data?.marketplaceRegion || region
      setRegion(savedRegion)
      setRegionLocal?.(savedRegion)
      regionTouched.current = false

      try {
        const parts = trimmedName.split(' ')
        await clerkUser?.update({
          firstName: parts[0],
          lastName: parts.slice(1).join(' ') || undefined,
        })
      } catch {
        /* optional Clerk sync */
      }

      const chosen = getRegion(savedRegion)
      Toast.show({
        type: 'success',
        text1: 'Identity updated',
        text2: `Marketplace: ${chosen.name} (${chosen.currency.symbol})`,
      })
      router.back()
    } catch (e: any) {
      const status = e?.response?.status
      if (status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Session expired',
          text2: 'Please sign out and sign in again',
        })
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to save',
          text2:
            e?.response?.data?.message ||
            e?.message ||
            'Check your connection and try again',
        })
      }
    } finally {
      setSaving(false)
    }
  }, [name, phone, region, saving, setRegionLocal, clerkUser, router])

  if (!isLoaded || loading) return <OrbLoader />

  const currentRegion = getRegion(region)
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress || '—'

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity card */}
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View style={styles.avatarRing}>
              {clerkUser?.imageUrl ? (
                <Image
                  source={{ uri: clerkUser.imageUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={32} color={TEXT_MUTED} />
                </View>
              )}
            </View>
            <View style={styles.identityMeta}>
              <View style={styles.sellerBadge}>
                <Text style={styles.sellerBadgeText}>SELLER</Text>
              </View>
              <Text style={styles.identityName} numberOfLines={1}>
                {name.trim() || 'Your name'}
              </Text>
              <Text style={styles.identityEmail} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
          <Text style={styles.identityHint}>
            Photo is managed by your sign-in provider. Name and phone are for
            account & order contact — not your public store brand.
          </Text>
        </View>

        {/* Storefront teaser */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/seller/store' as any)}
          style={styles.storeLink}
        >
          <View style={styles.storeIcon}>
            <Ionicons name="storefront-outline" size={18} color={GREEN} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.storeKicker}>Public storefront</Text>
            <Text style={styles.storeName} numberOfLines={1}>
              {storeName || 'Set up store name & branding'}
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color={TEXT_MUTED} />
        </TouchableOpacity>

        {/* Full name */}
        <Text style={styles.label}>Full name</Text>
        <View style={[styles.field, nameFocused && styles.fieldFocused]}>
          <Ionicons
            name="person-outline"
            size={18}
            color={nameFocused ? GREEN : TEXT_MUTED}
            style={styles.fieldIcon}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={TEXT_MUTED}
            style={styles.input}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Email readonly */}
        <Text style={styles.label}>Email</Text>
        <View style={[styles.field, styles.fieldReadonly]}>
          <Ionicons
            name="mail-outline"
            size={18}
            color={TEXT_MUTED}
            style={styles.fieldIcon}
          />
          <Text style={styles.readonlyText} numberOfLines={1}>
            {email}
          </Text>
        </View>

        {/* Phone */}
        <Text style={styles.label}>Phone</Text>
        <View style={[styles.field, phoneFocused && styles.fieldFocused]}>
          <Ionicons
            name="call-outline"
            size={18}
            color={phoneFocused ? GREEN : TEXT_MUTED}
            style={styles.fieldIcon}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 08012345678"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="phone-pad"
            style={styles.input}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
          />
        </View>

        {/* Region */}
        <Text style={styles.label}>Seller marketplace region</Text>
        <Text style={styles.helper}>
          Catalog currency for your products & dashboard. Buyers still shop in
          their own region.
        </Text>

        <Pressable
          onPress={() => setShowRegions((v) => !v)}
          style={({ pressed }) => [
            styles.regionBtn,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.regionFlag}>{currentRegion.flag}</Text>
          <View style={styles.regionInfo}>
            <Text style={styles.regionName}>{currentRegion.name}</Text>
            <Text style={styles.regionCurrency}>
              {currentRegion.currency.symbol} ({currentRegion.currency.code})
            </Text>
          </View>
          <Ionicons
            name={showRegions ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={TEXT_DIM}
          />
        </Pressable>

        {showRegions && (
          <View style={styles.regionList}>
            {REGION_LIST.map((r, index) => {
              const selected = region === r.code
              return (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => handleSelectRegion(r.code)}
                  activeOpacity={0.75}
                  style={[
                    styles.regionItem,
                    selected && styles.regionItemSelected,
                    index < REGION_LIST.length - 1 && styles.regionItemBorder,
                  ]}
                >
                  <Text style={styles.regionItemFlag}>{r.flag}</Text>
                  <View style={styles.regionItemInfo}>
                    <Text style={styles.regionItemName}>{r.name}</Text>
                    <Text style={styles.regionItemCurrency}>
                      {r.currency.symbol} · {r.currency.code}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={GREEN} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push('/seller/settings/region' as any)}
          style={styles.deepLink}
          activeOpacity={0.8}
        >
          <Text style={styles.deepLinkText}>Open full region settings</Text>
          <Ionicons name="chevron-forward" size={14} color={GREEN} />
        </TouchableOpacity>

        {/* Out of scope notice */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Bank payout and shipping defaults are under{' '}
            <Text
              style={styles.noteLink}
              onPress={() => router.push('/seller/settings/payout' as any)}
            >
              Payout & shipping
            </Text>
            — not on this screen.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
          style={styles.saveOuter}
        >
          <LinearGradient
            colors={[GREEN, '#14B8A6', BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            <Text style={styles.saveText}>
              {saving ? 'Saving…' : 'Save identity'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 36 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  loader: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderLabel: {
    marginTop: 12,
    color: TEXT_MUTED,
    fontSize: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 11,
    color: TEXT_MUTED,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },

  identityCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 14,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(0,229,117,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,229,117,0.06)',
  },
  avatar: { width: 62, height: 62, borderRadius: 31 },
  avatarPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityMeta: { flex: 1, minWidth: 0 },
  sellerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,229,117,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  sellerBadgeText: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  identityName: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
  },
  identityEmail: {
    marginTop: 2,
    color: TEXT_MUTED,
    fontSize: 12,
  },
  identityHint: {
    marginTop: 12,
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17,
  },

  storeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 22,
  },
  storeIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storeName: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },

  label: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  helper: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    marginTop: -2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 56,
    marginBottom: 18,
  },
  fieldFocused: {
    borderColor: GREEN,
    backgroundColor: 'rgba(0,229,117,0.05)',
  },
  fieldReadonly: { opacity: 0.75 },
  fieldIcon: { marginRight: 12 },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    paddingVertical: 0,
  },
  readonlyText: {
    flex: 1,
    color: TEXT_DIM,
    fontSize: 16,
  },

  regionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  regionFlag: { fontSize: 26, marginRight: 14 },
  regionInfo: { flex: 1 },
  regionName: { color: TEXT, fontSize: 16, fontWeight: '600' },
  regionCurrency: { color: TEXT_DIM, fontSize: 13, marginTop: 2 },

  regionList: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  regionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  regionItemSelected: {
    backgroundColor: 'rgba(0,229,117,0.08)',
  },
  regionItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  regionItemFlag: { fontSize: 22, marginRight: 12 },
  regionItemInfo: { flex: 1 },
  regionItemName: { color: TEXT, fontSize: 15, fontWeight: '500' },
  regionItemCurrency: { color: TEXT_DIM, fontSize: 12, marginTop: 1 },

  deepLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  deepLinkText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '600',
  },

  noteBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  noteText: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
  noteLink: {
    color: TEXT_DIM,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  saveOuter: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#041412',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
})