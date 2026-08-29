import { SettingsRow } from '@/components/settings/SettingsRow'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'
const BLUE = '#3B82F6'

function PlazoreOrb({ size = 96 }: { size?: number }) {
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
  const logoBox = size * 0.51
  const logoImg = size * 0.29
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.4,
          borderColor: 'transparent',
          borderTopColor: GREEN,
          borderRightColor: BLUE,
          borderBottomColor: 'transparent',
          borderLeftColor: GREEN,
          transform: [{ rotate }],
        }}
      />
      <View
        style={{
          width: logoBox,
          height: logoBox,
          borderRadius: logoBox / 2,
          backgroundColor: 'rgba(0,229,117,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/logo-1.png')}
          style={{ width: logoImg, height: logoImg }}
          resizeMode="contain"
        />
      </View>
    </View>
  )
}

export default function SellerSettings() {
  const router = useRouter()
  const [booting, setBooting] = useState(true)
  const contentOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const t = setTimeout(() => {
      setBooting(false)
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }, 450)
    return () => clearTimeout(t)
  }, [])

  if (booting) {
    return (
      <View style={styles.loaderRoot}>
        <PlazoreOrb size={100} />
        <Text style={styles.loaderHint}>Seller settings</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back()
            else router.replace('/seller' as any)
          }}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Seller Settings</Text>
          <Text style={styles.subtitle}>Business control center</Text>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <Ionicons name="options-outline" size={18} color={GREEN} />
            </View>
            <Text style={styles.introText}>
              Storefront, catalog, orders, and growth — one calm place. Payout
              stays protected on its own screen.
            </Text>
          </View>

          {/* Store operations */}
          <Text style={styles.sectionLabel}>Store</Text>
          <View style={styles.group}>
            <SettingsRow
              icon="storefront-outline"
              title="Storefront"
              subtitle="Logo, banner, name, and public store page"
              onPress={() => router.push('/seller/store' as any)}
              last
            />
          </View>

          {/* Growth */}
          <Text style={styles.sectionLabel}>Growth</Text>
          <View style={styles.group}>
            <SettingsRow
              icon="sparkles-outline"
              title="Seller plans"
              subtitle="Fees, image limits, and visibility tiers"
              onPress={() => router.push('/seller/subscription' as any)}
            />
          </View>

          {/* Account / identity */}
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.group}>
            <SettingsRow
              icon="card-outline"
              title="Payout & shipping"
              subtitle="Bank account and defaults — last 4 digits required"
              onPress={() => router.push('/seller/settings/payout' as any)}
            />
            <SettingsRow
              icon="person-outline"
              title="Seller identity"
              subtitle="Name, phone, and contact details"
              onPress={() => router.push('/seller/settings/profile' as any)}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="globe-outline"
              title="Marketplace region"
              subtitle="Currency and market for your catalog"
              onPress={() => router.push('/seller/settings/region' as any)}
              last
            />
          </View>

          {/* About */}
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.group}>
            <SettingsRow
              icon="information-circle-outline"
              title="About Plazore Seller"
              subtitle="Version and seller platform information"
              onPress={() => router.push('/seller/settings/about' as any)}
              last
            />
          </View>

          <Text style={styles.footer}>Plazore · Seller Lounge</Text>
        </ScrollView>
      </Animated.View>
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
  loaderHint: {
    marginTop: 14,
    fontSize: 13,
    color: MUTED,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: MUTED,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },

  introCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 22,
  },
  introIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: SECONDARY,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  group: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    marginBottom: 20,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginLeft: 56,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: MUTED,
    letterSpacing: 0.6,
    marginTop: 8,
  },
})