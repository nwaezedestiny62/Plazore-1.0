/**
 * Addresses — Plazore style + orb preloader
 */

import api from '@/constants/api'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

const ADDRESS_TYPES = [
  { key: 'Home', icon: 'home-outline' as const },
  { key: 'Office', icon: 'briefcase-outline' as const },
  { key: 'Other', icon: 'location-outline' as const },
] as const

type AddressType = 'Home' | 'Office' | 'Other'

function StorePreloader() {
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.loaderRoot}>
      <View style={styles.orbWrapper}>
        <Animated.View style={[styles.orbRing, { transform: [{ rotate }] }]} />
        <View style={styles.orbLogoWrap}>
          <Image
            source={require('@/assets/logo-1.png')}
            style={styles.orbLogo}
            resizeMode="contain"
          />
        </View>
      </View>
      <Text style={styles.loaderLabel}>Loading addresses…</Text>
    </View>
  )
}

export default function Addresses() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const [type, setType] = useState<AddressType>('Home')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [country, setCountry] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)

  const fetchAddresses = async () => {
    try {
      const token = await getToken()
      const res = await api.get('/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setAddresses(res.data.data || [])
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
    setFocus(null)
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
          } catch {
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
    return <StorePreloader />
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
          <View>
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.headerTitle}>Addresses</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.88}
          style={styles.addHeaderOuter}
        >
          <LinearGradient
            colors={[GREEN, '#14B8A6', BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addHeaderBtn}
          >
            <Ionicons name="add" size={22} color="#041412" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchAddresses()
            }}
            tintColor={GREEN}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={34} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No addresses yet</Text>
            <Text style={styles.emptySub}>
              Add a Home, Office or other location so checkout is faster.
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              activeOpacity={0.88}
              style={styles.emptyCtaOuter}
            >
              <LinearGradient
                colors={[GREEN, '#14B8A6', BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyCta}
              >
                <Ionicons name="add" size={18} color="#041412" />
                <Text style={styles.emptyCtaText}>Add Address</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSetDefault(item._id)}
            style={[
              styles.cardItem,
              item.isDefault && styles.cardItemDefault,
            ]}
          >
            <View style={styles.cardRow}>
              <View
                style={[
                  styles.typeIcon,
                  item.isDefault && styles.typeIconDefault,
                ]}
              >
                <Ionicons
                  name={getTypeIcon(item.type) as any}
                  size={18}
                  color={item.isDefault ? BG : SECONDARY}
                />
              </View>

              <View style={styles.cardInfo}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardType}>{item.type}</Text>
                  {item.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={11}
                        color={GREEN}
                      />
                      <Text style={styles.defaultText}>DEFAULT</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardAddress}>
                  {item.street}
                  {'\n'}
                  {item.city}, {item.state} {item.zipCode}
                  {'\n'}
                  {item.country}
                </Text>

                {!item.isDefault && (
                  <Text style={styles.tapHint}>Tap to set as default</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => handleDelete(item._id)}
                style={styles.deleteBtn}
                hitSlop={10}
              >
                <Ionicons name="trash-outline" size={18} color={DANGER} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalKicker}>Delivery</Text>
                  <Text style={styles.modalTitle}>New Address</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false)
                    resetForm()
                  }}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={18} color={SECONDARY} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Address type</Text>
              <View style={styles.typeRow}>
                {ADDRESS_TYPES.map((t) => {
                  const active = type === t.key
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setType(t.key)}
                      activeOpacity={0.85}
                      style={[
                        styles.typeChip,
                        active && styles.typeChipActive,
                      ]}
                    >
                      <Ionicons
                        name={t.icon}
                        size={16}
                        color={active ? BG : SECONDARY}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          active && styles.typeChipTextActive,
                        ]}
                      >
                        {t.key}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={styles.label}>Street *</Text>
              <View
                style={[
                  styles.field,
                  focus === 'street' && styles.fieldFocused,
                ]}
              >
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder="Street address"
                  placeholderTextColor={MUTED}
                  style={styles.input}
                  onFocus={() => setFocus('street')}
                  onBlur={() => setFocus(null)}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>City *</Text>
                  <View
                    style={[
                      styles.field,
                      focus === 'city' && styles.fieldFocused,
                    ]}
                  >
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="City"
                      placeholderTextColor={MUTED}
                      style={styles.input}
                      onFocus={() => setFocus('city')}
                      onBlur={() => setFocus(null)}
                    />
                  </View>
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>State *</Text>
                  <View
                    style={[
                      styles.field,
                      focus === 'state' && styles.fieldFocused,
                    ]}
                  >
                    <TextInput
                      value={state}
                      onChangeText={setState}
                      placeholder="State"
                      placeholderTextColor={MUTED}
                      style={styles.input}
                      onFocus={() => setFocus('state')}
                      onBlur={() => setFocus(null)}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Zip code *</Text>
                  <View
                    style={[
                      styles.field,
                      focus === 'zip' && styles.fieldFocused,
                    ]}
                  >
                    <TextInput
                      value={zipCode}
                      onChangeText={setZipCode}
                      placeholder="Zip"
                      placeholderTextColor={MUTED}
                      style={styles.input}
                      onFocus={() => setFocus('zip')}
                      onBlur={() => setFocus(null)}
                    />
                  </View>
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>Country *</Text>
                  <View
                    style={[
                      styles.field,
                      focus === 'country' && styles.fieldFocused,
                    ]}
                  >
                    <TextInput
                      value={country}
                      onChangeText={setCountry}
                      placeholder="Country"
                      placeholderTextColor={MUTED}
                      style={styles.input}
                      onFocus={() => setFocus('country')}
                      onBlur={() => setFocus(null)}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsDefault((v) => !v)}
                style={styles.defaultToggle}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkbox,
                    isDefault && styles.checkboxActive,
                  ]}
                >
                  {isDefault && (
                    <Ionicons name="checkmark" size={14} color={BG} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.defaultToggleTitle}>
                    Set as default address
                  </Text>
                  <Text style={styles.defaultToggleSub}>
                    Used automatically at checkout
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.88}
                style={styles.saveWrap}
              >
                <LinearGradient
                  colors={
                    saving
                      ? ['#4B5563', '#4B5563']
                      : [GREEN, '#14B8A6', BLUE]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  {saving ? (
                    <ActivityIndicator color="#041412" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Address</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.4,
    borderColor: 'transparent',
    borderTopColor: GREEN,
    borderRightColor: BLUE,
    borderBottomColor: 'transparent',
    borderLeftColor: GREEN,
  },
  orbLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLogo: { width: 32, height: 32 },
  loaderLabel: {
    marginTop: 18,
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  kicker: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  addHeaderOuter: { overflow: 'hidden' },
  addHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  emptyWrap: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  emptyCtaOuter: { overflow: 'hidden' },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 13,
    gap: 6,
  },
  emptyCtaText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
  },

  cardItem: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 12,
  },
  cardItemDefault: {
    borderColor: 'rgba(0,229,117,0.45)',
    backgroundColor: SURFACE_2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  typeIcon: {
    width: 42,
    height: 42,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeIconDefault: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  cardType: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,117,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 3,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: GREEN,
  },
  cardAddress: {
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 19,
  },
  tapHint: {
    fontSize: 11,
    color: MUTED,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SURFACE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    maxHeight: '92%',
  },
  modalContent: {
    padding: 22,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalKicker: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: TEXT,
  },
  modalClose: {
    width: 34,
    height: 34,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  field: {
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
  },
  fieldFocused: {
    borderColor: GREEN,
    backgroundColor: 'rgba(0,229,117,0.06)',
  },
  input: {
    fontSize: 15,
    color: TEXT,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: { flex: 1 },

  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  typeChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: SECONDARY,
  },
  typeChipTextActive: {
    color: BG,
  },

  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 12,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  defaultToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
  },
  defaultToggleSub: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },

  saveWrap: {
    marginTop: 24,
    overflow: 'hidden',
  },
  saveBtn: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 16,
  },
})