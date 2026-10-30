/**
 * Seller register — hardened
 * - Logo + banner REQUIRED
 * - All store fields required
 * - NG: Paystack bank code + live resolve (no fake/incomplete NUBAN)
 * - Other regions: Stripe Connect pending (no fake NG account)
 * Route: /seller-register
 */

import api from '@/constants/api'
import { REGION_LIST } from '@/constants/regions'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

const GREEN = '#00E575'
const BLUE = '#3B82F6'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.78)'
const MUTED = 'rgba(255,255,255,0.55)'
const DANGER = '#EF4444'

const BG_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80'
const FILL = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 }

/** Official Paystack NUBAN bank codes (NG only). Codes are required for transfers. */
const NGN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '00103', name: 'Globus Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '50211', name: 'Kuda Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
]

type LocalImage = { uri: string; name: string; type: string }

export default function SellerRegister() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [businessGoal, setBusinessGoal] = useState('')
  const [phone, setPhone] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountVerified, setAccountVerified] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [showBanks, setShowBanks] = useState(false)
  const [marketplaceRegion, setMarketplaceRegion] = useState('NG')
  const [showRegions, setShowRegions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const [storeLogo, setStoreLogo] = useState<LocalImage | null>(null)
  const [storeBanner, setStoreBanner] = useState<LocalImage | null>(null)

  const isNigeria = marketplaceRegion === 'NG'
  const selectedBank = NGN_BANKS.find((b) => b.code === bankCode)

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken()
        const res = await api.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data.success && res.data.data?.phone) setPhone(res.data.data.phone)
        if (res.data.success && res.data.data?.marketplaceRegion) {
          setMarketplaceRegion(res.data.data.marketplaceRegion)
        }
      } catch {
        /* offline */
      }
    }
    void load()
  }, [getToken])

  // Reset bank verification when bank/number/region changes
  useEffect(() => {
    setAccountVerified(false)
    setAccountName('')
  }, [bankCode, accountNumber, marketplaceRegion])

  const pickImage = async (kind: 'logo' | 'banner') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload store images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'logo' ? [1, 1] : [16, 9],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const uri = asset.uri
    const name = uri.split('/').pop() || (kind === 'logo' ? 'store-logo.jpg' : 'store-banner.jpg')
    const img: LocalImage = { uri, name, type: asset.mimeType || 'image/jpeg' }
    if (kind === 'logo') setStoreLogo(img)
    else setStoreBanner(img)
  }

  /** Live Paystack resolve via server apply path: pre-check by dry-run style POST is heavy;
   *  we validate format client-side then require server resolve success on submit.
   *  Optional: if API exposes /seller/payout/resolve use it here. */
  const resolveNuban = useCallback(async () => {
    if (!isNigeria) return true
    const num = accountNumber.replace(/\D/g, '')
    if (!bankCode) {
      Alert.alert('Bank required', 'Select your bank from the list (bank codes are required for Paystack).')
      return false
    }
    if (!/^\d{10}$/.test(num)) {
      Alert.alert('Invalid account', 'Nigerian account number must be exactly 10 digits.')
      return false
    }
    try {
      setResolving(true)
      const token = await getToken()
      // Server resolves on apply; optional dedicated endpoint:
      const res = await api.post(
        '/seller/payout/resolve',
        { bankCode, accountNumber: num },
        { headers: { Authorization: `Bearer ${token}` } },
      ).catch(() => null)

      if (res?.data?.success && res.data?.data?.accountName) {
        setAccountName(String(res.data.data.accountName))
        setAccountVerified(true)
        return true
      }
      // Fallback: allow submit — server buildNgnPayout will resolve & reject if fake
      // Mark as "pending server verify" but still require 10 digits + bank
      setAccountVerified(false)
      return true
    } catch (e: any) {
      Alert.alert(
        'Account check failed',
        e?.response?.data?.message ||
          'Could not verify this account with Paystack. Check bank and number.',
      )
      return false
    } finally {
      setResolving(false)
    }
  }, [accountNumber, bankCode, getToken, isNigeria])

  const uploadStoreImages = async (token: string | null) => {
    if (!storeLogo || !storeBanner) {
      throw new Error('Store logo and banner are required')
    }
    const fd = new FormData()
    fd.append('storeLogo', { uri: storeLogo.uri, name: storeLogo.name, type: storeLogo.type } as any)
    fd.append('storeBanner', {
      uri: storeBanner.uri,
      name: storeBanner.name,
      type: storeBanner.type,
    } as any)
    await api.put('/seller/store', fd, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    })
  }

  const handleRegister = async () => {
    // ── Strict required fields ──
    if (!storeLogo) return Alert.alert('Required', 'Upload a store logo (square image).')
    if (!storeBanner) return Alert.alert('Required', 'Upload a store banner (wide image).')
    if (!storeName.trim() || storeName.trim().length < 2)
      return Alert.alert('Required', 'Enter a valid store name (at least 2 characters).')
    if (!storeDescription.trim() || storeDescription.trim().length < 20)
      return Alert.alert('Required', 'Business description must be at least 20 characters.')
    if (!businessGoal.trim() || businessGoal.trim().length < 10)
      return Alert.alert('Required', 'Business goal must be at least 10 characters.')
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10)
      return Alert.alert('Required', 'Enter a valid phone number (at least 10 digits).')
    if (!marketplaceRegion) return Alert.alert('Required', 'Select your marketplace region.')

    if (isNigeria) {
      if (!bankCode || !selectedBank)
        return Alert.alert('Required', 'Select your bank from the official list.')
      if (!/^\d{10}$/.test(accountNumber.replace(/\D/g, '')))
        return Alert.alert('Required', 'Nigerian account number must be exactly 10 digits.')
      // Attempt live resolve first
      const ok = await resolveNuban()
      if (!ok) return
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
          marketplaceRegion,
          bankCode: isNigeria ? bankCode : '',
          bankName: isNigeria ? selectedBank?.name || '' : '',
          accountName: isNigeria ? accountName.trim() : '',
          accountNumber: isNigeria ? accountNumber.replace(/\D/g, '') : '',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.data.success) throw new Error(res.data.message || 'Registration failed')

      // Images MUST succeed — registration incomplete without them
      await uploadStoreImages(token)

      await user?.reload()
      Alert.alert(
        'Store Created',
        isNigeria
          ? 'Account verified where possible. Complete orientation and business location next.'
          : 'Store created. Stripe Connect is required before payouts in this region.',
        [{ text: 'Continue', onPress: () => router.replace('/seller-onboarding' as any) }],
      )
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        'Something went wrong'
      Alert.alert('Registration Failed', msg)
    } finally {
      setLoading(false)
    }
  }

  const selectedRegion = REGION_LIST.find((r) => r.code === marketplaceRegion)
  const fieldStyle = (key: string) => [styles.field, focus === key && styles.fieldFocused]

  return (
    <View style={styles.root}>
      <View style={styles.bgLayer} pointerEvents="none">
        <ImageBackground source={{ uri: BG_IMAGE }} style={styles.bgMedia} resizeMode="cover" />
      </View>
      <LinearGradient
        colors={['rgba(5,8,12,0.72)', 'rgba(9,11,15,0.84)', 'rgba(6,18,16,0.93)', 'rgba(9,11,15,0.97)']}
        locations={[0, 0.25, 0.6, 1]}
        style={FILL}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12} activeOpacity={0.75}>
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
                Every field is required. Logo and banner are mandatory. Nigeria payouts use Paystack
                account resolve — incomplete or fake accounts cannot register.
              </Text>
            </View>

            <Text style={styles.section}>Store identity *</Text>
            <Text style={styles.label}>Store logo *</Text>
            <View style={styles.mediaRow}>
              <TouchableOpacity onPress={() => pickImage('logo')} style={[styles.logoBox, !storeLogo && styles.mediaRequired]} activeOpacity={0.85}>
                {storeLogo ? (
                  <Image source={{ uri: storeLogo.uri }} style={styles.logoImg} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={28} color={MUTED} />
                    <Text style={styles.mediaHint}>Add logo</Text>
                  </>
                )}
              </TouchableOpacity>
              {storeLogo ? (
                <TouchableOpacity onPress={() => setStoreLogo(null)} style={styles.clearBtn}>
                  <Text style={styles.clearText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.hint}>Required | square | storefront cards</Text>

            <Text style={styles.label}>Store banner *</Text>
            <TouchableOpacity onPress={() => pickImage('banner')} style={[styles.bannerBox, !storeBanner && styles.mediaRequired]} activeOpacity={0.85}>
              {storeBanner ? (
                <Image source={{ uri: storeBanner.uri }} style={styles.bannerImg} resizeMode="cover" />
              ) : (
                <View style={styles.bannerEmpty}>
                  <Ionicons name="images-outline" size={28} color={MUTED} />
                  <Text style={styles.mediaHint}>Add store banner</Text>
                </View>
              )}
            </TouchableOpacity>
            {storeBanner ? (
              <TouchableOpacity onPress={() => setStoreBanner(null)} style={[styles.clearBtn, { marginBottom: 12 }]}>
                <Text style={styles.clearText}>Remove banner</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.hint}>Required | wide | store header</Text>

            <Text style={[styles.section, { marginTop: 8 }]}>Store details *</Text>
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
            <Text style={styles.label}>Business description * (min 20 chars)</Text>
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
              <Ionicons name="call-outline" size={18} color={focus === 'phone' ? GREEN : MUTED} style={styles.fieldIcon} />
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
            <Pressable onPress={() => setShowRegions((v) => !v)} style={styles.regionBtn}>
              <Text style={styles.flag}>{selectedRegion?.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.regionName}>{selectedRegion?.name}</Text>
                <Text style={styles.regionMeta}>
                  Currency {selectedRegion?.currency?.symbol} |{' '}
                  {isNigeria ? 'Paystack payouts' : 'Stripe Connect payouts'}
                </Text>
              </View>
              <Ionicons name={showRegions ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
            </Pressable>
            {showRegions ? (
              <View style={styles.regionList}>
                {REGION_LIST.map((r) => {
                  const on = marketplaceRegion === r.code
                  return (
                    <Pressable
                      key={r.code}
                      onPress={() => {
                        setMarketplaceRegion(r.code)
                        setShowRegions(false)
                        setBankCode('')
                        setAccountNumber('')
                        setAccountName('')
                        setAccountVerified(false)
                      }}
                      style={[styles.regionRow, on && styles.regionRowOn]}
                    >
                      <Text style={styles.flag}>{r.flag}</Text>
                      <Text style={styles.regionRowText}>{r.name}</Text>
                      {on ? <Ionicons name="checkmark" size={18} color={GREEN} /> : null}
                    </Pressable>
                  )
                })}
              </View>
            ) : null}

            <Text style={[styles.section, { marginTop: 28 }]}>Payout wallet *</Text>
            <View style={styles.notice}>
              <Ionicons name="shield-checkmark-outline" size={18} color={GREEN} style={{ marginTop: 1 }} />
              <Text style={styles.noticeText}>
                {isNigeria
                  ? 'Nigeria: Paystack must resolve your bank code + 10-digit NUBAN. Fake or incomplete accounts are rejected. Account name is filled by Paystack.'
                  : 'This region uses Stripe Connect for payouts — not a Nigerian account. You can open the store now; earnings stay held until Connect is linked on the payout screen.'}
              </Text>
            </View>

            {isNigeria ? (
              <>
                <Text style={styles.label}>Bank *</Text>
                <Pressable onPress={() => setShowBanks((v) => !v)} style={styles.regionBtn}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.regionName}>{selectedBank?.name || 'Select bank'}</Text>
                  </View>
                  <Ionicons name={showBanks ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
                </Pressable>
                {showBanks ? (
                  <View style={[styles.regionList, { maxHeight: 240 }]}>
                    <ScrollView nestedScrollEnabled>
                      {NGN_BANKS.map((b) => {
                        const on = bankCode === b.code
                        return (
                          <Pressable
                            key={b.code}
                            onPress={() => {
                              setBankCode(b.code)
                              setShowBanks(false)
                            }}
                            style={[styles.regionRow, on && styles.regionRowOn]}
                          >
                            <Text style={styles.regionRowText}>{b.name}</Text>
                            {on ? <Ionicons name="checkmark" size={18} color={GREEN} /> : null}
                          </Pressable>
                        )
                      })}
                    </ScrollView>
                  </View>
                ) : null}
                <Text style={styles.label}>Account number * (10 digits)</Text>
                <View style={fieldStyle('accNum')}>
                  <TextInput
                    style={styles.input}
                    value={accountNumber}
                    onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
                    placeholder="0123456789"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="number-pad"
                    onFocus={() => setFocus('accNum')}
                    onBlur={() => setFocus(null)}
                  />
                </View>
                <Text style={styles.label}>Account name (from Paystack)</Text>
                <View style={[fieldStyle('accName'), { opacity: 0.85 }]}>
                  <TextInput
                    style={styles.input}
                    value={accountName}
                    editable={false}
                    placeholder="Verified automatically on submit"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                  />
                </View>
                {accountVerified ? (
                  <Text style={styles.verified}>Verified with Paystack | {accountName}</Text>
                ) : null}
              </>
            ) : (
              <View style={styles.stripeBox}>
                <Ionicons name="card-outline" size={20} color="#F0C070" />
                <Text style={styles.stripeText}>
                  Stripe Connect will collect your bank details securely after onboarding. No
                  Nigerian account number is stored for {selectedRegion?.name || 'this region'}.
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading || resolving}
              activeOpacity={0.88}
              style={styles.ctaOuter}
            >
              <LinearGradient colors={[GREEN, '#14B8A6', BLUE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                {loading || resolving ? (
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
              By continuing you confirm logo, banner, store details, and payout destination are accurate.
              Incomplete profiles are rejected.
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
  bgLayer: { ...FILL, width: '100%', height: '100%' },
  bgMedia: { ...FILL, width: '100%', height: '100%' },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
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
  headerTitle: { color: TEXT, fontSize: 17, fontWeight: '700' },
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
  title: { color: TEXT, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  lead: { marginTop: 8, color: TEXT_DIM, fontSize: 15, lineHeight: 22 },
  section: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 14, letterSpacing: 0.2 },
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  hint: { color: MUTED, fontSize: 11, marginTop: -8, marginBottom: 14 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  logoBox: {
    width: 96,
    height: 96,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaRequired: { borderColor: 'rgba(239,68,68,0.45)' },
  logoImg: { width: '100%', height: '100%' },
  bannerBox: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mediaHint: { color: MUTED, fontSize: 12, marginTop: 6, fontWeight: '600' },
  clearBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  clearText: { color: GREEN, fontSize: 13, fontWeight: '600' },
  notice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(0,229,117,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,117,0.28)',
    padding: 14,
    marginBottom: 18,
  },
  noticeText: { flex: 1, color: TEXT_DIM, fontSize: 13, lineHeight: 19 },
  stripeBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#2A1F14',
    borderWidth: 1,
    borderColor: '#5C3D1E',
    padding: 14,
    marginBottom: 12,
  },
  stripeText: { flex: 1, color: '#C4A882', fontSize: 13, lineHeight: 19 },
  verified: { color: GREEN, fontSize: 12, fontWeight: '700', marginBottom: 12 },
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
  fieldMulti: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 100 },
  fieldFocused: { borderColor: GREEN, backgroundColor: 'rgba(0,229,117,0.06)' },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, color: TEXT, fontSize: 16, paddingVertical: 0 },
  inputMulti: { minHeight: 76, paddingTop: 0 },
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
  regionRowOn: { backgroundColor: 'rgba(0,229,117,0.1)' },
  regionRowText: { flex: 1, color: TEXT, fontSize: 15 },
  ctaOuter: { marginTop: 12, overflow: 'hidden' },
  cta: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { color: '#041412', fontWeight: '800', fontSize: 16 },
  footer: {
    marginTop: 18,
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
})
