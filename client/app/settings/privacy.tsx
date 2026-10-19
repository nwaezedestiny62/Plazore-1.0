/**
 * Privacy settings — Plazore mobile
 * Clean, calm, on-brand.
 */

import { useTheme } from '@/context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const GREEN = '#00E575'
const BLUE = '#3B82F6'

export default function PrivacySettings() {
  const router = useRouter()
  const { colors } = useTheme()
  const [showPolicy, setShowPolicy] = useState(false)

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(0,229,117,0.14)', 'rgba(59,130,246,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroIcon}
          >
            <Ionicons name="shield-checkmark" size={26} color={GREEN} />
          </LinearGradient>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Your data, your choice
          </Text>
          <Text style={[styles.heroBody, { color: colors.muted }]}>
            Plazore only uses what is needed to run your account, checkout, and
            orders. We do not sell personal data.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Your data</Text>
        <View style={[styles.card, { backgroundColor: colors.card || '#11141A', borderColor: 'rgba(255,255,255,0.07)' }]}>
          <Row
            icon="lock-closed-outline"
            title="Essential"
            subtitle="Sign-in, security, cart, and orders — always on."
            color={colors.text}
            muted={colors.muted}
            badge="Required"
          />
          <View style={styles.divider} />
          <Row
            icon="analytics-outline"
            title="How we use data"
            subtitle="Account details, delivery addresses, and order history power the marketplace only."
            color={colors.text}
            muted={colors.muted}
          />
          <View style={styles.divider} />
          <Row
            icon="eye-outline"
            title="Account visibility"
            subtitle="Coming soon — control what others can see on your profile."
            color={colors.text}
            muted={colors.muted}
            last
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 22 }]}>
          Legal
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card || '#11141A', borderColor: 'rgba(255,255,255,0.07)' }]}>
          <Pressable onPress={() => setShowPolicy(true)} style={styles.rowPress}>
            <Row
              icon="document-text-outline"
              title="Privacy policy"
              subtitle="How we protect and handle your information."
              color={colors.text}
              muted={colors.muted}
              chevron
              last
            />
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={showPolicy}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPolicy(false)}
      >
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowPolicy(false)} style={styles.backBtn} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Privacy policy
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.policyScroll}>
            <View style={styles.policyAccent} />
            <Text style={[styles.policyLead, { color: colors.text }]}>
              How Plazore handles your information
            </Text>
            <Text style={[styles.policyBody, { color: colors.muted }]}>
              Plazore processes account details, delivery addresses, and order
              history only to operate the marketplace — checkout, shipping, and
              order status. We do not sell personal data to third parties.
            </Text>
            <Text style={[styles.policyBody, { color: colors.muted }]}>
              Essential data is required for security and commerce. Optional
              analytics or marketing, when offered, only run if you allow them.
            </Text>
            <Text style={[styles.policyBody, { color: colors.muted }]}>
              Full policy content will ship with the live Plazore site. For
              questions, use Help & Support in settings.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

function Row({
  icon,
  title,
  subtitle,
  color,
  muted,
  badge,
  chevron,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  color: string
  muted: string
  badge?: string
  chevron?: boolean
  last?: boolean
}) {
  return (
    <View style={[styles.row, last && { paddingBottom: 2 }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={GREEN} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.rowTitle, { color }]}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowSub, { color: muted }]}>{subtitle}</Text>
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={16} color={muted} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
  },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  hero: { marginBottom: 22, marginTop: 4 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,229,117,0.28)',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroBody: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  rowPress: { marginHorizontal: -2 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,117,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { marginTop: 3, fontSize: 12.5, lineHeight: 18 },
  badge: {
    backgroundColor: 'rgba(0,229,117,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  policyScroll: { paddingHorizontal: 20, paddingBottom: 48 },
  policyAccent: {
    height: 3,
    width: 40,
    borderRadius: 2,
    backgroundColor: GREEN,
    marginBottom: 16,
  },
  policyLead: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  policyBody: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
})