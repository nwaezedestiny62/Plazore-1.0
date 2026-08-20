import api from '@/constants/api'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useOAuth, useSignUp } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import { Link, useRouter } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
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
import Toast from 'react-native-toast-message'

WebBrowser.maybeCompleteAuthSession()

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

async function afterAuthNavigate(
  getToken: () => Promise<string | null>,
  router: ReturnType<typeof useRouter>
) {
  try {
    const token = await getToken()
    if (!token) {
      router.replace('/complete-profile' as any)
      return
    }
    const res = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const u = res.data?.data
    const needsProfile = !u?.phone || !String(u.phone).trim() || !u?.name
    if (needsProfile) {
      router.replace('/complete-profile' as any)
    } else if (!u?.marketplaceRegion) {
      router.replace('/select-region' as any)
    } else {
      router.replace('/(tabs)' as any)
    }
  } catch {
    router.replace('/complete-profile' as any)
  }
}

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const { getToken } = useAuth()
  const router = useRouter()
  const googleOAuth = useOAuth({ strategy: 'oauth_google' })
  const appleOAuth = useOAuth({ strategy: 'oauth_apple' })

  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [showPass, setShowPass] = useState(false)

  const onSignUpPress = async () => {
    if (!isLoaded) return
    if (!emailAddress.trim() || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing fields',
        text2: 'Email and password are required',
      })
      return
    }
    if (password.length < 8) {
      Toast.show({
        type: 'error',
        text1: 'Weak password',
        text2: 'Use at least 8 characters',
      })
      return
    }

    setLoading(true)
    try {
      await signUp.create({
        emailAddress: emailAddress.trim(),
        password,
      })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Sign up failed',
        text2: err?.errors?.[0]?.message ?? 'Something went wrong',
      })
    } finally {
      setLoading(false)
    }
  }

  const onVerifyPress = async () => {
    if (!isLoaded) return
    if (!code.trim()) {
      Toast.show({ type: 'error', text1: 'Enter the verification code' })
      return
    }
    setLoading(true)
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      })
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId })
        await afterAuthNavigate(getToken, router)
      } else {
        Toast.show({ type: 'error', text1: 'Verification incomplete' })
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Verify failed',
        text2: err?.errors?.[0]?.message ?? 'Invalid code',
      })
    } finally {
      setLoading(false)
    }
  }

  const onOAuth = useCallback(
    async (provider: 'google' | 'apple') => {
      try {
        setOauthLoading(provider)
        const start =
          provider === 'google'
            ? googleOAuth.startOAuthFlow
            : appleOAuth.startOAuthFlow
        const { createdSessionId, setActive: setOAuthActive } = await start()
        if (createdSessionId && setOAuthActive) {
          await setOAuthActive({ session: createdSessionId })
          await afterAuthNavigate(getToken, router)
        }
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: `${provider === 'google' ? 'Google' : 'Apple'} sign-in`,
          text2: err?.errors?.[0]?.message ?? 'Could not complete sign-in',
        })
      } finally {
        setOauthLoading(null)
      }
    },
    [googleOAuth, appleOAuth, getToken, router]
  )

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.back}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={22} color={TEXT} />
          </TouchableOpacity>

          {!pendingVerification ? (
            <>
              <Text style={styles.kicker}>Plazore</Text>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.lead}>
                Email and password first. Name, phone, and country come next.
              </Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor="#3D5268"
                autoCapitalize="none"
                keyboardType="email-address"
                value={emailAddress}
                onChangeText={setEmailAddress}
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#3D5268"
                  secureTextEntry={!showPass}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable
                  onPress={() => setShowPass((v) => !v)}
                  style={styles.eye}
                >
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={MUTED}
                  />
                </Pressable>
              </View>

              <TouchableOpacity
                onPress={onSignUpPress}
                disabled={loading}
                activeOpacity={0.9}
                style={{ marginTop: 8, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={[GREEN, BLUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {loading ? (
                    <ActivityIndicator color="#041412" />
                  ) : (
                    <Text style={styles.ctaText}>Continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.oauthBtn}
                onPress={() => onOAuth('google')}
                disabled={!!oauthLoading}
                activeOpacity={0.85}
              >
                {oauthLoading === 'google' ? (
                  <ActivityIndicator color={TEXT} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color={TEXT} />
                    <Text style={styles.oauthText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.oauthBtn}
                  onPress={() => onOAuth('apple')}
                  disabled={!!oauthLoading}
                  activeOpacity={0.85}
                >
                  {oauthLoading === 'apple' ? (
                    <ActivityIndicator color={TEXT} />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color={TEXT} />
                      <Text style={styles.oauthText}>Continue with Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerMuted}>Already have an account? </Text>
                <Link href="/sign-in">
                  <Text style={styles.footerLink}>Sign in</Text>
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.kicker}>Almost there</Text>
              <Text style={styles.title}>Verify email</Text>
              <Text style={styles.lead}>
                Enter the code we sent to {emailAddress.trim() || 'your email'}.
              </Text>

              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="123456"
                placeholderTextColor="#3D5268"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />

              <TouchableOpacity
                onPress={onVerifyPress}
                disabled={loading}
                activeOpacity={0.9}
                style={{ overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={[GREEN, BLUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {loading ? (
                    <ActivityIndicator color="#041412" />
                  ) : (
                    <Text style={styles.ctaText}>Verify & continue</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { padding: 24, paddingBottom: 40 },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kicker: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  lead: {
    marginTop: 8,
    marginBottom: 28,
    color: SECONDARY,
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 16,
    marginBottom: 16,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  eye: { padding: 10 },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '700',
  },
  cta: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#041412', fontWeight: '800', fontSize: 16 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  dividerText: {
    marginHorizontal: 12,
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  oauthText: { color: TEXT, fontWeight: '600', fontSize: 15 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  footerMuted: { color: SECONDARY, fontSize: 14 },
  footerLink: { color: GREEN, fontWeight: '700', fontSize: 14 },
})