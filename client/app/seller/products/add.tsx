import React, { useMemo, useState } from 'react'
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
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import api from '@/constants/api'
import { useMarketplace } from "@/context/MarketplaceContext";
import { getRegion } from "@/constants/regions";
import {
  CATEGORY_LIST,
  PRODUCT_CATEGORIES,
  PLAN_IMAGE_LIMITS,
  PLAN_FEES,
} from '@/constants/productCatalog'

const CURRENT_PLAN: keyof typeof PLAN_IMAGE_LIMITS = 'free'

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <View className="mb-5 rounded-[24px] overflow-hidden border border-[#1A2D42]">
      <LinearGradient colors={['#0E1826', '#0A131F']} className="p-5">
        <View className="flex-row items-center mb-1">
          <View className="w-8 h-8 rounded-lg bg-[#152536] border border-[#243B55] items-center justify-center mr-3">
            <Text className="text-[#9EC5FF] text-[12px] font-bold">{step}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-[16px]">{title}</Text>
            {subtitle ? (
              <Text className="text-[#5A7088] text-[11px] mt-0.5">{subtitle}</Text>
            ) : null}
          </View>
        </View>
        <View className="h-[1px] bg-[#152536] my-4" />
        {children}
      </LinearGradient>
    </View>
  )
}

function Label({ children }: { children: string }) {
  return (
    <Text className="text-[#7F93A8] text-[11px] mb-1.5 font-semibold tracking-wide uppercase">
      {children}
    </Text>
  )
}

export default function AddProduct() {
  const { getToken } = useAuth()
  const router = useRouter()

  const maxImages = PLAN_IMAGE_LIMITS[CURRENT_PLAN]
  const feePct = PLAN_FEES[CURRENT_PLAN]

  const [images, setImages] = useState<string[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [stock, setStock] = useState('')
  const [shippingMethod, setShippingMethod] = useState<'self' | 'courier' | null>(
    null
  )
  const [courierCompany, setCourierCompany] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [loading, setLoading] = useState(false)

  // inside the component:
const { region, currencySymbol } = useMarketplace()
const regionInfo = getRegion(region)

  const subCategories = useMemo(
    () => (category ? PRODUCT_CATEGORIES[category] || ['Other'] : []),
    [category]
  )

  const pickImages = async () => {
    const remaining = maxImages - images.length
    if (remaining <= 0) {
      Alert.alert('Limit reached', `Your plan allows up to ${maxImages} images.`)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    })
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri)
      setImages((prev) => [...prev, ...uris].slice(0, maxImages))
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const moveImage = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= images.length) return
    setImages((prev) => {
      const copy = [...prev]
      const tmp = copy[index]
      copy[index] = copy[next]
      copy[next] = tmp
      return copy
    })
  }

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim() || !price || !stock) {
      Alert.alert('Missing fields', 'Please complete product information')
      return
    }
    if (!category || !subCategory) {
      Alert.alert('Category', 'Select a category and subcategory')
      return
    }
    if (images.length === 0) {
      Alert.alert('Images', 'Add at least one product image')
      return
    }
    if (!shippingMethod) {
      Alert.alert('Shipping', 'Choose Self Delivery or Courier Delivery')
      return
    }
    if (shippingMethod === 'courier' && !courierCompany.trim()) {
      Alert.alert('Courier', 'Enter the courier company name')
      return
    }
 // Sanitize: allow "1,500.50" or "1500" or "0"
const cleanedFee = String(deliveryFee).replace(/,/g, '').trim()
const feeNum = Number(cleanedFee)

