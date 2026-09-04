/**
 * Buyer Settings — Plazore dark
 */

import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  onPress: () => void
  last?: boolean
  accent?: boolean
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  last,
  accent,
}: RowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.row, !last && styles.rowBorder]}
    >
      <View style={[styles.rowIcon, accent && styles.rowIconAccent]}>
        <Ionicons name={icon} size={18} color={accent ? GREEN : TEXT} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={MUTED} />
    </TouchableOpacity>
  )
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  useTheme()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back()
            else router.replace('/(tabs)' as any)
          }}
          style={styles.backBtn}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>Account & marketplace</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <LinearGradient
            colors={['rgba(0,229,117,0.12)', 'rgba(59,130,246,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.introIcon}
          >
            <Ionicons name="options-outline" size={18} color={GREEN} />
          </LinearGradient>
          <Text style={styles.introText}>
            Manage your account, marketplace, and support — calm, clear, one
            place.
          </Text>
        </View>

        {/* Account */}
        <SettingsSection title="Account">
          <SettingsRow
            icon="person-outline"
            title="Profile"
            subtitle="Name, photo, account details"
            onPress={() => router.push('/settings/profile' as any)}
            accent
          />
          <SettingsRow
            icon="globe-outline"
            title="Marketplace region"
            subtitle="Currency & catalog for your market"
            onPress={() => router.push('/settings/region' as any)}
          />
          <SettingsRow
            icon="location-outline"
            title="Addresses"
            subtitle="Delivery locations for orders"
            onPress={() => router.push('/addresses' as any)}
          />
          <SettingsRow
            icon="card-outline"
            title="Payment methods"
            subtitle="Saved cards for checkout"
            onPress={() => router.push('/payment-methods' as any)}
          />
          <SettingsRow
            icon="bag-handle-outline"
            title="Orders"
            subtitle="Purchases & delivery"
            onPress={() => router.push('/orders' as any)}
            last
          />
        </SettingsSection>

        {/* Preferences */}
        <SettingsSection title="Preferences">
          <SettingsRow
            icon="musical-notes-outline"
            title="Ambient soundtrack"
            subtitle="Immerse yourself in the Plazore atmosphere"
            onPress={() => router.push('/settings/music' as any)}
            last
          />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="Privacy & security">
          <SettingsRow
            icon="lock-closed-outline"
            title="Privacy"
            subtitle="Data and visibility preferences"
            onPress={() => router.push('/settings/privacy' as any)}
            last
          />
        </SettingsSection>

        {/* Plazore */}
        <SettingsSection title="Plazore">
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            title="Contact Plazore"
            subtitle="Support, feedback, and help"
            onPress={() => router.push('/contact' as any)}
            accent
          />
          <SettingsRow
            icon="information-circle-outline"
            title="About Plazore"
            subtitle="What Plazore is and app info"
            onPress={() => router.push('/settings/about' as any)}
            last
          />
        </SettingsSection>

        <Text style={styles.footer}>Plazore · Premium Digital Mall</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 11,
    color: MUTED,
  },
  headerRight: {
    width: 42,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 48,
  },

  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 14,
    marginBottom: 22,
  },
  introIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: SECONDARY,
  },

  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  sectionCard: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  rowIcon: {
    width: 38,
    height: 38,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowIconAccent: {
    backgroundColor: 'rgba(0,229,117,0.1)',
    borderColor: 'rgba(0,229,117,0.22)',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  rowSub: {
    fontSize: 12,
    color: SECONDARY,
    marginTop: 2,
    lineHeight: 17,
  },

  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: MUTED,
    marginTop: 8,
    letterSpacing: 0.6,
  },
})