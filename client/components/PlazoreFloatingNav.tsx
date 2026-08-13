import { Ionicons } from '@expo/vector-icons'
import { useCart } from '@/context/CartContext'
import { useShowroomFlyCart } from '@/components/showroom/ShowroomFlyCart'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import { usePathname, useRouter } from 'expo-router'
import React, { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const MUTED = 'rgba(242,244,248,0.4)'
const ACTIVE = '#FFFFFF'
const WISH = '#F472B6'
const CART_C = '#00E575'
const EASE = Easing.bezier(0.22, 1, 0.36, 1)
const SPRING = Easing.bezier(0.34, 1.4, 0.64, 1)

type Props = { visibleProgress: number; onMenuPress: () => void }

export default function PlazoreFloatingNav({ visibleProgress, onMenuPress }: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()
  const fly = useShowroomFlyCart()

  const cartCtx = useCart() as any
  const itemCount = cartCtx?.itemCount ?? 0
  const cartItems = cartCtx?.cart ?? cartCtx?.items ?? []

  const anim = useRef(new Animated.Value(0)).current
  const bounce = useRef(new Animated.Value(1)).current
  const pulse = useRef(new Animated.Value(0)).current
  const glow = useRef(new Animated.Value(0)).current
  const badgePop = useRef(new Animated.Value(1)).current
  const prev = useRef(itemCount)
  const bagRef = useRef<View>(null)

  const chips = (Array.isArray(cartItems) ? cartItems : []).slice(-3).reverse()

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(1, Math.max(0, visibleProgress)),
      duration: 320,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [visibleProgress])

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  useEffect(() => {
    if (itemCount > prev.current) {
      bounce.setValue(1)
      pulse.setValue(0)
      badgePop.setValue(0.6)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounce, {
            toValue: 1.32,
            duration: 130,
            easing: Easing.out(Easing.back(2.2)),
            useNativeDriver: true,
          }),
          Animated.timing(bounce, {
            toValue: 1,
            duration: 220,
            easing: EASE,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 340,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(badgePop, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
    prev.current = itemCount
  }, [itemCount])

  const measureBag = () => {
    bagRef.current?.measureInWindow((x, y, w, h) => {
      fly?.registerTarget?.(x + w / 2, y + h / 2)
    })
  }

  const opacity = anim.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, 0, 1],
  })
  const ty = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [56, 0],
  })
  const scaleIn = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  })
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.1],
  })
  const pulseOp = pulse.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.5, 0],
  })
  const glowOp = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.75],
  })

  const go = (h: string) => {
    try {
      router.push(h as any)
    } catch {}
  }

  const isHome =
    pathname === '/' ||
    pathname?.endsWith('/index') ||
    pathname === '/(tabs)'
  const isSearch = pathname?.includes('search')
  const isShowroom = pathname?.includes('showroom')
  const isCart = pathname?.includes('cart')
  const floor = Math.max(insets.bottom, 6)
  const hidden = visibleProgress < 0.08

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.wrap,
        {
          paddingBottom: floor,
          opacity,
          transform: [{ translateY: ty }, { scale: scaleIn }],
        },
      ]}
    >
      {/* Outer soft glow rim */}
      <View style={styles.rim} pointerEvents="none" />

      <View style={styles.bar}>
        {/* top highlight line */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(255,255,255,0.14)',
            'rgba(255,255,255,0.22)',
            'rgba(255,255,255,0.14)',
            'transparent',
          ]}
          locations={[0, 0.2, 0.5, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topLine}
          pointerEvents="none"
        />

        <Nav
          icon={isHome ? 'storefront' : 'storefront-outline'}
          label="Mall"
          active={!!isHome}
          onPress={() => go('/(tabs)')}
        />
        <Nav
          icon={isSearch ? 'search' : 'search-outline'}
          label="Browse"
          active={!!isSearch}
          onPress={() => go('/(tabs)/search')}
        />

        {/* Center Lounge — hero */}
        <Pressable onPress={onMenuPress} style={styles.center}>
          <Animated.View style={[styles.glow, { opacity: glowOp }]} />
          <View style={styles.depth} />
          <LinearGradient
            colors={['#00E8D8', '#00D4C8', '#3A5BFF', '#6366F1']}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={styles.centerBtn}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'transparent']}
              style={styles.centerSheen}
              pointerEvents="none"
            />
            <View style={styles.hi} />
            <Ionicons name="grid" size={22} color="#fff" />
          </LinearGradient>
          <Text style={styles.cl}>Lounge</Text>
        </Pressable>

        {/* Cart */}
        <Pressable onPress={() => go('/(tabs)/cart')} style={styles.item}>
          <View
            ref={bagRef}
            collapsable={false}
            onLayout={measureBag}
            style={styles.cartWrap}
          >
            <Animated.View style={{ transform: [{ scale: bounce }] }}>
              <Ionicons
                name={
                  isCart || itemCount > 0 ? 'bag-handle' : 'bag-handle-outline'
                }
                size={24}
                color={itemCount > 0 || isCart ? CART_C : MUTED}
              />
            </Animated.View>

            {itemCount > 0 && (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.ring,
                    {
                      opacity: pulseOp,
                      transform: [{ scale: pulseScale }],
                    },
                  ]}
                />
                <Animated.View
                  style={[styles.badge, { transform: [{ scale: badgePop }] }]}
                >
                  <Text style={styles.badgeT}>
                    {itemCount > 99 ? '99+' : itemCount}
                  </Text>
                </Animated.View>
              </>
            )}

            {chips.length > 0 && (
              <View style={styles.chips}>
                {chips.map((c: any, i: number) => (
                  <View
                    key={c._id || i}
                    style={[
                      styles.chip,
                      {
                        right: i * 12,
                        zIndex: 3 - i,
                        opacity: 1 - i * 0.12,
                      },
                    ]}
                  >
                    {c.images?.[0] || c.image ? (
                      <Image
                        source={{ uri: c.images?.[0] || c.image }}
                        style={styles.chipImg}
                        contentFit="cover"
                        transition={0}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View
                        style={[styles.chipImg, { backgroundColor: '#1F1F1F' }]}
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
          <Text
            style={[
              styles.label,
              (itemCount > 0 || isCart) && styles.labelCart,
            ]}
          >
            Cart
          </Text>
        </Pressable>

        <Nav
  icon={isShowroom ? 'sparkles' : 'sparkles-outline'}
  label="Showroom"
  active={!!isShowroom}
  color="#00D9FF"
  onPress={() => go('/showroom')}
/>
      </View>
    </Animated.View>
  )
}

function Nav({
  icon,
  label,
  active,
  onPress,
  color = ACTIVE,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  active: boolean
  onPress: () => void
  color?: string
}) {
  const s = useRef(new Animated.Value(1)).current
  const ind = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(ind, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: EASE,
      useNativeDriver: true,
    }).start()
  }, [active])

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(s, {
          toValue: 0.88,
          duration: 80,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(s, {
          toValue: 1,
          duration: 160,
          easing: SPRING,
          useNativeDriver: true,
        }).start()
      }
      style={styles.item}
    >
      <Animated.View
        style={{ alignItems: 'center', transform: [{ scale: s }] }}
      >
        <View style={styles.iconSlot}>
          <Ionicons name={icon} size={22} color={active ? color : MUTED} />
          <Animated.View
            style={[
              styles.activeDot,
              {
                backgroundColor: color,
                opacity: ind,
                transform: [
                  {
                    scale: ind.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <Text style={[styles.label, active && { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    paddingHorizontal: 12,
  },
  rim: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    top: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(0,212,200,0.06)',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    backgroundColor: 'rgba(8,9,14,0.97)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
    paddingBottom: 11,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: { elevation: 22 },
    }),
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  iconSlot: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: -1,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 0.3,
  },
  labelCart: {
    color: CART_C,
  },
  center: {
    alignItems: 'center',
    marginTop: -28,
    minWidth: 68,
  },
  glow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(0,212,200,0.28)',
    top: -4,
  },
  depth: {
    position: 'absolute',
    width: 56,
    height: 56,
    backgroundColor: 'rgba(0,0,0,0.55)',
    top: 5,
    left: 6,
    borderRadius: 18,
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#00D4C8',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
      },
      android: { elevation: 18 },
    }),
  },
  centerSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  hi: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  cl: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '800',
    color: ACTIVE,
    letterSpacing: 0.4,
  },
  cartWrap: {
    width: 42,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.8,
    borderColor: CART_C,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: CART_C,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#08090E',
  },
  badgeT: {
    color: '#041412',
    fontSize: 10,
    fontWeight: '800',
  },
  chips: {
    position: 'absolute',
    bottom: -14,
    right: -6,
    height: 18,
    width: 44,
  },
  chip: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    backgroundColor: '#151515',
  },
  chipImg: {
    width: '100%',
    height: '100%',
  },
})