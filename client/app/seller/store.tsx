import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import api from '@/constants/api'

type StoreForm = {
  storeName: string
  storeDescription: string
  businessGoal: string
  phone: string
  storeLogo: string
  storeBanner: string
  bankName: string
  accountName: string
  accountNumber: string
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  deliveryMethod: '' | 'courier' | 'self'
  courierCompany: string
}

const emptyForm: StoreForm = {
  storeName: '',
  storeDescription: '',
  businessGoal: '',
  phone: '',
  storeLogo: '',
  storeBanner: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  deliveryMethod: '',
  courierCompany: '',
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <View className="mb-5 rounded-[24px] overflow-hidden border border-[#1A2D42]">
      <LinearGradient colors={['#0E1826', '#0A131F']} className="p-5">
        <View className="flex-row items-center mb-1">
          <View className="w-9 h-9 rounded-xl bg-[#152536] border border-[#243B55] items-center justify-center mr-3">
            <Ionicons name={icon} size={18} color="#9EC5FF" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-[16px] tracking-wide">
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-[#5A7088] text-[11px] mt-0.5 leading-4">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="h-[1px] bg-[#152536] my-4" />
        {children}
      </LinearGradient>
    </View>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string
  value: string
  onChange: (t: string) => void
  placeholder?: string
  multiline?: boolean
  keyboardType?: any
}) {
  return (
    <View className="mb-4">
      <Text className="text-[#7F93A8] text-[11px] mb-1.5 font-semibold tracking-wide uppercase">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#3D5268"
        multiline={multiline}
        keyboardType={keyboardType}
        className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-[#E8F1FF] text-[15px]"
        style={
          multiline
            ? { minHeight: 88, textAlignVertical: 'top' }
            : undefined
        }
      />
    </View>
  )
}

export default function MyStore() {
  const { getToken } = useAuth()
  const [form, setForm] = useState<StoreForm>(emptyForm)
  const [logoUri, setLogoUri] = useState<string | null>(null)
  const [bannerUri, setBannerUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const setField = <K extends keyof StoreForm>(key: K, value: StoreForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const load = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/seller/store', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const d = res.data.data
        setForm({
          storeName: d.storeName || '',
          storeDescription: d.storeDescription || '',
          businessGoal: d.businessGoal || '',
          phone: d.phone || '',
          storeLogo: d.storeLogo || '',
          storeBanner: d.storeBanner || '',
          bankName: d.payout?.bankName || '',
          accountName: d.payout?.accountName || '',
          accountNumber: d.payout?.accountNumber || '',
          street: d.shippingDefaults?.address?.street || '',
          city: d.shippingDefaults?.address?.city || '',
          state: d.shippingDefaults?.address?.state || '',
          zipCode: d.shippingDefaults?.address?.zipCode || '',
          country: d.shippingDefaults?.address?.country || '',
          deliveryMethod: d.shippingDefaults?.deliveryMethod || '',
          courierCompany: d.shippingDefaults?.courierCompany || '',
        })
        setLogoUri(null)
        setBannerUri(null)
      }
    } catch (e: any) {
      console.log(e.response?.data || e.message)
      Alert.alert('Error', 'Could not load store settings')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      load()
    }, [])
  )

  const pickImage = async (kind: 'logo' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: kind === 'logo' ? [1, 1] : [16, 9],
    })
    if (!result.canceled && result.assets[0]) {
      if (kind === 'logo') setLogoUri(result.assets[0].uri)
      else setBannerUri(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!form.storeName.trim()) {
      Alert.alert('Required', 'Business / store name is required')
      return
    }

    try {
      setSaving(true)
      const token = await getToken()
      const formData = new FormData()

      formData.append('storeName', form.storeName.trim())
      formData.append('storeDescription', form.storeDescription.trim())
      formData.append('businessGoal', form.businessGoal.trim())
      formData.append('phone', form.phone.trim())

      formData.append(
        'payout',
        JSON.stringify({
          bankName: form.bankName.trim(),
          accountName: form.accountName.trim(),
          accountNumber: form.accountNumber.trim(),
        })
      )

      formData.append(
        'shippingDefaults',
        JSON.stringify({
          address: {
            street: form.street.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            zipCode: form.zipCode.trim(),
            country: form.country.trim(),
          },
          deliveryMethod: form.deliveryMethod,
          courierCompany: form.courierCompany.trim(),
        })
      )

      if (logoUri) {
        const filename = logoUri.split('/').pop() || 'logo.jpg'
        const match = /\.(\w+)$/.exec(filename)
        formData.append('storeLogo', {
          uri: logoUri,
          name: filename,
          type: match ? `image/${match[1]}` : 'image/jpeg',
        } as any)
      }

      if (bannerUri) {
        const filename = bannerUri.split('/').pop() || 'banner.jpg'
        const match = /\.(\w+)$/.exec(filename)
        formData.append('storeBanner', {
          uri: bannerUri,
          name: filename,
          type: match ? `image/${match[1]}` : 'image/jpeg',
        } as any)
      }

      const res = await api.put('/seller/store', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data.success) {
        Alert.alert('Saved', 'Your store settings were updated')
        await load()
      }
    } catch (e: any) {
      console.log(e.response?.data || e.message)
      Alert.alert(
        'Error',
        e.response?.data?.message || 'Could not save store settings'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-[#060D18] items-center justify-center">
        <ActivityIndicator size="large" color="#9EC5FF" />
      </View>
    )
  }

  const bannerSource = bannerUri || form.storeBanner
  const logoSource = logoUri || form.storeLogo

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#060D18]"
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 56 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              load()
            }}
            tintColor="#9EC5FF"
          />
        }
      >
        {/* Hero header */}
        <View className="mb-6">
          <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2px] uppercase">
            Seller Lounge
          </Text>
          <Text className="text-white text-[28px] font-extrabold mt-1 tracking-tight">
            My Store
          </Text>
          <Text className="text-[#6B8299] text-[13px] mt-2 leading-5">
            Private management only. Buyers never see edit controls on the public storefront.
          </Text>
        </View>

        {/* ========== APPEARANCE ========== */}
        <SectionCard
          icon="color-palette-outline"
          title="Store Appearance"
          subtitle="Banner, logo, and identity shown to buyers"
        >
          {/* Banner */}
          <Text className="text-[#7F93A8] text-[11px] mb-2 font-semibold tracking-wide uppercase">
            Banner
          </Text>
          <TouchableOpacity
            onPress={() => pickImage('banner')}
            activeOpacity={0.85}
            className="h-40 rounded-2xl overflow-hidden bg-[#0A121C] border border-[#1A2D42] mb-5"
          >
            {bannerSource ? (
              <View className="flex-1 relative">
                <Image
                  source={{ uri: bannerSource }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                <View className="absolute bottom-3 right-3 bg-[#060D18]/80 px-3 py-1.5 rounded-full flex-row items-center">
                  <Ionicons name="camera" size={14} color="#9EC5FF" />
                  <Text className="text-[#9EC5FF] text-[11px] font-semibold ml-1.5">
                    Change
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center">
                <View className="w-12 h-12 rounded-2xl bg-[#152536] items-center justify-center mb-2">
                  <Ionicons name="image-outline" size={22} color="#6B8299" />
                </View>
                <Text className="text-[#6B8299] text-[13px]">Tap to upload banner</Text>
                <Text className="text-[#3D5268] text-[11px] mt-1">16:9 recommended</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Logo */}
          <Text className="text-[#7F93A8] text-[11px] mb-2 font-semibold tracking-wide uppercase">
            Logo
          </Text>
          <TouchableOpacity
            onPress={() => pickImage('logo')}
            activeOpacity={0.85}
            className="w-28 h-28 rounded-[22px] overflow-hidden bg-[#0A121C] border border-[#1A2D42] mb-5 items-center justify-center"
          >
            {logoSource ? (
              <Image
                source={{ uri: logoSource }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color="#6B8299" />
                <Text className="text-[#5A7088] text-[10px] mt-1">Upload</Text>
              </>
            )}
          </TouchableOpacity>

          <Field
            label="Business / Store Name *"
            value={form.storeName}
            onChange={(t) => setField('storeName', t)}
            placeholder="Your store name"
          />
          <Field
            label="Business Description"
            value={form.storeDescription}
            onChange={(t) => setField('storeDescription', t)}
            placeholder="What you sell..."
            multiline
          />
          <Field
            label="Business Goal"
            value={form.businessGoal}
            onChange={(t) => setField('businessGoal', t)}
            placeholder="Where you're headed..."
            multiline
          />
        </SectionCard>

        {/* ========== BUSINESS & PAYOUT ========== */}
        <SectionCard
          icon="business-outline"
          title="Business & Payout"
          subtitle="Contact and bank details from registration"
        >
          <Field
            label="Phone Number"
            value={form.phone}
            onChange={(t) => setField('phone', t)}
            placeholder="080..."
            keyboardType="phone-pad"
          />
          <Field
            label="Bank Name"
            value={form.bankName}
            onChange={(t) => setField('bankName', t)}
            placeholder="e.g. GTBank"
          />
          <Field
            label="Account Name"
            value={form.accountName}
            onChange={(t) => setField('accountName', t)}
            placeholder="Name on the account"
          />
          <Field
            label="Account Number"
            value={form.accountNumber}
            onChange={(t) => setField('accountNumber', t)}
            placeholder="0123456789"
            keyboardType="number-pad"
          />
        </SectionCard>

        

        {/* ========== SHIPPING DEFAULTS ========== */}
        
        <SectionCard
          icon="airplane-outline"
          title="Shipping Defaults"
          subtitle="Applied when creating products — each product can override"
        >
          {/* Inside Shipping Defaults SectionCard, above the fields */}
{!(form.city.trim() && form.country.trim()) && (
  <View className="mb-4 bg-[#2A1F14] border border-[#5C3D1E] rounded-2xl px-4 py-3.5">
    <Text className="text-[#F0C070] font-bold text-[13px]">
      Required before sales
    </Text>
    <Text className="text-[#C4A882] text-[12px] leading-5 mt-1">
      Complete City and Country in Shipping Details so buyers can checkout.
      Products cannot be purchased until this is set.
    </Text>
  </View>
)}
          <Text className="text-[#9EC5FF] text-[12px] font-semibold mb-3 tracking-wide">
            Default address
          </Text>
          
          <Field
            label="Street"
            value={form.street}
            onChange={(t) => setField('street', t)}
            placeholder="Street address"
          />
          <Field
            label="City"
            value={form.city}
            onChange={(t) => setField('city', t)}
          />
          <Field
            label="State"
            value={form.state}
            onChange={(t) => setField('state', t)}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="Zip"
                value={form.zipCode}
                onChange={(t) => setField('zipCode', t)}
              />
            </View>
            <View className="flex-1">
              <Field
                label="Country"
                value={form.country}
                onChange={(t) => setField('country', t)}
              />
            </View>
          </View>

          <Text className="text-[#9EC5FF] text-[12px] font-semibold mb-3 mt-1 tracking-wide">
            Default method
          </Text>
          <View className="flex-row gap-3 mb-4">
            {(['courier', 'self'] as const).map((m) => {
              const active = form.deliveryMethod === m
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setField('deliveryMethod', m)}
                  activeOpacity={0.85}
                  className={`flex-1 py-3.5 rounded-2xl border items-center ${
                    active
                      ? 'bg-[#1A2F4A] border-[#4A7AB5]'
                      : 'bg-[#0A121C] border-[#1A2D42]'
                  }`}
                >
                  <Ionicons
                    name={m === 'self' ? 'walk-outline' : 'car-outline'}
                    size={18}
                    color={active ? '#9EC5FF' : '#5A7088'}
                  />
                  <Text
                    className={`font-semibold text-[13px] mt-1.5 ${
                      active ? 'text-[#B8D4FF]' : 'text-[#6B8299]'
                    }`}
                  >
                    {m === 'self' ? 'Self Delivery' : 'Courier'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {form.deliveryMethod === 'courier' && (
            <Field
              label="Default courier company"
              value={form.courierCompany}
              onChange={(t) => setField('courierCompany', t)}
              placeholder="e.g. DHL, GIG, FedEx"
            />
          )}
        </SectionCard>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.9}
          className="mb-6 overflow-hidden rounded-2xl"
        >
          <LinearGradient
            colors={['#C5DCFF', '#9EC5FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="py-4 items-center flex-row justify-center"
          >
            {saving ? (
              <ActivityIndicator color="#060D18" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#060D18" />
                <Text className="text-[#060D18] font-extrabold text-[15px] ml-2 tracking-wide">
                  Save Store Settings
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Live preview placeholder */}
        <View className="rounded-[24px] border border-dashed border-[#243B55] bg-[#0A121C]/80 p-6 items-center">
          <View className="w-12 h-12 rounded-2xl bg-[#121C2B] items-center justify-center mb-3">
            <Ionicons name="eye-outline" size={22} color="#4A657A" />
          </View>
          <Text className="text-white font-bold text-[15px] tracking-wide">
            Live Store Preview
          </Text>
          <Text className="text-[#5A7088] text-center text-[12px] mt-2 leading-5 px-2">
            Buyer-facing preview of your public storefront will appear here later.
            All editing stays on this page only.
          </Text>
          <View className="mt-4 px-3 py-1 rounded-full bg-[#121C2B] border border-[#1A2D42]">
            <Text className="text-[#4A657A] text-[10px] font-bold tracking-widest uppercase">
              Coming soon
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}