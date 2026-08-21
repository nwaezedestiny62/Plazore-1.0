// client/app/(auth)/sign-in.tsx
/**
 * Bulletproof auth: login + signup + Google + forgot/reset password
 * Never stays on this screen if already signed in
 * Login fields and signup fields are fully independent
 */

import api from '@/constants/api'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useOAuth, useSignIn, useSignUp } from '@clerk/clerk-expo'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins'
import NetInfo from '@react-native-community/netinfo'
import { LinearGradient } from 'expo-linear-gradient'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
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
import Toast from 'react-native-toast-message'

WebBrowser.maybeCompleteAuthSession()

const { width: SCREEN_W } = Dimensions.get('window')
const GREEN = '#00E575'
const BLUE = '#3B82F6'
const TEXT = '#FFFFFF'
const TEXT_DIM = 'rgba(255,255,255,0.78)'
const PILL_W = (SCREEN_W - 48 - 8) / 2
const EASE = Easing.bezier(0.22, 1, 0.36, 1)
const GOOGLE_G = 'https://developers.google.com/identity/images/g-logo.png'

type Mode = 'login' | 'signup'
/** auth = main forms | verify-signup | verify-2fa | forgot | forgot-code | reset-pw */
type Flow =
  | 'auth'
  | 'verify-signup'
  | 'verify-2fa'
  | 'forgot'
  | 'forgot-code'
  | 'reset-pw'

function clerkMsg(err: any, fallback: string) {
  const e = err?.errors?.[0]
  const code = e?.code || ''
  const msg = e?.longMessage || e?.message || err?.message || fallback

  if (
    code.includes('form_identifier_not_found') ||
    /not found|couldn't find|no account/i.test(String(msg))
  ) {
    return 'No account found with this email'
  }
  if (
    code.includes('form_password_incorrect') ||
    /password is incorrect|wrong password|invalid credentials/i.test(
      String(msg)
    )
  ) {
    return 'Incorrect password'
  }
  if (
    code.includes('form_identifier_exists') ||
    /already exists|already been taken/i.test(String(msg))
  ) {
    return 'An account with this email already exists. Try logging in.'
  }
  if (
    code.includes('form_code_incorrect') ||
    /incorrect|invalid code|verification code/i.test(String(msg))
  ) {
    return 'Invalid or expired code'
  }
  if (code.includes('form_password_pwned') || /breached|pwned/i.test(String(msg))) {
    return 'This password is too common. Choose a stronger one.'
  }
  if (/at least|too short|password/i.test(String(msg)) && /8|length/i.test(String(msg))) {
    return 'Password must be at least 8 characters'
  }
  return String(msg)
}

async function afterAuthNavigate(
  getToken: () => Promise<string | null>,
  router: ReturnType<typeof useRouter>
) {
  try {
    await new Promise((r) => setTimeout(r, 400))
    const token = await getToken()
    if (!token) {
      router.replace('/complete-profile')
      return
    }
    const res = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const u = res.data?.data
    const needsProfile =
      !u?.name ||
      !String(u.name).trim() ||
      !u?.phone ||
      !String(u.phone).trim()
    router.replace(needsProfile ? '/complete-profile' : '/(tabs)')
  } catch {
    router.replace('/complete-profile')
  }
}

