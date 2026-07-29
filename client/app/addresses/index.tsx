import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import api from '@/constants/api'

const ADDRESS_TYPES = [
  { key: 'Home', icon: 'home-outline' },
  { key: 'Office', icon: 'briefcase-outline' },
  { key: 'Other', icon: 'location-outline' },
] as const

type AddressType = 'Home' | 'Office' | 'Other'

export default function Addresses() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  // form
  const [type, setType] = useState<AddressType>('Home')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [country, setCountry] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const fetchAddresses = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setAddresses(res.data.data)
      }
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchAddresses()
    }, [])
  )

  const resetForm = () => {
    setType('Home')
    setStreet('')
    setCity('')
    setState('')
    setZipCode('')
    setCountry('')
    setIsDefault(false)
  }

  const handleSave = async () => {
    if (
      !street.trim() ||
      !city.trim() ||
      !state.trim() ||
      !zipCode.trim() ||
      !country.trim()
    ) {
      Alert.alert('Missing fields', 'Please fill all address fields')
      return
    }

    try {
      setSaving(true)
      const token = await getToken()

      await api.post(
        '/addresses',
        {
          type,
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          country: country.trim(),
          isDefault,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setModalVisible(false)
      resetForm()
      fetchAddresses()
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to save address'
      )
    } finally {
      setSaving(false)
    }
  }

const handleSetDefault = async (id: string) => {
  try {
    const token = await getToken()
    const res = await api.put(
      `/addresses/${id}/default`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (res.data.success) {
      fetchAddresses()
    }
  } catch (error: any) {
    console.log('Set default error:', error.response?.data || error.message)
    Alert.alert(
      'Error',
      error.response?.data?.message || 'Could not set default address'
    )
  }
}

  const handleDelete = (id: string) => {
    Alert.alert('Delete Address', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken()
            await api.delete(`/addresses/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            fetchAddresses()
          } catch (error) {
            Alert.alert('Error', 'Could not delete address')
          }
        },
      },
    ])
  }

  const getTypeIcon = (t: string) => {
    if (t === 'Home') return 'home'
    if (t === 'Office') return 'briefcase'
    return 'location'
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-[#07111F]">
        <ActivityIndicator size="large" color="#DCEBFF" />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-4 flex-row items-center justify-between border-b border-[#1E334A]">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-xl font-bold">Addresses</Text>
            <Text className="text-[#7F93A8] text-xs mt-0.5">
              Manage your delivery locations
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="bg-[#DCEBFF] w-10 h-10 rounded-full items-center justify-center"
        >
          <Ionicons name="add" size={22} color="#07111F" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchAddresses()
            }}
            tintColor="#DCEBFF"
          />
        }
        ListEmptyComponent={
          <View className="items-center mt-28 px-6">
            <View className="w-20 h-20 rounded-full bg-[#13263B] items-center justify-center mb-4">
              <Ionicons name="location-outline" size={36} color="#5A7088" />
            </View>
            <Text className="text-white text-lg font-semibold mb-1">
              No addresses yet
            </Text>
            <Text className="text-[#7F93A8] text-center text-sm leading-5 mb-6">
              Add a Home, Office or other location so checkout is faster.
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="bg-[#DCEBFF] px-6 py-3.5 rounded-2xl flex-row items-center"
            >
              <Ionicons name="add" size={18} color="#07111F" />
              <Text className="text-[#07111F] font-bold ml-2">Add Address</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSetDefault(item._id)}
            className={`rounded-[24px] p-5 mb-4 border ${
              item.isDefault
                ? 'bg-[#12243A] border-[#DCEBFF]/40'
                : 'bg-[#0B1625] border-[#1E334A]'
            }`}
          >
            <View className="flex-row items-start">
              {/* Type icon */}
              <View
                className={`w-11 h-11 rounded-2xl items-center justify-center mr-3.5 ${
                  item.isDefault ? 'bg-[#DCEBFF]' : 'bg-[#13263B]'
                }`}
              >
                <Ionicons
                  name={getTypeIcon(item.type) as any}
                  size={20}
                  color={item.isDefault ? '#07111F' : '#AFC3D6'}
                />
              </View>

              <View className="flex-1 pr-2">
                <View className="flex-row items-center mb-1.5">
                  <Text className="text-white font-bold text-[15px]">
                    {item.type}
                  </Text>
                  {item.isDefault && (
                    <View className="ml-2 bg-[#1A2F28] px-2 py-0.5 rounded-full flex-row items-center">
                      <Ionicons name="checkmark-circle" size={11} color="#8FE3B0" />
                      <Text className="text-[#8FE3B0] text-[10px] font-semibold ml-1">
                        DEFAULT
                      </Text>
                    </View>
                  )}
                </View>

                <Text className="text-[#AFC3D6] leading-5 text-[14px]">
                  {item.street}
                  {'\n'}
                  {item.city}, {item.state} {item.zipCode}
                  {'\n'}
                  {item.country}
                </Text>

                {!item.isDefault && (
                  <Text className="text-[#5A7088] text-[11px] mt-2">
                    Tap to set as default
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => handleDelete(item._id)}
                className="p-2 -mr-1"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="#FF8A9A" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Add Address Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-[#0B1625] rounded-t-[32px] border-t border-[#1E334A] max-h-[92%]">
            <ScrollView
              contentContainerStyle={{ padding: 24, paddingBottom: 36 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Modal header */}
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-white text-xl font-bold">New Address</Text>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false)
                    resetForm()
                  }}
                  className="w-9 h-9 rounded-full bg-[#13263B] items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="#AFC3D6" />
                </TouchableOpacity>
              </View>

              {/* Type chips */}
              <Text className="text-[#AFC3D6] text-sm mb-2.5">Address Type</Text>
              <View className="flex-row gap-2.5 mb-5">
                {ADDRESS_TYPES.map((t) => {
                  const active = type === t.key
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setType(t.key)}
                      className={`flex-1 py-3 rounded-2xl border items-center ${
                        active
                          ? 'bg-[#DCEBFF] border-[#DCEBFF]'
                          : 'bg-[#13263B] border-[#21374D]'
                      }`}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={18}
                        color={active ? '#07111F' : '#AFC3D6'}
                      />
                      <Text
                        className={`text-xs font-semibold mt-1 ${
                          active ? 'text-[#07111F]' : 'text-[#AFC3D6]'
                        }`}
                      >
                        {t.key}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Street */}
              <Text className="text-[#AFC3D6] text-sm mb-2">Street *</Text>
              <View className="flex-row items-center bg-[#13263B] border border-[#21374D] rounded-2xl px-4 mb-3.5">
                <Ionicons name="map-outline" size={18} color="#5A7088" />
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder="Street address"
                  placeholderTextColor="#5A7088"
                  className="flex-1 py-3.5 px-3 text-white"
                />
              </View>

              {/* City + State */}
              <View className="flex-row gap-3 mb-3.5">
                <View className="flex-1">
                  <Text className="text-[#AFC3D6] text-sm mb-2">City *</Text>
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                    placeholderTextColor="#5A7088"
                    className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[#AFC3D6] text-sm mb-2">State *</Text>
                  <TextInput
                    value={state}
                    onChangeText={setState}
                    placeholder="State"
                    placeholderTextColor="#5A7088"
                    className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white"
                  />
                </View>
              </View>

              {/* Zip + Country */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[#AFC3D6] text-sm mb-2">Zip Code *</Text>
                  <TextInput
                    value={zipCode}
                    onChangeText={setZipCode}
                    placeholder="Zip"
                    placeholderTextColor="#5A7088"
                    className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[#AFC3D6] text-sm mb-2">Country *</Text>
                  <TextInput
                    value={country}
                    onChangeText={setCountry}
                    placeholder="Country"
                    placeholderTextColor="#5A7088"
                    className="bg-[#13263B] border border-[#21374D] rounded-2xl px-4 py-3.5 text-white"
                  />
                </View>
              </View>

              {/* Default toggle */}
              <TouchableOpacity
                onPress={() => setIsDefault(!isDefault)}
                activeOpacity={0.8}
                className="flex-row items-center mb-6 bg-[#13263B] rounded-2xl px-4 py-3.5 border border-[#21374D]"
              >
                <View
                  className={`w-5 h-5 rounded-md border items-center justify-center mr-3 ${
                    isDefault
                      ? 'bg-[#DCEBFF] border-[#DCEBFF]'
                      : 'border-[#5A7088]'
                  }`}
                >
                  {isDefault && (
                    <Ionicons name="checkmark" size={14} color="#07111F" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium text-[14px]">
                    Set as default address
                  </Text>
                  <Text className="text-[#6B8299] text-[11px] mt-0.5">
                    Used automatically at checkout
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Save */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.9}
                className="bg-[#DCEBFF] rounded-2xl py-4 items-center flex-row justify-center"
              >
                {saving ? (
                  <ActivityIndicator color="#07111F" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#07111F" />
                    <Text className="text-[#07111F] font-extrabold text-[15px] ml-2">
                      Save Address
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}