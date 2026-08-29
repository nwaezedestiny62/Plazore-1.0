/**
 * Profile — Plazore style (no media background)
 */

import api from '@/constants/api'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
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
const DANGER = '#F97066'

const MENU = [
  {
    id: 'messages',
    title: 'Messages',
    subtitle: 'Product conversations',
    icon: 'chatbubbles-outline' as const,
    route: '/messages',
  },
  {
    id: 'orders',
    title: 'Orders',
    subtitle: 'Purchases & delivery',
    icon: 'cube-outline' as const,
    route: '/orders',
  },
  {
    id: 'addresses',
    title: 'Addresses',
    subtitle: 'Shipping locations',
    icon: 'location-outline' as const,
    route: '/addresses',
  },
  {
    id: 'payment-methods',
    title: 'Payment Methods',
    subtitle: 'Cards & billing',
    icon: 'card-outline' as const,
    route: '/payment-methods',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Orders & alerts',
    icon: 'notifications-outline' as const,
    route: '/notifications',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Account & preferences',
    icon: 'settings-outline' as const,
    route: '/settings',
  },
]

function MenuToggle({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 90,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }).start()
      }
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel="Open navigation"
      style={styles.menuHit}
    >
      <Animated.View style={[styles.menuLines, { transform: [{ scale }] }]}>
        <View style={[styles.menuLine, { width: 22 }]} />
        <View style={[styles.menuLine, { width: 15 }]} />
        <View style={[styles.menuLine, { width: 22 }]} />
      </Animated.View>
    </Pressable>
  )
}

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
      <Text style={styles.loaderLabel}>Loading profile…</Text>
    </View>
  )
}

function Badge({ value }: { value: number }) {
  if (value <= 0) return null
  const label = value > 99 ? '99+' : String(value)
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  )
}

