import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
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

/* ── Plazore tokens ── */
const BG = '#090B0F'
const SURFACE = '#11141A'
const SURFACE_2 = '#171B22'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#6B7280'
const GREEN = '#00E575'

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  onPress: () => void
  last?: boolean
}

function SettingsRow({ icon, title, subtitle, onPress, last }: RowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.row, !last && styles.rowBorder]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={TEXT} />
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
  // keep theme hook if other screens depend on it
  useTheme()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Manage your account, marketplace preferences, and privacy in one place.
        </Text>

        <SettingsSection title="Account">
          <SettingsRow
            icon="person-outline"
            title="Profile"
            subtitle="Personal information and account details"
            onPress={() => router.push('/settings/profile' as any)}
          />
          <SettingsRow
            icon="globe-outline"
            title="Marketplace Region"
            subtitle="Choose the marketplace you shop in"
            onPress={() => router.push('/settings/region' as any)}
          />
          <SettingsRow
            icon="location-outline"
            title="Addresses"
            subtitle="Delivery locations for your orders"
            onPress={() => router.push('/addresses' as any)}
          />
          <SettingsRow
            icon="card-outline"
            title="Payment Methods"
            subtitle="Saved cards for checkout"
            onPress={() => router.push('/payment-methods' as any)}
            last
          />
        </SettingsSection>

        <SettingsSection title="Privacy & Security">
          <SettingsRow
            icon="lock-closed-outline"
            title="Privacy"
            subtitle="Data and visibility preferences"
            onPress={() => router.push('/settings/privacy' as any)}
            last
          />
        </SettingsSection>

        <SettingsSection title="Preferences">
  <SettingsRow
    icon="language-outline"
    title="Language"
    subtitle="App display language"
    onPress={() => router.push('/settings/language' as any)}
  />
  <SettingsRow
    icon="musical-notes-outline"
    title="Ambient Music"
    subtitle="Plazore soundtrack and sound preferences"
    onPress={() => router.push('/settings/music' as any)}
    last
  />
</SettingsSection>

        <SettingsSection title="About">
          <SettingsRow
            icon="information-circle-outline"
            title="About Plazore"
            subtitle="Version and application information"
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 42,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },

  intro: {
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    marginBottom: 22,
    marginLeft: 2,
  },

  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  sectionCard: {
    backgroundColor: SURFACE,
    borderRadius: 14,
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
    borderRadius: 10,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    letterSpacing: 0.5,
  },
})