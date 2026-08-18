import api from '@/constants/api'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

/* ── Plazore tokens ── */
const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

/** Broader brands — arranged by popularity / region relevance */
const CARD_BRANDS = [
  { key: 'Visa', color: '#1A1F71', short: 'VISA' },
  { key: 'Mastercard', color: '#EB001B', short: 'MC' },
  { key: 'Verve', color: '#004C3F', short: 'VERVE' },
  { key: 'Amex', color: '#2E77BC', short: 'AMEX' },
  { key: 'Discover', color: '#FF6000', short: 'DISC' },
  { key: 'Other', color: '#4B5563', short: 'CARD' },
] as const

type Brand = (typeof CARD_BRANDS)[number]['key']

function maskCard(last4?: string) {
  if (!last4) return '•••• ••••'
  return `•••• ${last4}`
}

function getBrandMeta(brand?: string) {
  return (
    CARD_BRANDS.find((b) => b.key === brand) ||
    CARD_BRANDS[CARD_BRANDS.length - 1]
  )
}

export default function PaymentMethods() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const [brand, setBrand] = useState<Brand>('Visa')
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const fetchCards = async () => {
    try {
      const token = await getToken()
      if (!token) return

      const res = await api.get('/payment-methods', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setCards(res.data.data || [])
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
      fetchCards()
    }, [])
  )

  const resetForm = () => {
    setBrand('Visa')
    setName('')
    setNumber('')
    setExpiry('')
    setCvc('')
    setIsDefault(false)
  }

  const handleSave = async () => {
    const cleanNumber = number.replace(/\s/g, '')
    if (!name.trim() || cleanNumber.length < 12 || !expiry.trim() || !cvc.trim()) {
      Alert.alert('Missing fields', 'Please fill all card details correctly')
      return
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
      Alert.alert('Invalid expiry', 'Use format MM/YY')
      return
    }

    try {
      setSaving(true)
      const token = await getToken()

      await api.post(
        '/payment-methods',
        {
          brand,
          name: name.trim(),
          last4: cleanNumber.slice(-4),
          expMonth: expiry.split('/')[0],
          expYear: expiry.split('/')[1],
          isDefault,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setModalVisible(false)
      resetForm()
      fetchCards()
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to save card'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const token = await getToken()
      await api.put(
        `/payment-methods/${id}/default`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      fetchCards()
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Could not set default card'
      )
    }
  }

  const handleDelete = (id: string) => {
    Alert.alert('Delete Card', 'Remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken()
            await api.delete(`/payment-methods/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            fetchCards()
          } catch {
            Alert.alert('Error', 'Could not delete card')
          }
        },
      },
    ])
  }

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16)
    const parts = cleaned.match(/.{1,4}/g)
    return parts ? parts.join(' ') : cleaned
  }

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4)
    if (cleaned.length >= 3) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`
    }
    return cleaned
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Payment Methods</Text>
            <Text style={styles.headerSub}>Manage your cards</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[GREEN, BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addHeaderBtn}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              fetchCards()
            }}
            tintColor={GREEN}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="card-outline" size={34} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySub}>
              Add a card so checkout is faster and more secure.
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[GREEN, BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyCta}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyCtaText}>Add Card</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const meta = getBrandMeta(item.brand)
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSetDefault(item._id)}
              style={[
                styles.cardItem,
                item.isDefault && styles.cardItemDefault,
              ]}
            >
              <View style={styles.cardRow}>
                {/* Brand mark */}
                <View
                  style={[
                    styles.brandMark,
                    { backgroundColor: meta.color + '22' },
                  ]}
                >
                  <Text style={[styles.brandMarkText, { color: meta.color }]}>
                    {meta.short}
                  </Text>
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardBrand} numberOfLines={1}>
                      {item.brand || 'Card'} {maskCard(item.last4)}
                    </Text>
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

                  <Text style={styles.cardMeta} numberOfLines={1}>
                    Expires {item.expMonth}/{item.expYear}
                    {item.name ? ` · ${item.name}` : ''}
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
          )
        }}
      />

      {/* Add Card Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Card</Text>
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

              {/* Brand grid — 3 per row, disciplined */}
              <Text style={styles.label}>Card Brand</Text>
              <View style={styles.brandGrid}>
                {CARD_BRANDS.map((b) => {
                  const active = brand === b.key
                  return (
                    <TouchableOpacity
                      key={b.key}
                      onPress={() => setBrand(b.key)}
                      activeOpacity={0.85}
                      style={[
                        styles.brandChip,
                        active && styles.brandChipActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.brandDot,
                          { backgroundColor: b.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.brandChipText,
                          active && styles.brandChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {b.key}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={styles.label}>Name on card *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={MUTED}
                style={styles.input}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Card number *</Text>
              <TextInput
                value={number}
                onChangeText={(t) => setNumber(formatCardNumber(t))}
                placeholder="ACCT-000003"
                placeholderTextColor={MUTED}
                style={styles.input}
                keyboardType="number-pad"
                maxLength={19}
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>Expiry *</Text>
                  <TextInput
                    value={expiry}
                    onChangeText={(t) => setExpiry(formatExpiry(t))}
                    placeholder="MM/YY"
                    placeholderTextColor={MUTED}
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.label}>CVC *</Text>
                  <TextInput
                    value={cvc}
                    onChangeText={(t) =>
                      setCvc(t.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="123"
                    placeholderTextColor={MUTED}
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsDefault((v) => !v)}
                style={styles.defaultToggle}
                activeOpacity={0.8}
              >
                <View
                  style={[styles.checkbox, isDefault && styles.checkboxActive]}
                >
                  {isDefault && (
                    <Ionicons name="checkmark" size={14} color={BG} />
                  )}
                </View>
                <Text style={styles.defaultToggleText}>
                  Set as default payment method
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.88}
                style={styles.saveWrap}
              >
                <LinearGradient
                  colors={saving ? ['#4B5563', '#4B5563'] : [GREEN, BLUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Card</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.secureNote}>
                Only the last 4 digits are stored. Full payment processing comes
                with Stripe later.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: MUTED,
    marginTop: 1,
  },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 40,
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
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  emptyCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  cardItem: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 12,
  },
  cardItemDefault: {
    borderColor: GREEN + '55',
    backgroundColor: SURFACE_2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  brandMark: {
    width: 48,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandMarkText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  cardBrand: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    maxWidth: '70%',
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,117,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '600',
    color: GREEN,
  },
  cardMeta: {
    fontSize: 13,
    color: SECONDARY,
    lineHeight: 18,
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

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: TEXT,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: SECONDARY,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: SURFACE_2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: TEXT,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: { flex: 1 },

  /* Brand grid — 3 columns, clean */
  brandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandChip: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  brandChipActive: {
    borderColor: GREEN,
    backgroundColor: 'rgba(0,229,117,0.08)',
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  brandChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: SECONDARY,
    flex: 1,
  },
  brandChipTextActive: {
    color: TEXT,
  },

  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  defaultToggleText: {
    fontSize: 14,
    color: TEXT,
    fontWeight: '500',
  },

  saveWrap: {
    marginTop: 24,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveBtn: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secureNote: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
})