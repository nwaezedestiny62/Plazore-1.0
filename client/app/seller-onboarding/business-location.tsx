/**
 * Mandatory Business Location setup — final step before Seller Dashboard.
 */

import api from '@/constants/api'
import { REGION_LIST } from '@/constants/regions'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = 'rgba(17, 20, 26, 0.85)'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const TEXT = '#F5F7FA'
const TEXT_DIM = 'rgba(245, 247, 250, 0.72)'
const MUTED = 'rgba(245, 247, 250, 0.48)'
const LINE = 'rgba(255, 255, 255, 0.08)'
const ERR = '#F87171'

type Form = {
  country: string
  state: string
  city: string
  street: string
  zipCode: string
  landmark: string
  label: string
}

export default function BusinessLocationSetup() {
  const router = useRouter()
  const { getToken } = useAuth()

  const [form, setForm] = useState<Form>({
    country: '',
    state: '',
    city: '',
    street: '',
    zipCode: '',
    landmark: '',
    label: '',
  })
  const [showCountries, setShowCountries] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken()
        const res = await api.get('/seller/onboarding-status', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data?.success && res.data.data) {
          const d = res.data.data
          if (d.businessLocationCompleted) {
            router.replace('/seller' as any)
            return
          }
          if (!d.sellerOnboardingCompleted && d.needsOnboarding) {
            router.replace('/seller-onboarding' as any)
            return
          }
          const region = d.marketplaceRegion || 'NG'
          const regionName =
            REGION_LIST.find((r) => r.code === region)?.name || region
          setForm((f) => ({
            ...f,
            country: d.businessLocation?.country || regionName,
            state: d.businessLocation?.state || '',
            city: d.businessLocation?.city || '',
            street: d.businessLocation?.street || '',
            zipCode: d.businessLocation?.zipCode || '',
            landmark: d.businessLocation?.landmark || '',
            label: d.businessLocation?.label || '',
          }))
        }
      } catch {
        /* allow form */
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [getToken, router])

  const set = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof Form, string>> = {}
    if (!form.country.trim()) next.country = 'Country is required'
    if (!form.city.trim()) next.city = 'City is required'
    if (!form.street.trim()) next.street = 'Business address is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    setApiError(null)
    try {
      const token = await getToken()
      const res = await api.post(
        '/seller/business-location',
        {
          country: form.country.trim(),
          state: form.state.trim(),
          city: form.city.trim(),
          street: form.street.trim(),
          zipCode: form.zipCode.trim(),
          landmark: form.landmark.trim(),
          label: form.label.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Could not save location')
      }
      router.replace('/seller' as any)
    } catch (err: any) {
      setApiError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    )
  }

  const fieldStyle = (key: string) => [
    styles.field,
    focus === key && styles.fieldFocused,
    errors[key as keyof Form] && styles.fieldError,
  ]

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A0E14', '#090B0F', '#061210']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>Final step</Text>
            <Text style={styles.title}>Where does your business operate from?</Text>
            <Text style={styles.lead}>
              Your default business location helps Plazore organize fulfilment,
              seller information, and marketplace operations accurately.
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Country *</Text>
            <Pressable
              onPress={() => setShowCountries((v) => !v)}
              style={fieldStyle('country')}
            >
              <Text style={[styles.fieldText, !form.country && { color: MUTED }]}>
                {form.country || 'Select country'}
              </Text>
              <Ionicons
                name={showCountries ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={MUTED}
              />
            </Pressable>
            {errors.country ? (
              <Text style={styles.errText}>{errors.country}</Text>
            ) : null}
            {showCountries && (
              <View style={styles.dropdown}>
                {REGION_LIST.map((r) => (
                  <Pressable
                    key={r.code}
                    onPress={() => {
                      set('country', r.name)
                      setShowCountries(false)
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text style={styles.dropdownText}>
                      {r.flag ? `${r.flag} ` : ''}
                      {r.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>State / Province</Text>
            <TextInput
              value={form.state}
              onChangeText={(v) => set('state', v)}
              placeholder="e.g. Lagos, California"
              placeholderTextColor={MUTED}
              style={fieldStyle('state')}
              onFocus={() => setFocus('state')}
              onBlur={() => setFocus(null)}
            />

            <Text style={styles.label}>City *</Text>
            <TextInput
              value={form.city}
              onChangeText={(v) => set('city', v)}
              placeholder="City or town"
              placeholderTextColor={MUTED}
              style={fieldStyle('city')}
              onFocus={() => setFocus('city')}
              onBlur={() => setFocus(null)}
            />
            {errors.city ? <Text style={styles.errText}>{errors.city}</Text> : null}

            <Text style={styles.label}>Business address *</Text>
            <TextInput
              value={form.street}
              onChangeText={(v) => set('street', v)}
              placeholder="Street, building, suite"
              placeholderTextColor={MUTED}
              style={[fieldStyle('street'), styles.fieldMultiline]}
              multiline
              numberOfLines={2}
              onFocus={() => setFocus('street')}
              onBlur={() => setFocus(null)}
            />
            {errors.street ? (
              <Text style={styles.errText}>{errors.street}</Text>
            ) : null}

            <Text style={styles.label}>Postal / ZIP code</Text>
            <TextInput
              value={form.zipCode}
              onChangeText={(v) => set('zipCode', v)}
              placeholder="Optional"
              placeholderTextColor={MUTED}
              style={fieldStyle('zipCode')}
              onFocus={() => setFocus('zipCode')}
              onBlur={() => setFocus(null)}
            />

            <Text style={styles.label}>Landmark / additional info</Text>
            <TextInput
              value={form.landmark}
              onChangeText={(v) => set('landmark', v)}
              placeholder="Optional — helps with fulfilment"
              placeholderTextColor={MUTED}
              style={fieldStyle('landmark')}
              onFocus={() => setFocus('landmark')}
              onBlur={() => setFocus(null)}
            />

            <Text style={styles.label}>Location label</Text>
            <TextInput
              value={form.label}
              onChangeText={(v) => set('label', v)}
              placeholder="e.g. Main warehouse, Storefront"
              placeholderTextColor={MUTED}
              style={fieldStyle('label')}
              onFocus={() => setFocus('label')}
              onBlur={() => setFocus(null)}
            />

            <View style={styles.privacyBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color={BLUE} />
              <Text style={styles.privacyText}>
                This location is used for fulfilment organisation and seller
                profile accuracy. City and country may appear on your public
                storefront; full street address is not shown to buyers by
                default.
              </Text>
            </View>

            {apiError ? (
              <View style={styles.apiError}>
                <Ionicons name="alert-circle" size={16} color={ERR} />
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={submit}
              style={[styles.cta, saving && styles.ctaDisabled]}
              disabled={saving}
            >
              <LinearGradient
                colors={[GREEN, '#00C060']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGrad}
              >
                {saving ? (
                  <ActivityIndicator color="#041008" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Complete Seller Setup</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#041008" />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centered: { alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: GREEN,
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  lead: { fontSize: 14, lineHeight: 21, color: TEXT_DIM },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_DIM,
    marginTop: 16,
    marginBottom: 8,
  },
  field: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    color: TEXT,
    fontSize: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldFocused: {
    borderColor: 'rgba(59, 130, 246, 0.55)',
    backgroundColor: 'rgba(17, 20, 26, 0.95)',
  },
  fieldError: { borderColor: 'rgba(248, 113, 113, 0.55)' },
  fieldMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  fieldText: { flex: 1, fontSize: 15, color: TEXT },
  errText: { fontSize: 12, color: ERR, marginTop: 6 },
  dropdown: {
    marginTop: 6,
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    maxHeight: 220,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  dropdownText: { fontSize: 15, color: TEXT },
  privacyBox: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 19, color: TEXT_DIM },
  apiError: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#FCA5A5' },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    paddingTop: 8,
  },
  cta: { borderRadius: 14, overflow: 'hidden' },
  ctaDisabled: { opacity: 0.7 },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#041008' },
})