export default function Profile() {
  const { user, signOut } = useClerk()
  const { user: clerkUser } = useUser()
  const { getToken, isSignedIn } = useAuth()
  const router = useRouter()

  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  const [hubOpen, setHubOpen] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [booting, setBooting] = useState(true)
  const [storeLogo, setStoreLogo] = useState<string | null>(null)

  const inFlight = useRef(false)
  const role = (clerkUser?.publicMetadata?.role as string) || 'buyer'

  const fetchUnread = useCallback(async () => {
    if (!isSignedIn) {
      setUnreadNotifs(0)
      setUnreadMessages(0)
      setBooting(false)
      return
    }
    if (inFlight.current) return
    inFlight.current = true

    try {
      const token = await getTokenRef.current()
      if (!token) {
        setUnreadNotifs(0)
        setUnreadMessages(0)
        return
      }

      try {
        const res = await api.get('/notifications', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 12000,
        })
        if (res.data?.success && Array.isArray(res.data.data)) {
          setUnreadNotifs(res.data.data.filter((x: any) => !x.isRead).length)
        } else {
          setUnreadNotifs(0)
        }
      } catch {
        setUnreadNotifs(0)
      }

      try {
        const chatRes = await api.get('/chat/conversations', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 12000,
        })
        if (chatRes.data?.success && Array.isArray(chatRes.data.data)) {
          const total = chatRes.data.data.reduce((sum: number, conv: any) => {
            const myRole = conv.myRole as 'buyer' | 'seller' | null | undefined
            if (myRole === 'buyer') return sum + (conv.unreadByBuyer || 0)
            if (myRole === 'seller') return sum + (conv.unreadBySeller || 0)
            return sum + (conv.unreadByBuyer || 0)
          }, 0)
          setUnreadMessages(total)
        } else {
          setUnreadMessages(0)
        }
      } catch {
        setUnreadMessages(0)
      }
    } finally {
      inFlight.current = false
      setBooting(false)
    }
  }, [isSignedIn])

  useFocusEffect(
    useCallback(() => {
      fetchUnread()
    }, [fetchUnread])
  )

  useEffect(() => {
    if (role !== 'seller' || !isSignedIn) {
      setStoreLogo(null)
      return
    }

    let alive = true

    ;(async () => {
      try {
        const token = await getTokenRef.current()
        if (!token) return

        const endpoints = [
          '/seller/store',
          '/seller/me',
          '/users/me',
          '/users/profile',
        ]

        for (const ep of endpoints) {
          try {
            const res = await api.get(ep, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10000,
            })
            const data = res.data?.data || res.data
            const logo =
              data?.storeLogo || data?.store?.storeLogo || data?.logo || null
            if (logo && alive) {
              setStoreLogo(String(logo))
              return
            }
          } catch {
            // try next
          }
        }
        if (alive) setStoreLogo(null)
      } catch {
        if (alive) setStoreLogo(null)
      }
    })()

    return () => {
      alive = false
    }
  }, [role, isSignedIn])

  const handleLogout = async () => {
    await signOut()
    router.replace('/(auth)/sign-in')
  }

  if (booting && isSignedIn) {
    return <StorePreloader />
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MenuToggle onPress={() => setHubOpen(true)} />
            <View>
              <Text style={styles.kicker}>Account</Text>
              <Text style={styles.title}>Profile</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              activeOpacity={0.85}
              style={styles.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={TEXT} />
              {unreadNotifs > 0 && (
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>
                    {unreadNotifs > 99 ? '99+' : unreadNotifs}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/settings' as any)}
              activeOpacity={0.85}
              style={styles.iconBtn}
            >
              <Ionicons name="settings-outline" size={20} color={TEXT} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          bounces
        >
          {!user ? (
            <View style={styles.guestCard}>
              <View style={styles.guestAvatar}>
                <Ionicons name="person-outline" size={32} color={MUTED} />
              </View>
              <Text style={styles.guestTitle}>Welcome to Plazore</Text>
              <Text style={styles.guestBody}>
                Sign in to manage orders, messages, and your account.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/sign-in')}
                activeOpacity={0.9}
                style={styles.guestCtaOuter}
              >
                <LinearGradient
                  colors={[GREEN, '#14B8A6', BLUE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.guestCta}
                >
                  <Text style={styles.guestCtaText}>Sign in</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Identity */}
              <View style={styles.identity}>
                <View style={styles.avatarWrap}>
                  {user.imageUrl ? (
                    <Image
                      source={{ uri: user.imageUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Ionicons name="person" size={28} color={MUTED} />
                    </View>
                  )}
                  {role === 'seller' && (
                    <View style={styles.sellerMark}>
                      <Ionicons
                        name="shield-checkmark"
                        size={12}
                        color={GREEN}
                      />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={[
                      styles.rolePill,
                      role === 'seller' && styles.rolePillSeller,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        role === 'seller' && styles.roleTextSeller,
                      ]}
                    >
                      {role === 'seller' ? 'Seller' : 'Member'}
                    </Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {user.fullName || user.firstName || 'Member'}
                  </Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {user.primaryEmailAddress?.emailAddress ||
                      user.emailAddresses?.[0]?.emailAddress}
                  </Text>
                </View>
              </View>

              {/* Seller / Buyer CTA */}
              {role === 'buyer' ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/seller-register' as any)}
                  style={styles.ctaCard}
                >
                  <View style={styles.ctaIcon}>
                    <Ionicons
                      name="storefront-outline"
                      size={22}
                      color={GREEN}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ctaTitle}>Become a Seller</Text>
                    <Text style={styles.ctaSub}>
                      Open your storefront on Plazore
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={MUTED} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/seller' as any)}
                  style={styles.ctaActiveOuter}
                >
                  <LinearGradient
                    colors={[GREEN, '#14B8A6', BLUE]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaCardActive}
                  >
                    <View style={styles.ctaIconActive}>
                      {storeLogo ? (
                        <Image
                          source={{ uri: storeLogo }}
                          style={styles.ctaStoreLogo}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="storefront" size={20} color={BG} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ctaTitleActive}>Seller Storefront</Text>
                      <Text style={styles.ctaSubActive}>
                        Products, orders & chats
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={BG} />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Quick Access */}
              <Text style={styles.sectionLabel}>Quick access</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity
                  onPress={() => router.push('/messages' as any)}
                  activeOpacity={0.85}
                  style={styles.quickTile}
                >
                  <View style={styles.quickIconWrap}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={20}
                      color={TEXT}
                    />
                    <Badge value={unreadMessages} />
                  </View>
                  <Text style={styles.quickTitle}>Messages</Text>
                  <Text style={styles.quickSub}>Inbox</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/orders')}
                  activeOpacity={0.85}
                  style={styles.quickTile}
                >
                  <View style={styles.quickIconWrap}>
                    <Ionicons name="cube-outline" size={20} color={TEXT} />
                  </View>
                  <Text style={styles.quickTitle}>Orders</Text>
                  <Text style={styles.quickSub}>Track</Text>
                </TouchableOpacity>
              </View>

              {/* Account menu */}
              <Text style={styles.sectionLabel}>Account</Text>
              <View style={styles.menuCard}>
                {MENU.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.85}
                    style={[
                      styles.menuRow,
                      index < MENU.length - 1 && styles.menuRowBorder,
                    ]}
                  >
                    <View style={styles.menuIcon}>
                      <Ionicons name={item.icon} size={18} color={TEXT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuTitle}>{item.title}</Text>
                      <Text style={styles.menuSub}>{item.subtitle}</Text>
                    </View>

                    {item.id === 'messages' && (
                      <Badge value={unreadMessages} />
                    )}
                    {item.id === 'notifications' && (
                      <Badge value={unreadNotifs} />
                    )}

                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={MUTED}
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sign out */}
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.85}
                style={styles.logoutBtn}
              >
                <Ionicons name="log-out-outline" size={18} color={DANGER} />
                <Text style={styles.logoutText}>Sign out</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <PlazoreNavigationHub
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  menuHit: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLines: {
    width: 22,
    gap: 5.5,
    alignItems: 'flex-start',
  },
  menuLine: {
    height: 2.6,
    backgroundColor: TEXT,
  },

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
  orbLogo: {
    width: 32,
    height: 32,
  },
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  iconBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    backgroundColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '800',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
  },

  guestCard: {
    marginTop: 24,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 28,
    alignItems: 'center',
  },
  guestAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  guestTitle: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  guestBody: {
    color: SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  guestCtaOuter: {
    marginTop: 22,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  guestCta: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  guestCtaText: {
    color: '#041412',
    fontWeight: '800',
    fontSize: 15,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SURFACE_2,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerMark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  rolePillSeller: {
    backgroundColor: 'rgba(0,229,117,0.1)',
    borderColor: 'rgba(0,229,117,0.35)',
  },
  roleText: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  roleTextSeller: {
    color: GREEN,
  },
  name: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  email: {
    color: SECONDARY,
    fontSize: 13,
    marginTop: 2,
  },

  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    gap: 12,
    marginBottom: 22,
  },
  ctaActiveOuter: {
    marginBottom: 22,
    overflow: 'hidden',
  },
  ctaCardActive: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0,229,117,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconActive: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(9,11,15,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaStoreLogo: {
    width: 44,
    height: 44,
  },
  ctaTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  ctaTitleActive: {
    color: BG,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSubActive: {
    color: 'rgba(9,11,15,0.65)',
    fontSize: 12,
    marginTop: 2,
  },

  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  quickTile: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  quickTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  quickSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },

  menuCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: 22,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  menuIcon: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  menuSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },

  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    backgroundColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  badgeText: {
    color: TEXT,
    fontSize: 10,
    fontWeight: '800',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(249,112,102,0.35)',
    backgroundColor: 'rgba(249,112,102,0.08)',
    paddingVertical: 14,
  },
  logoutText: {
    color: DANGER,
    fontSize: 14,
    fontWeight: '700',
  },
})