if (
  cleanedFee === '' ||
  Number.isNaN(feeNum) ||
  feeNum < 0
) {
  Alert.alert('Delivery fee', 'Enter a valid delivery fee (0 is allowed)')
  return
}

    try {
      setLoading(true)
      const token = await getToken()
      const formData = new FormData()

      formData.append('name', name.trim())
      formData.append('description', description.trim())
      formData.append('price', price)
      formData.append('stock', stock)
      formData.append('category', category)
      formData.append('subCategory', subCategory)
      formData.append('brand', brand.trim())
      formData.append('shippingMethod', shippingMethod)
      formData.append('courierCompany', courierCompany.trim())
      formData.append('deliveryFee', String(feeNum))

      images.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `image-${index}.jpg`
        const match = /\.(\w+)$/.exec(filename)
        formData.append('images', {
          uri,
          name: filename,
          type: match ? `image/${match[1]}` : 'image/jpeg',
        } as any)
      })

      const res = await api.post('/seller/products', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data.success) {
        Alert.alert('Published', 'Product is live in your store', [
          { text: 'OK', onPress: () => router.back() },
        ])
      }
    } catch (error: any) {
      console.log(error.response?.data || error.message)
      Alert.alert('Error', error.response?.data?.message || 'Failed to publish')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#060D18]"
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-4 self-start p-1"
        >
          <Ionicons name="arrow-back" size={24} color="#9EC5FF" />
        </TouchableOpacity>

        <Text className="text-[#5A7088] text-[11px] font-semibold tracking-[2px] uppercase">
          Catalog
        </Text>
        <Text className="text-white text-[26px] font-extrabold mt-1 mb-6">
          New Product
        </Text>

        {/* 01 Images */}
        <Section
          step="01"
          title="Product Images"
          subtitle={`${images.length} / ${maxImages} images · ${CURRENT_PLAN} plan`}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((uri, index) => (
              <View key={`${uri}-${index}`} className="mr-3">
                <Image source={{ uri }} className="w-28 h-28 rounded-2xl" />
                <View className="flex-row justify-center mt-2 gap-2">
                  <TouchableOpacity
                    onPress={() => moveImage(index, -1)}
                    className="w-8 h-8 rounded-full bg-[#152536] items-center justify-center"
                  >
                    <Ionicons name="chevron-back" size={16} color="#9EC5FF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    className="w-8 h-8 rounded-full bg-[#3A1F28] items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={14} color="#FF8A9A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveImage(index, 1)}
                    className="w-8 h-8 rounded-full bg-[#152536] items-center justify-center"
                  >
                    <Ionicons name="chevron-forward" size={16} color="#9EC5FF" />
                  </TouchableOpacity>
                </View>
                {index === 0 && (
                  <Text className="text-[#5A7088] text-[10px] text-center mt-1">
                    Cover
                  </Text>
                )}
              </View>
            ))}
            {images.length < maxImages && (
              <TouchableOpacity
                onPress={pickImages}
                className="w-28 h-28 rounded-2xl border border-dashed border-[#2A4560] bg-[#0A121C] items-center justify-center"
              >
                <Ionicons name="add" size={28} color="#6B8299" />
                <Text className="text-[#6B8299] text-[11px] mt-1">Add</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Section>

        {/* 02 Info */}
        <Section step="02" title="Product Information">
          <Label>Product name *</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Clear, buyer-friendly title"
            placeholderTextColor="#3D5268"
            className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-4"
          />

         <Text className="text-[#AFC3D6] text-sm mb-2">
  Price ({currencySymbol}) *
</Text>
<TextInput
  value={price}
  onChangeText={setPrice}
  placeholder="0.00"
  keyboardType="decimal-pad"
  placeholderTextColor="#3D5268"
  className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-1"
/>
<Text className="text-[#5A7088] text-[11px] mb-4">
  Enter amount in {regionInfo.name} ({regionInfo.currency.code})
</Text>

          <Label>Description *</Label>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Materials, fit, what’s included…"
            multiline
            placeholderTextColor="#3D5268"
            className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-4 min-h-[100]"
            style={{ textAlignVertical: 'top' }}
          />

          <Label>Category *</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            {CATEGORY_LIST.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setCategory(cat)
                  setSubCategory('')
                }}
                className={`mr-2 px-3.5 py-2 rounded-full border ${
                  category === cat
                    ? 'bg-[#1A2F4A] border-[#4A7AB5]'
                    : 'bg-[#0A121C] border-[#1A2D42]'
                }`}
              >
                <Text
                  className={`text-[12px] font-medium ${
                    category === cat ? 'text-[#B8D4FF]' : 'text-[#6B8299]'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {!!category && (
            <>
              <Label>Subcategory *</Label>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {subCategories.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSubCategory(sub)}
                    className={`px-3.5 py-2 rounded-full border ${
                      subCategory === sub
                        ? 'bg-[#1A2F4A] border-[#4A7AB5]'
                        : 'bg-[#0A121C] border-[#1A2D42]'
                    }`}
                  >
                    <Text
                      className={`text-[12px] ${
                        subCategory === sub ? 'text-[#B8D4FF]' : 'text-[#6B8299]'
                      }`}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Label>Brand (optional)</Label>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="Brand name"
            placeholderTextColor="#3D5268"
            className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-4"
          />

          <Label>Stock quantity *</Label>
          <TextInput
            value={stock}
            onChangeText={setStock}
            placeholder="0"
            keyboardType="number-pad"
            placeholderTextColor="#3D5268"
            className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white"
          />
        </Section>

        {/* 03 Shipping */}
        <Section step="03" title="Shipping Details">
          <View className="bg-[#122033] border border-[#1E334A] rounded-2xl p-4 mb-5 flex-row">
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#9EC5FF"
            />
            <Text className="text-[#AFC3D6] text-[12px] leading-5 flex-1 ml-2">
              Review shipping carefully before publishing. Buyers see this method
              and fee throughout checkout and order tracking. You will not choose
              the method again when shipping an order.
            </Text>
          </View>

          <View className="flex-row gap-3 mb-4">
            {(['self', 'courier'] as const).map((m) => {
              const active = shippingMethod === m
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setShippingMethod(m)}
                  className={`flex-1 py-4 rounded-2xl border items-center ${
                    active
                      ? 'bg-[#1A2F4A] border-[#4A7AB5]'
                      : 'bg-[#0A121C] border-[#1A2D42]'
                  }`}
                >
                  <Ionicons
                    name={m === 'self' ? 'walk-outline' : 'car-outline'}
                    size={20}
                    color={active ? '#9EC5FF' : '#5A7088'}
                  />
                  <Text
                    className={`font-semibold text-[13px] mt-2 ${
                      active ? 'text-[#B8D4FF]' : 'text-[#6B8299]'
                    }`}
                  >
                    {m === 'self' ? 'Self Delivery' : 'Courier'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {shippingMethod === 'courier' && (
            <>
              <Label>Courier company *</Label>
              <TextInput
                value={courierCompany}
                onChangeText={setCourierCompany}
                placeholder="e.g. DHL, GIG, FedEx"
                placeholderTextColor="#3D5268"
                className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white mb-4"
              />
            </>
          )}

          {!!shippingMethod && (
            <>
<TextInput
  value={deliveryFee}
  onChangeText={(t) => {
    // keep only digits and one decimal point
    const next = t.replace(/[^0-9.]/g, '')
    setDeliveryFee(next)
  }}
  placeholder="0.00"
  keyboardType="decimal-pad"
  placeholderTextColor="#3D5268"
  className="bg-[#0A121C] border border-[#1A2D42] rounded-2xl px-4 py-3.5 text-white"
/>
            </>
          )}
        </Section>

        {/* 04 Publish */}
        <Section step="04" title="Publish">
          <View className="flex-row justify-between mb-2">
            <Text className="text-[#6B8299] text-[13px]">Current plan</Text>
            <Text className="text-white font-semibold capitalize">
              {CURRENT_PLAN}
            </Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-[#6B8299] text-[13px]">Transaction fee</Text>
            <Text className="text-white font-semibold">
              {feePct}% of product price
            </Text>
          </View>
          <Text className="text-[#5A7088] text-[11px] leading-4 mb-4">
            Transaction fee applies only to the product price — never to the
            delivery fee.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/seller/subscription' as any)}
          >
            <Text className="text-[#9EC5FF] text-[13px] font-medium underline">
              Want lower transaction fees and better showroom visibility?
            </Text>
          </TouchableOpacity>
        </Section>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.9}
          className="mb-6 overflow-hidden rounded-2xl"
        >
          <LinearGradient
            colors={['#C5DCFF', '#9EC5FF']}
            className="py-4 items-center flex-row justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#060D18" />
            ) : (
              <>
                <Ionicons name="rocket-outline" size={18} color="#060D18" />
                <Text className="text-[#060D18] font-extrabold text-[15px] ml-2">
                  Publish Product
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View className="rounded-[24px] border border-dashed border-[#243B55] bg-[#0A121C]/80 p-6 items-center">
          <Ionicons name="eye-outline" size={22} color="#4A657A" />
          <Text className="text-white font-bold mt-3">Live Product Preview</Text>
          <Text className="text-[#5A7088] text-center text-[12px] mt-2 leading-5">
            Buyer-facing preview before publish will appear here later. AI and
            Buyer Confidence stay out of this preview.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}