export default function AuthScreen() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  })

  const params = useLocalSearchParams<{ mode?: string }>()
  const initialMode: Mode = params.mode === 'signup' ? 'signup' : 'login'

  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } =
    useSignIn()
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } =
    useSignUp()
  const { getToken, isSignedIn, isLoaded: authLoaded } = useAuth()
  const router = useRouter()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })

  const [mode, setMode] = useState<Mode>(initialMode)
  const [flow, setFlow] = useState<Flow>('auth')

  // ── Independent fields: login ≠ signup ──
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [showLoginPass, setShowLoginPass] = useState(false)
  const [showSignupPass, setShowSignupPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [routingOut, setRoutingOut] = useState(false)

  const navigatingRef = useRef(false)
  const segmentAnim = useRef(
    new Animated.Value(initialMode === 'signup' ? 1 : 0)
  ).current
  const formSlide = useRef(
    new Animated.Value(initialMode === 'signup' ? 1 : 0)
  ).current
  const offlineAnim = useRef(new Animated.Value(0)).current
  const contentFade = useRef(new Animated.Value(0)).current
  const passwordRef = useRef<TextInput>(null)
  const loginPassRef = useRef<TextInput>(null)

  const leaveAuth = useCallback(async () => {
    if (navigatingRef.current) return
    navigatingRef.current = true
    setRoutingOut(true)
    try {
      await afterAuthNavigate(getToken, router)
    } catch {
      navigatingRef.current = false
      setRoutingOut(false)
      router.replace('/complete-profile')
    }
  }, [getToken, router])

  // Already signed in → never stay here
  useEffect(() => {
    if (!authLoaded || !isSignedIn) return
    leaveAuth()
  }, [authLoaded, isSignedIn, leaveAuth])

  useEffect(() => {
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 480,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false)
      setIsOnline(online)
      Animated.timing(offlineAnim, {
        toValue: online ? 0 : 1,
        duration: 300,
        easing: EASE,
        useNativeDriver: true,
      }).start()
    })
    return () => unsub()
  }, [])

  const requireOnline = () => {
    if (!isOnline) {
      Toast.show({
        type: 'error',
        text1: 'No internet',
        text2: 'Connect to continue',
      })
      return false
    }
    return true
  }

  const switchMode = (next: Mode) => {
    if (next === mode && flow === 'auth') return
    setFieldError(null)
    setCode('')
    setFlow('auth')
    const to = next === 'signup' ? 1 : 0
    setMode(next)
    Animated.parallel([
      Animated.timing(segmentAnim, {
        toValue: to,
        duration: 360,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(formSlide, {
        toValue: to,
        duration: 360,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const backToAuth = () => {
    setFlow('auth')
    setCode('')
    setNewPassword('')
    setConfirmPassword('')
    setFieldError(null)
  }

  // ── Email / password LOGIN ──
  const onLoginPress = async () => {
    if (!signInLoaded) return
    if (!requireOnline()) return
    setFieldError(null)

    const email = loginEmail.trim().toLowerCase()
    if (!email || !loginPassword) {
      setFieldError('Email and password are required')
      return
    }

    setLoading(true)
    try {
      const result = await signIn.create({
        identifier: email,
        password: loginPassword,
      })

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId })
        await leaveAuth()
        return
      }

      if (result.status === 'needs_second_factor') {
        const emailFactor = result.supportedSecondFactors?.find(
          (f: any) => f.strategy === 'email_code'
        )
        if (emailFactor) {
          await signIn.prepareSecondFactor({ strategy: 'email_code' })
          setFlow('verify-2fa')
          Toast.show({
            type: 'success',
            text1: 'Check your email',
            text2: 'Enter the verification code',
          })
        } else {
          setFieldError('Additional verification required. Try Google sign-in.')
        }
        return
      }

      setFieldError('Could not complete sign-in. Try again.')
    } catch (err: any) {
      setFieldError(clerkMsg(err, 'Invalid email or password'))
    } finally {
      setLoading(false)
    }
  }

  const onLogin2faVerify = async () => {
    if (!signInLoaded || !code.trim()) return
    setLoading(true)
    setFieldError(null)
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: code.trim(),
      })
      if (attempt.status === 'complete') {
        await setSignInActive({ session: attempt.createdSessionId })
        await leaveAuth()
      } else {
        setFieldError('Verification incomplete')
      }
    } catch (err: any) {
      setFieldError(clerkMsg(err, 'Invalid code'))
    } finally {
      setLoading(false)
    }
  }

  // ── SIGN UP ──
  const onSignUpPress = async () => {
    if (!signUpLoaded) return
    if (!requireOnline()) return
    setFieldError(null)

    const email = signupEmail.trim().toLowerCase()
    if (!email || !signupPassword) {
      setFieldError('Email and password are required')
      return
    }
    if (signupPassword.length < 8) {
      setFieldError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await signUp.create({ emailAddress: email, password: signupPassword })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setFlow('verify-signup')
      Toast.show({
        type: 'success',
        text1: 'Check your email',
        text2: 'We sent a verification code',
      })
    } catch (err: any) {
      setFieldError(clerkMsg(err, 'Sign up failed'))
    } finally {
      setLoading(false)
    }
  }

  const onSignUpVerify = async () => {
    if (!signUpLoaded || !code.trim()) return
    setLoading(true)
    setFieldError(null)
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      })
      if (attempt.status === 'complete') {
        await setSignUpActive({ session: attempt.createdSessionId })
        await leaveAuth()
      } else {
        setFieldError('Verification incomplete')
      }
    } catch (err: any) {
      setFieldError(clerkMsg(err, 'Invalid code'))
    } finally {
      setLoading(false)
    }
  }

  // ── FORGOT PASSWORD (uses login email) ──
  const onForgotSend = async () => {
    if (!signInLoaded) return
    if (!requireOnline()) return
    setFieldError(null)

    const email = loginEmail.trim().toLowerCase()
    if (!email) {
      setFieldError('Enter the email for your account')
      return
    }

    setLoading(true)
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      })
      setFlow('forgot-code')
      setCode('')
      Toast.show({
        type: 'success',
        text1: 'Code sent',
        text2: 'Check your email for a reset code',
      })
    } catch (err: any) {
      setFieldError(clerkMsg(err, 'Could not send reset code'))
    } finally {
      setLoading(false)
    }
  }

  const onForgotVerifyCode = async () => {
    if (!signInLoaded || !code.trim()) return
    setLoading(true)
    setFieldError(null)
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
      })
      if (
        attempt.status === 'needs_new_password' ||
        attempt.status === 'complete' ||
        (attempt as any).status === 'needs_new_password'
      ) {
        setFlow('reset-pw')
        setNewPassword('')
        setConfirmPassword('')
      } else if ((signIn as any).status === 'needs_new_password') {
        setFlow('reset-pw')
      } else {
        setFlow('reset-pw')
      }
    } catch (err: any) {
      const msg = clerkMsg(err, 'Invalid code')
      if (/new password|needs_new_password/i.test(msg)) {
        setFlow('reset-pw')
      } else {
        setFieldError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const onResetPassword = async () => {
    if (!signInLoaded) return
    if (!requireOnline()) return
    setFieldError(null)

    if (newPassword.length < 8) {
      setFieldError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setFieldError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const result = await signIn.resetPassword({
        password: newPassword,
      })
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId })
        await leaveAuth()
        return
      }
      Toast.show({
        type: 'success',
        text1: 'Password updated',
        text2: 'Sign in with your new password',
      })
      setLoginPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setCode('')
      setFlow('auth')
      setMode('login')
      segmentAnim.setValue(0)
      formSlide.setValue(0)
    } catch (err: any) {
      setFieldError(clerkMsg(err, 'Could not update password'))
    } finally {
      setLoading(false)
    }
  }

  // ── GOOGLE ──
  const onGoogle = useCallback(async () => {
    if (!requireOnline()) return

    if (isSignedIn) {
      setOauthLoading(true)
      try {
        await leaveAuth()
      } finally {
        setOauthLoading(false)
      }
      return
    }

    try {
      setOauthLoading(true)
      setFieldError(null)
      await WebBrowser.warmUpAsync()

      const redirectUrl = Linking.createURL('/(auth)/sign-in', {
        scheme: 'plazore',
      })

      const {
        createdSessionId,
        setActive: setOAuthActive,
        signIn: oauthSignIn,
        signUp: oauthSignUp,
      } = await startOAuthFlow({ redirectUrl })

      const sessionId =
        createdSessionId ||
        oauthSignIn?.createdSessionId ||
        oauthSignUp?.createdSessionId ||
        null

      if (sessionId && setOAuthActive) {
        await setOAuthActive({ session: sessionId })
        await leaveAuth()
        return
      }

      Toast.show({
        type: 'info',
        text1: 'Sign-in not completed',
        text2: 'Please try Google again',
      })
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.message ?? err?.message ?? 'Could not complete'
      const lower = String(msg).toLowerCase()
      if (!lower.includes('cancel') && !lower.includes('dismiss')) {
        Toast.show({ type: 'error', text1: 'Google', text2: msg })
      }
    } finally {
      setOauthLoading(false)
      WebBrowser.coolDownAsync().catch(() => {})
    }
  }, [startOAuthFlow, leaveAuth, isSignedIn, isOnline])

  if (authLoaded && isSignedIn && routingOut) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={GREEN} size="large" />
        <Text style={styles.routingText}>Taking you in…</Text>
      </View>
    )
  }

  if (!fontsLoaded || !authLoaded) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    )
  }

  const pillTranslate = segmentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PILL_W + 4],
  })
  const pillScale = segmentAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.035, 1],
  })
  const loginOpacity = formSlide.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 0.15, 0],
  })
  const loginX = formSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -24],
  })
  const signupOpacity = formSlide.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0.15, 1],
  })
  const signupX = formSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  })
  const offlineY = offlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-48, 0],
  })

  const maskedEmail =
    flow === 'verify-signup'
      ? signupEmail.trim() || 'your email'
      : loginEmail.trim() || 'your email'
  const showMainAuth = flow === 'auth'

  const heroTitle =
    flow === 'verify-signup' || flow === 'verify-2fa'
      ? 'Verify email'
      : flow === 'forgot' || flow === 'forgot-code'
        ? 'Reset password'
        : flow === 'reset-pw'
          ? 'New password'
          : mode === 'login'
            ? 'Login to Plazore'
            : 'Join Plazore'

  const heroSub =
    flow === 'verify-signup' || flow === 'verify-2fa'
      ? `Enter the code we sent to ${maskedEmail}`
      : flow === 'forgot'
        ? 'Enter your account email. We’ll send a reset code.'
        : flow === 'forgot-code'
          ? `Enter the code sent to ${maskedEmail}`
          : flow === 'reset-pw'
            ? 'Choose a strong password (min. 8 characters).'
            : mode === 'login'
              ? 'Email, password, or Google — enter the showroom.'
              : 'Create your account and enter the showroom.'

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('@/assets/auth-logo.jpg')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(5,8,12,0.55)',
            'rgba(9,11,15,0.72)',
            'rgba(6,20,18,0.88)',
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.offlineBanner,
            { opacity: offlineAnim, transform: [{ translateY: offlineY }] },
          ]}
        >
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={styles.offlineText}>No internet connection</Text>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces
            keyboardDismissMode="on-drag"
          >
            <Animated.View
              style={{
                opacity: contentFade,
                transform: [
                  {
                    translateY: contentFade.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.topRow}>
                <Image
                  source={require('@/assets/logo-4.png')}
                  style={styles.topLogo}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.hero}>
                <View style={styles.stickerOuter}>
                  <View style={styles.stickerMid}>
                    <View style={styles.stickerInner}>
                      <Image
                        source={require('@/assets/logo-1.png')}
                        style={styles.heroIcon}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                </View>
                <Text style={styles.heroTitle}>{heroTitle}</Text>
                <Text style={styles.heroSub}>{heroSub}</Text>
              </View>

              {fieldError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
                  <Text style={styles.errorText}>{fieldError}</Text>
                </View>
              ) : null}

              {/* ── MAIN LOGIN / SIGNUP ── */}
              {showMainAuth && (
                <>
                  <View style={styles.segmentTrack}>
                    <Animated.View
                      style={[
                        styles.segmentPill,
                        {
                          transform: [
                            { translateX: pillTranslate },
                            { scale: pillScale },
                          ],
                        },
                      ]}
                    />
                    <Pressable
                      style={styles.segmentBtn}
                      onPress={() => switchMode('login')}
                    >
                      <Text
                        style={[
                          styles.segmentLabel,
                          mode === 'login' && styles.segmentLabelActive,
                        ]}
                      >
                        Login
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.segmentBtn}
                      onPress={() => switchMode('signup')}
                    >
                      <Text
                        style={[
                          styles.segmentLabel,
                          mode === 'signup' && styles.segmentLabelActive,
                        ]}
                      >
                        Sign Up
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.formStack}>
                    {/* LOGIN — own email/password state */}
                    <Animated.View
                      pointerEvents={mode === 'login' ? 'auto' : 'none'}
                      style={[
                        styles.formPanel,
                        {
                          opacity: loginOpacity,
                          transform: [{ translateX: loginX }],
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.field,
                          emailFocused && mode === 'login' && styles.fieldFocused,
                        ]}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={
                            emailFocused && mode === 'login'
                              ? GREEN
                              : 'rgba(255,255,255,0.5)'
                          }
                          style={styles.fieldIcon}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Enter your email"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          textContentType="emailAddress"
                          autoComplete="email"
                          importantForAutofill="yes"
                          returnKeyType="next"
                          value={loginEmail}
                          onChangeText={(t) => {
                            setLoginEmail(t)
                            setFieldError(null)
                          }}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                          onSubmitEditing={() => loginPassRef.current?.focus()}
                          blurOnSubmit={false}
                        />
                      </View>

                      <View
                        style={[
                          styles.field,
                          passFocused && mode === 'login' && styles.fieldFocused,
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={
                            passFocused && mode === 'login'
                              ? GREEN
                              : 'rgba(255,255,255,0.5)'
                          }
                          style={styles.fieldIcon}
                        />
                        <TextInput
                          ref={loginPassRef}
                          style={[styles.input, { flex: 1 }]}
                          placeholder="Password"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          secureTextEntry={!showLoginPass}
                          textContentType="password"
                          autoComplete="password"
                          importantForAutofill="yes"
                          returnKeyType="go"
                          value={loginPassword}
                          onChangeText={(t) => {
                            setLoginPassword(t)
                            setFieldError(null)
                          }}
                          onFocus={() => setPassFocused(true)}
                          onBlur={() => setPassFocused(false)}
                          onSubmitEditing={onLoginPress}
                        />
                        <Pressable
                          onPress={() => setShowLoginPass((v) => !v)}
                          hitSlop={10}
                          style={styles.eye}
                        >
                          <Ionicons
                            name={
                              showLoginPass ? 'eye-off-outline' : 'eye-outline'
                            }
                            size={20}
                            color="rgba(255,255,255,0.5)"
                          />
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => {
                          setFieldError(null)
                          setFlow('forgot')
                        }}
                        style={styles.forgotLink}
                        hitSlop={8}
                      >
                        <Text style={styles.forgotLinkText}>
                          Forgot password?
                        </Text>
                      </Pressable>

                      <TouchableOpacity
                        onPress={onLoginPress}
                        disabled={loading || routingOut}
                        activeOpacity={0.88}
                        style={styles.ctaOuter}
                      >
                        <LinearGradient
                          colors={[GREEN, '#14B8A6', BLUE]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.cta}
                        >
                          {loading && mode === 'login' ? (
                            <ActivityIndicator color="#041412" />
                          ) : (
                            <Text style={styles.ctaText}>Log in</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>Or continue with</Text>
                        <View style={styles.dividerLine} />
                      </View>

                      <TouchableOpacity
                        onPress={onGoogle}
                        disabled={oauthLoading || routingOut}
                        activeOpacity={0.9}
                        style={styles.googleBtn}
                      >
                        {oauthLoading && mode === 'login' ? (
                          <ActivityIndicator color="#3C4043" />
                        ) : (
                          <>
                            <Image
                              source={{ uri: GOOGLE_G }}
                              style={styles.googleLogo}
                              resizeMode="contain"
                            />
                            <Text style={styles.googleText}>
                              Continue with Google
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </Animated.View>

                    {/* SIGN UP — own email/password state */}
                    <Animated.View
                      pointerEvents={mode === 'signup' ? 'auto' : 'none'}
                      style={[
                        styles.formPanel,
                        styles.formPanelAbsolute,
                        {
                          opacity: signupOpacity,
                          transform: [{ translateX: signupX }],
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.field,
                          emailFocused &&
                            mode === 'signup' &&
                            styles.fieldFocused,
                        ]}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={
                            emailFocused && mode === 'signup'
                              ? GREEN
                              : 'rgba(255,255,255,0.5)'
                          }
                          style={styles.fieldIcon}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Enter your email"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          textContentType="emailAddress"
                          autoComplete="email"
                          importantForAutofill="yes"
                          returnKeyType="next"
                          value={signupEmail}
                          onChangeText={(t) => {
                            setSignupEmail(t)
                            setFieldError(null)
                          }}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                          onSubmitEditing={() => passwordRef.current?.focus()}
                          blurOnSubmit={false}
                        />
                      </View>

                      <View
                        style={[
                          styles.field,
                          passFocused &&
                            mode === 'signup' &&
                            styles.fieldFocused,
                          { marginBottom: 18 },
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={
                            passFocused && mode === 'signup'
                              ? GREEN
                              : 'rgba(255,255,255,0.5)'
                          }
                          style={styles.fieldIcon}
                        />
                        <TextInput
                          ref={passwordRef}
                          style={[styles.input, { flex: 1 }]}
                          placeholder="Min. 8 characters"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          secureTextEntry={!showSignupPass}
                          textContentType="newPassword"
                          autoComplete="password-new"
                          importantForAutofill="yes"
                          passwordRules="minlength: 8;"
                          returnKeyType="go"
                          value={signupPassword}
                          onChangeText={(t) => {
                            setSignupPassword(t)
                            setFieldError(null)
                          }}
                          onFocus={() => setPassFocused(true)}
                          onBlur={() => setPassFocused(false)}
                          onSubmitEditing={onSignUpPress}
                        />
                        <Pressable
                          onPress={() => setShowSignupPass((v) => !v)}
                          hitSlop={10}
                          style={styles.eye}
                        >
                          <Ionicons
                            name={
                              showSignupPass ? 'eye-off-outline' : 'eye-outline'
                            }
                            size={20}
                            color="rgba(255,255,255,0.5)"
                          />
                        </Pressable>
                      </View>

                      <TouchableOpacity
                        onPress={onSignUpPress}
                        disabled={loading}
                        activeOpacity={0.88}
                        style={styles.ctaOuter}
                      >
                        <LinearGradient
                          colors={[GREEN, '#14B8A6', BLUE]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.cta}
                        >
                          {loading && mode === 'signup' ? (
                            <ActivityIndicator color="#041412" />
                          ) : (
                            <Text style={styles.ctaText}>Continue</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>Or sign up with</Text>
                        <View style={styles.dividerLine} />
                      </View>

                      <TouchableOpacity
                        onPress={onGoogle}
                        disabled={oauthLoading || routingOut}
                        activeOpacity={0.9}
                        style={styles.googleBtn}
                      >
                        {oauthLoading && mode === 'signup' ? (
                          <ActivityIndicator color="#3C4043" />
                        ) : (
                          <>
                            <Image
                              source={{ uri: GOOGLE_G }}
                              style={styles.googleLogo}
                              resizeMode="contain"
                            />
                            <Text style={styles.googleText}>
                              Continue with Google
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </>
              )}

              {/* ── VERIFY (signup or 2FA) ── */}
              {(flow === 'verify-signup' || flow === 'verify-2fa') && (
                <>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="123456"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    importantForAutofill="yes"
                    value={code}
                    onChangeText={(t) => {
                      setCode(t)
                      setFieldError(null)
                    }}
                    maxLength={6}
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={
                      flow === 'verify-signup'
                        ? onSignUpVerify
                        : onLogin2faVerify
                    }
                    disabled={loading}
                    activeOpacity={0.88}
                    style={styles.ctaOuter}
                  >
                    <LinearGradient
                      colors={[GREEN, '#14B8A6', BLUE]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.cta}
                    >
                      {loading ? (
                        <ActivityIndicator color="#041412" />
                      ) : (
                        <Text style={styles.ctaText}>
                          {flow === 'verify-signup'
                            ? 'Verify & continue'
                            : 'Verify'}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  <Pressable onPress={backToAuth} style={styles.backToForm}>
                    <Text style={styles.backToFormText}>Back</Text>
                  </Pressable>
                </>
              )}

              {/* ── FORGOT: email (login email only) ── */}
              {flow === 'forgot' && (
                <>
                  <View
                    style={[
                      styles.field,
                      emailFocused && styles.fieldFocused,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={emailFocused ? GREEN : 'rgba(255,255,255,0.5)'}
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Account email"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      value={loginEmail}
                      onChangeText={(t) => {
                        setLoginEmail(t)
                        setFieldError(null)
                      }}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      onSubmitEditing={onForgotSend}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    onPress={onForgotSend}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={styles.ctaOuter}
                  >
                    <LinearGradient
                      colors={[GREEN, '#14B8A6', BLUE]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.cta}
                    >
                      {loading ? (
                        <ActivityIndicator color="#041412" />
                      ) : (
                        <Text style={styles.ctaText}>Send reset code</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  <Pressable onPress={backToAuth} style={styles.backToForm}>
                    <Text style={styles.backToFormText}>Back to login</Text>
                  </Pressable>
                </>
              )}

              {/* ── FORGOT: code ── */}
              {flow === 'forgot-code' && (
                <>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="123456"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    value={code}
                    onChangeText={(t) => {
                      setCode(t)
                      setFieldError(null)
                    }}
                    maxLength={6}
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={onForgotVerifyCode}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={styles.ctaOuter}
                  >
                    <LinearGradient
                      colors={[GREEN, '#14B8A6', BLUE]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.cta}
                    >
                      {loading ? (
                        <ActivityIndicator color="#041412" />
                      ) : (
                        <Text style={styles.ctaText}>Verify code</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  <Pressable
                    onPress={() => setFlow('forgot')}
                    style={styles.backToForm}
                  >
                    <Text style={styles.backToFormText}>
                      Resend / change email
                    </Text>
                  </Pressable>
                </>
              )}

              {/* ── RESET PASSWORD ── */}
              {flow === 'reset-pw' && (
                <>
                  <View style={styles.field}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color="rgba(255,255,255,0.5)"
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="New password (min. 8)"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      secureTextEntry={!showNewPass}
                      textContentType="newPassword"
                      autoComplete="password-new"
                      value={newPassword}
                      onChangeText={(t) => {
                        setNewPassword(t)
                        setFieldError(null)
                      }}
                      autoFocus
                    />
                    <Pressable
                      onPress={() => setShowNewPass((v) => !v)}
                      hitSlop={10}
                      style={styles.eye}
                    >
                      <Ionicons
                        name={showNewPass ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="rgba(255,255,255,0.5)"
                      />
                    </Pressable>
                  </View>
                  <View style={[styles.field, { marginBottom: 18 }]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color="rgba(255,255,255,0.5)"
                      style={styles.fieldIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      secureTextEntry={!showNewPass}
                      textContentType="newPassword"
                      value={confirmPassword}
                      onChangeText={(t) => {
                        setConfirmPassword(t)
                        setFieldError(null)
                      }}
                      onSubmitEditing={onResetPassword}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={onResetPassword}
                    disabled={loading}
                    activeOpacity={0.88}
                    style={styles.ctaOuter}
                  >
                    <LinearGradient
                      colors={[GREEN, '#14B8A6', BLUE]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.cta}
                    >
                      {loading ? (
                        <ActivityIndicator color="#041412" />
                      ) : (
                        <Text style={styles.ctaText}>Update password</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  <Pressable onPress={backToAuth} style={styles.backToForm}>
                    <Text style={styles.backToFormText}>Back to login</Text>
                  </Pressable>
                </>
              )}

              <View style={{ height: 200 }} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090B0F' },
  safe: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  routingText: {
    marginTop: 14,
    color: TEXT_DIM,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
    flexGrow: 1,
  },

  offlineBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 24,
    right: 24,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  offlineText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: '#FECACA',
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },

  topRow: { alignItems: 'center', marginBottom: 8 },
  topLogo: { height: 40, width: 160 },

  hero: { alignItems: 'center', marginTop: 12, marginBottom: 22 },
  stickerOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  stickerMid: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#17181c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: { width: 38, height: 38 },
  heroTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    color: TEXT,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroSub: {
    marginTop: 8,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },

  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 4,
    marginBottom: 22,
    height: 54,
    position: 'relative',
  },
  segmentPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: PILL_W,
    height: 46,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  segmentLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
  },
  segmentLabelActive: { color: '#0B1220' },

  formStack: { minHeight: 340, marginBottom: 8 },
  formPanel: { width: '100%' },
  formPanelAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 12,
  },
  fieldFocused: {
    borderColor: GREEN,
    backgroundColor: 'rgba(0,229,117,0.06)',
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: TEXT,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    paddingVertical: 0,
  },
  eye: { padding: 6 },

  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    marginTop: -2,
  },
  forgotLinkText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: GREEN,
  },

  ctaOuter: { overflow: 'hidden' },
  cta: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    color: '#041412',
    letterSpacing: 0.3,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dividerText: {
    marginHorizontal: 12,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: TEXT_DIM,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleLogo: { width: 20, height: 20 },
  googleText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#3C4043',
  },

  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 18,
    paddingHorizontal: 14,
    color: TEXT,
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    letterSpacing: 10,
    textAlign: 'center',
    marginBottom: 20,
  },
  backToForm: { alignItems: 'center', marginTop: 16 },
  backToFormText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: GREEN,
  },
})