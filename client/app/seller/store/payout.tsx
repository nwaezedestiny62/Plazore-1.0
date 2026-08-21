/**
 * Secure Payout & Shipping
 * - Always starts locked
 * - Unlocks only after backend verifies last 4 of account number
 * - Re-locks whenever the screen loses focus
 * - Save asks for confirmation: what changed + Proceed / No
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '@/constants/api'

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const DANGER = '#EF4444'

type OverlayAction = {
  label: string
  onPress: () => void
  primary?: boolean
  destructive?: boolean
}

type OverlayState = {
  title: string
  message?: string
  tone?: 'info' | 'success' | 'danger'
  durationMs?: number
  actions?: OverlayAction[]
} | null

type FormState = {
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

const empty: FormState = {
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

const LABELS: Record<keyof FormState, string> = {
  bankName: 'Bank name',
  accountName: 'Account name',
  accountNumber: 'Account number',
  street: 'Street',
  city: 'City',
  state: 'State',
  zipCode: 'Zip',
  country: 'Country',
  deliveryMethod: 'Delivery method',
  courierCompany: 'Courier company',
}

function TopOverlay({
  state,
  onDismiss,
}: {
  state: OverlayState
  onDismiss: () => void
}) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(-140)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!state) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -140,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
      return
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()

    // Only auto-dismiss when there are no actions (confirm must stay)
    if (!state.actions?.length) {
      timer.current = setTimeout(
        () => onDismiss(),
        state.durationMs ?? 3800
      )
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  if (!state) return null
  const accent =
    state.tone === 'danger'
      ? DANGER
      : state.tone === 'success'
        ? GREEN
        : BLUE

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        paddingTop: insets.top + 8,
        paddingHorizontal: 14,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          backgroundColor: SURFACE,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 3, backgroundColor: accent }} />
          <View style={{ flex: 1, padding: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}>
                  {state.title}
                </Text>
                {!!state.message && (
                  <Text
                    style={{
                      color: SECONDARY,
                      fontSize: 13,
                      lineHeight: 19,
                      marginTop: 6,
                    }}
                  >
                    {state.message}
                  </Text>
                )}
              </View>
              {!state.actions?.length && (
                <Pressable onPress={onDismiss} hitSlop={12}>
                  <Ionicons name="close" size={18} color={MUTED} />
                </Pressable>
              )}
            </View>

            {!!state.actions?.length && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  marginTop: 14,
                }}
              >
                {state.actions.map((a) => (
                  <TouchableOpacity
                    key={a.label}
                    onPress={() => {
                      onDismiss()
                      // small delay so dismiss anim starts cleanly
                      setTimeout(() => a.onPress(), 40)
                    }}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: 'center',
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: a.primary
                        ? 'transparent'
                        : LINE,
                      backgroundColor: a.primary
                        ? GREEN
                        : a.destructive
                          ? 'rgba(239,68,68,0.12)'
                          : SURFACE_2,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '800',
                        fontSize: 13,
                        color: a.primary
                          ? '#041412'
                          : a.destructive
                            ? DANGER
                            : TEXT,
                      }}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  secure,
  maxLength,
}: {
  label: string
  value: string
  onChange: (t: string) => void
  placeholder?: string
  keyboardType?: any
  secure?: boolean
  maxLength?: number
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#3D5268"
        keyboardType={keyboardType}
        secureTextEntry={secure}
        maxLength={maxLength}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  )
}

function maskAccount(n: string) {
  const d = n.replace(/\D/g, '')
  if (d.length <= 4) return d || '—'
  return `••••${d.slice(-4)}`
}

function summarizeChanges(before: FormState, after: FormState): string[] {
  const lines: string[] = []
  ;(Object.keys(LABELS) as (keyof FormState)[]).forEach((key) => {
    const a = String(before[key] ?? '').trim()
    const b = String(after[key] ?? '').trim()
    if (a === b) return
    if (key === 'accountNumber') {
      lines.push(
        `${LABELS[key]}: ${maskAccount(a)} → ${maskAccount(b)}`
      )
    } else if (key === 'deliveryMethod') {
      const label = (v: string) =>
        v === 'self' ? 'Self delivery' : v === 'courier' ? 'Courier' : 'None'
      lines.push(`${LABELS[key]}: ${label(a)} → ${label(b)}`)
    } else {
      lines.push(`${LABELS[key]}: ${a || '—'} → ${b || '—'}`)
    }
  })
  return lines
}

export default function SecurePayoutScreen() {
  const { getToken } = useAuth()
  const router = useRouter()

  const [unlocked, setUnlocked] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [lastFour, setLastFour] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [form, setForm] = useState<FormState>(empty)
  const [baseline, setBaseline] = useState<FormState>(empty)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overlay, setOverlay] = useState<OverlayState>(null)

  const toast = useCallback(
    (
      title: string,
      message?: string,
      tone: 'info' | 'success' | 'danger' = 'info'
    ) => setOverlay({ title, message, tone, durationMs: 3800 }),
    []
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useFocusEffect(
    useCallback(() => {
      return () => {
        setUnlocked(false)
        setLastFour('')
        setSetupRequired(false)
      }
    }, [])
  )

  const verify = async () => {
    const digits = String(lastFour).replace(/\D/g, '').slice(0, 4)
    if (digits.length !== 4) {
      toast('Required', 'Enter exactly 4 digits', 'danger')
      return
    }
    try {
      setVerifying(true)
      const token = await getToken()
      if (!token) {
        toast('Error', 'Not signed in', 'danger')
        return
      }

      const res = await api.post(
        '/seller/store/verify-payout',
        { lastFour: digits },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data?.success && res.data?.data?.unlocked) {
        setUnlocked(true)
        setSetupRequired(!!res.data.data.setupRequired)
        await loadSensitive()
      } else {
        toast(
          'Access denied',
          res.data?.message || 'Could not unlock',
          'danger'
        )
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 404
          ? 'Verify endpoint missing — restart server after adding the route'
          : 'Digits did not match or network error')
      toast('Access denied', msg, 'danger')
    } finally {
      setVerifying(false)
    }
  }

  const loadSensitive = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await api.get('/seller/store', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const d = res.data.data
        const next: FormState = {
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
        }
        setForm(next)
        setBaseline(next)
      }
    } catch {
      toast('Error', 'Could not load payout details', 'danger')
    } finally {
      setLoading(false)
    }
  }

  const performSave = async () => {
    if (!form.accountNumber.trim() || !form.bankName.trim()) {
      toast('Required', 'Bank name and account number are required', 'danger')
      return
    }
    try {
      setSaving(true)
      const token = await getToken()
      const formData = new FormData()

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

      const res = await api.put('/seller/store', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data.success) {
        setBaseline({ ...form })
        setSetupRequired(false)
        toast(
          'Updated',
          'Payout and shipping defaults were saved. Future earnings use this account.',
          'success'
        )
      }
    } catch (e: any) {
      toast(
        'Error',
        e.response?.data?.message || 'Could not save',
        'danger'
      )
    } finally {
      setSaving(false)
    }
  }

  /** Confirm before save — shows what changed + consequences */
  const requestSave = () => {
    if (!form.accountNumber.trim() || !form.bankName.trim()) {
      toast('Required', 'Bank name and account number are required', 'danger')
      return
    }

    const changes = summarizeChanges(baseline, form)

    if (changes.length === 0) {
      toast('No changes', 'Nothing was modified.', 'info')
      return
    }

    const list = changes.map((c) => `• ${c}`).join('\n')
    const message =
      `You are about to update:\n\n${list}\n\n` +
      `What this means:\n` +
      `• Future seller payouts will go to the bank account filled in.\n` +
      `• Shipping defaults apply when you create new products (existing listings keep their own settings).\n` +
      `• After you leave this screen, access locks again and the last 4 digits of the account will be required.\n\n` +
      `Are you sure you want to make this change?`

    setOverlay({
      title: 'Confirm update',
      message,
      tone: 'info',
      actions: [
        {
          label: 'No',
          onPress: () => {},
        },
        {
          label: 'Proceed',
          primary: true,
          onPress: () => {
            performSave()
          },
        },
      ],
    })
  }

  // ── LOCK GATE ──
  if (!unlocked) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

        <View style={styles.gate}>
          <View style={styles.lockIcon}>
            <Ionicons name="shield-checkmark" size={28} color={GREEN} />
          </View>
          <Text style={styles.gateTitle}>Protected details</Text>
          <Text style={styles.gateBody}>
            Payout account and shipping defaults are sensitive. Enter the last 4
            digits of the account number filled in to continue.
          </Text>

          <Text style={styles.label}>Last 4 digits</Text>
          <TextInput
            value={lastFour}
            onChangeText={(t) => setLastFour(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor="#3D5268"
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            style={[styles.input, styles.pinInput]}
            autoFocus
          />

          <TouchableOpacity
            onPress={verify}
            disabled={verifying || lastFour.length !== 4}
            activeOpacity={0.9}
            style={{ marginTop: 8, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={[GREEN, BLUE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {verifying ? (
                <ActivityIndicator color="#041412" />
              ) : (
                <Text style={styles.ctaText}>Unlock</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.gateHint}>
            First time? If no account is saved yet, any 4 digits open setup.
            After you save an account, only the correct last 4 will work.
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <Text style={{ color: MUTED, fontSize: 13 }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── UNLOCKED ──
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.unlockedBadge}>
          <Ionicons name="lock-open-outline" size={14} color={GREEN} />
          <Text style={styles.unlockedText}>Session unlocked</Text>
        </View>

        <Text style={styles.kicker}>Sensitive</Text>
        <Text style={styles.title}>Payout & shipping</Text>
        <Text style={styles.lead}>
          Where Plazore sends your earnings, and default shipping used when you
          list products. Leaving this screen locks access again.
        </Text>

        {setupRequired && (
          <View style={styles.warnBox}>
            <Text style={{ color: '#F0C070', fontWeight: '700', fontSize: 13 }}>
              Set up your payout account
            </Text>
            <Text
              style={{
                color: '#C4A882',
                fontSize: 12,
                lineHeight: 18,
                marginTop: 4,
              }}
            >
              No account filled in yet. Enter bank details below and save — next
              visits will require the last 4 digits.
            </Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={GREEN} style={{ marginVertical: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Payout account</Text>
            <View style={styles.card}>
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
            </View>

            <Text style={styles.sectionLabel}>Shipping defaults</Text>
            <View style={styles.card}>
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
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Zip"
                    value={form.zipCode}
                    onChange={(t) => setField('zipCode', t)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Country"
                    value={form.country}
                    onChange={(t) => setField('country', t)}
                  />
                </View>
              </View>

              <Text style={[styles.label, { marginBottom: 8 }]}>
                Default method
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {(['courier', 'self'] as const).map((m) => {
                  const active = form.deliveryMethod === m
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setField('deliveryMethod', m)}
                      style={[styles.shipChoice, active && styles.shipChoiceOn]}
                    >
                      <Ionicons
                        name={m === 'self' ? 'walk-outline' : 'car-outline'}
                        size={18}
                        color={active ? GREEN : MUTED}
                      />
                      <Text
                        style={{
                          marginTop: 6,
                          fontWeight: '600',
                          fontSize: 13,
                          color: active ? TEXT : MUTED,
                        }}
                      >
                        {m === 'self' ? 'Self delivery' : 'Courier'}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {form.deliveryMethod === 'courier' && (
                <Field
                  label="Courier company"
                  value={form.courierCompany}
                  onChange={(t) => setField('courierCompany', t)}
                  placeholder="e.g. DHL, GIG"
                />
              )}
            </View>

            <TouchableOpacity
              onPress={requestSave}
              disabled={saving}
              activeOpacity={0.9}
              style={{ marginTop: 8, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={[GREEN, BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {saving ? (
                  <ActivityIndicator color="#041412" />
                ) : (
                  <Text style={styles.ctaText}>Save payout & shipping</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const SURFACE_2 = '#171B22'

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  gate: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  lockIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(0,229,117,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  gateBody: {
    marginTop: 8,
    marginBottom: 24,
    fontSize: 14,
    lineHeight: 21,
    color: SECONDARY,
  },
  gateHint: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
  },
  backLink: { marginTop: 24, alignItems: 'center' },
  pinInput: {
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,229,117,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  unlockedText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: MUTED,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  lead: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 19,
    color: SECONDARY,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 18,
  },
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0A121C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 15,
  },
  warnBox: {
    marginBottom: 14,
    backgroundColor: '#2A1F14',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#5C3D1E',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shipChoice: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: '#0A121C',
    alignItems: 'center',
  },
  shipChoiceOn: {
    borderColor: 'rgba(0,229,117,0.4)',
    backgroundColor: 'rgba(0,229,117,0.08)',
  },
  cta: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
  },
})