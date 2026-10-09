/**
 * Seller register — NG uses Paystack bank code. Other regions wait for Stripe Connect.
 * Route: /seller-register
 */

import api from '@/constants/api'
import { REGION_LIST } from '@/constants/regions'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
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

const BG_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80'

const FILL = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 }

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

  const uploadStoreImages = async (token: string | null) => {
    if (!storeLogo && !storeBanner) return
    const fd = new FormData()
    if (storeLogo) {
      fd.append('storeLogo', { uri: storeLogo.uri, name: storeLogo.name, type: storeLogo.type } as any)
    }
    if (storeBanner) {
      fd.append('storeBanner', { uri: storeBanner.uri, name: storeBanner.name, type: storeBanner.type } as any)
    }
    await api.put('/seller/store', fd, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    })
  }

  const handleRegister = async () => {
    if (!storeName.trim()) return Alert.alert('Required', 'Please enter your store name')
    if (!storeDescription.trim()) return Alert.alert('Required', 'Please enter a business description')
    if (!businessGoal.trim()) return Alert.alert('Required', 'Please enter your business goal')
    if (!phone.trim() || phone.trim().length < 7) return Alert.alert('Required', 'Please enter a valid phone number')
    if (!marketplaceRegion) return Alert.alert('Required', 'Please select your marketplace region')
    if (isNigeria) {
      if (!bankCode) return Alert.alert('Required', 'Select your bank')
      if (!/^\d{10}$/.test(accountNumber.replace(/\D/g, ''))) {
        return Alert.alert('Required', 'Nigerian account number must be 10 digits')
      }
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
      try {
        await uploadStoreImages(token)
      } catch (imgErr: any) {
        console.warn('Store images upload:', imgErr?.message)
      }
      await user?.reload()
      Alert.alert(
        'Store Created',
        'Your seller account is active. Next, complete a short orientation and set your business location.',
        [{ text: 'Continue', onPress: () => router.replace('/seller-onboarding' as any) }],
      )
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.message || error.message || 'Something went wrong')
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={22} color={TEXT} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Become a Seller</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces>
            <View style={styles.hero}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="storefront-outline" size={28} color={GREEN} />
              </View>
              <Text style={styles.kicker}>Seller lounge</Text>
              <Text style={styles.title}>Open your store</Text>
              <Text style={styles.lead}>Create your seller profile with logo and banner. Access the Lounge after registration is complete.</Text>
            </View>

            <Text style={styles.section}>Store identity</Text>
            <Text style={styles.label}>Store logo</Text>
            <View style={styles.mediaRow}>
              <TouchableOpacity onPress={() => pickImage('logo')} style={styles.logoBox} activeOpacity={0.85}>
                {storeLogo ? <Image source={{ uri: storeLogo.uri }} style={styles.logoImg} /> : (
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
            <Text style={styles.hint}>Square image · shown on storefront cards</Text>

            <Text style={styles.label}>Store banner (backdrop)</Text>
            <TouchableOpacity onPress={() => pickImage('banner')} style={styles.bannerBox} activeOpacity={0.85}>
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
            <Text style={styles.hint}>Wide image · header backdrop on your store</Text>

            <Text style={[styles.section, { marginTop: 8 }]}>Store</Text>
            <Text style={styles.label}>Business / store name *</Text>
            <View style={fieldStyle('storeName')}>
              <TextInput style={styles.input} value={storeName} onChangeText={setStoreName} placeholder="e.g. Midnight Atelier" placeholderTextColor="rgba(255,255,255,0.35)" autoCapitalize="words" onFocus={() => setFocus('storeName')} onBlur={() => setFocus(null)} />
            </View>
            <Text style={styles.label}>Business description *</Text>
            <View style={[fieldStyle('desc'), styles.fieldMulti]}>
              <TextInput style={[styles.input, styles.inputMulti]} value={storeDescription} onChangeText={setStoreDescription} placeholder="Tell buyers what you sell..." placeholderTextColor="rgba(255,255,255,0.35)" multiline numberOfLines={4} textAlignVertical="top" onFocus={() => setFocus('desc')} onBlur={() => setFocus(null)} />
            </View>
            <Text style={styles.label}>Business goal *</Text>
            <View style={[fieldStyle('goal'), styles.fieldMulti]}>
              <TextInput style={[styles.input, styles.inputMulti]} value={businessGoal} onChangeText={setBusinessGoal} placeholder="e.g. Reach 100 monthly orders" placeholderTextColor="rgba(255,255,255,0.35)" multiline textAlignVertical="top" onFocus={() => setFocus('goal')} onBlur={() => setFocus(null)} />
            </View>
            <Text style={styles.label}>Phone number *</Text>
            <View style={fieldStyle('phone')}>
              <Ionicons name="call-outline" size={18} color={focus === 'phone' ? GREEN : MUTED} style={styles.fieldIcon} />
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="e.g. 08012345678" placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="phone-pad" onFocus={() => setFocus('phone')} onBlur={() => setFocus(null)} />
            </View>

            <Text style={styles.label}>Marketplace region *</Text>
            <Pressable onPress={() => setShowRegions((v) => !v)} style={styles.regionBtn}>
              <Text style={styles.flag}>{selectedRegion?.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.regionName}>{selectedRegion?.name}</Text>
                <Text style={styles.regionMeta}>Currency {selectedRegion?.currency?.symbol}</Text>
              </View>
              <Ionicons name={showRegions ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
            </Pressable>
            {showRegions ? (
              <View style={styles.regionList}>
                {REGION_LIST.map((r) => {
                  const on = marketplaceRegion === r.code
                  return (
                    <Pressable key={r.code} onPress={() => { setMarketplaceRegion(r.code); setShowRegions(false); setBankCode('') }} style={[styles.regionRow, on && styles.regionRowOn]}>
                      <Text style={styles.flag}>{r.flag}</Text>
                      <Text style={styles.regionRowText}>{r.name}</Text>
                      {on ? <Ionicons name="checkmark" size={18} color={GREEN} /> : null}
                    </Pressable>
                  )
                })}
              </View>
            ) : null}

            <Text style={[styles.section, { marginTop: 28 }]}>Payout</Text>
            <View style={styles.notice}>
              <Ionicons name="shield-checkmark-outline" size={18} color={GREEN} style={{ marginTop: 1 }} />
              <Text style={styles.noticeText}>
                {isNigeria
                  ? 'Nigeria pays through Paystack. Pick the bank and the 10-digit account number. When Paystack keys are on, the account name is checked before it is saved.'
                  : 'This region pays through Stripe Connect, not a Nigerian account number. You can open the store now. Payouts stay held until Connect is linked.'}
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
                          <Pressable key={b.code} onPress={() => { setBankCode(b.code); setShowBanks(false) }} style={[styles.regionRow, on && styles.regionRowOn]}>
                            <Text style={styles.regionRowText}>{b.name}</Text>
                            {on ? <Ionicons name="checkmark" size={18} color={GREEN} /> : null}
                          </Pressable>
                        )
                      })}
                    </ScrollView>
                  </View>
                ) : null}
                <Text style={styles.label}>Account name</Text>
                <View style={fieldStyle('accName')}>
                  <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="Paystack overwrites this when keys are set" placeholderTextColor="rgba(255,255,255,0.35)" onFocus={() => setFocus('accName')} onBlur={() => setFocus(null)} />
                </View>
                <Text style={styles.label}>Account number *</Text>
                <View style={fieldStyle('accNum')}>
                  <TextInput style={styles.input} value={accountNumber} onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))} placeholder="0123456789" placeholderTextColor="rgba(255,255,255,0.35)" keyboardType="number-pad" onFocus={() => setFocus('accNum')} onBlur={() => setFocus(null)} />
                </View>
              </>
            ) : null}

            <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.88} style={styles.ctaOuter}>
              <LinearGradient colors={[GREEN, '#14B8A6', BLUE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                {loading ? <ActivityIndicator color="#041412" /> : (
                  <>
                    <Text style={styles.ctaText}>Launch my store</Text>
                    <Ionicons name="arrow-forward" size={18} color="#041412" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.footer}>
              By continuing, your store, images, and payout information are saved to your Plazore account.
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  headerTitle: { color: TEXT, fontSize: 17, fontWeight: '700' },
  hero: { marginBottom: 28 },
  heroIconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,229,117,0.12)', borderWidth: 1, borderColor: 'rgba(0,229,117,0.35)', marginBottom: 16 },
  kicker: { color: GREEN, fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: TEXT, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  lead: { marginTop: 8, color: TEXT_DIM, fontSize: 15, lineHeight: 22 },
  section: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 14, letterSpacing: 0.2 },
  label: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  hint: { color: MUTED, fontSize: 11, marginTop: -8, marginBottom: 14 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  logoBox: { width: 96, height: 96, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  bannerBox: { width: '100%', height: 120, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 8, overflow: 'hidden' },
  bannerImg: { width: '100%', height: '100%' },
  bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mediaHint: { color: MUTED, fontSize: 12, marginTop: 6, fontWeight: '600' },
  clearBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  clearText: { color: GREEN, fontSize: 13, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(0,229,117,0.08)', borderWidth: 1, borderColor: 'rgba(0,229,117,0.28)', padding: 14, marginBottom: 18 },
  noticeText: { flex: 1, color: TEXT_DIM, fontSize: 13, lineHeight: 19 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, minHeight: 54, marginBottom: 16 },
  fieldMulti: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 100 },
  fieldFocused: { borderColor: GREEN, backgroundColor: 'rgba(0,229,117,0.06)' },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, color: TEXT, fontSize: 16, paddingVertical: 0 },
  inputMulti: { minHeight: 76, paddingTop: 0 },
  regionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, paddingVertical: 14, marginBottom: 12 },
  flag: { fontSize: 22, marginRight: 12 },
  regionName: { color: TEXT, fontSize: 16, fontWeight: '600' },
  regionMeta: { color: MUTED, fontSize: 12, marginTop: 2 },
  regionList: { backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 16, overflow: 'hidden' },
  regionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  regionRowOn: { backgroundColor: 'rgba(0,229,117,0.1)' },
  regionRowText: { flex: 1, color: TEXT, fontSize: 15 },
  ctaOuter: { marginTop: 12, overflow: 'hidden' },
  cta: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { color: '#041412', fontWeight: '800', fontSize: 16 },
  footer: { marginTop: 18, textAlign: 'center', color: MUTED, fontSize: 12, lineHeight: 18, paddingHorizontal: 8 },
})