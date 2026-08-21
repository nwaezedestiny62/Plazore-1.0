/**
 * Ambient Soundtrack — Plazore Settings
 * ON/OFF freezes position · volume independent · no border radius
 */

import { useSoundtrack } from '@/context/SoundtrackContext'
import { Ionicons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { useRouter } from 'expo-router'
import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG = '#090B0F'
const SURFACE = '#11141A'
const LINE = 'rgba(255,255,255,0.07)'
const TEXT = '#F5F7FA'
const SECONDARY = '#A7ADB8'
const MUTED = '#737A86'
const GREEN = '#00E575'

export default function MusicSettingsScreen() {
  const router = useRouter()
  const {
    enabled,
    volume,
    currentTitle,
    state,
    setEnabled,
    setVolume,
    unlock,
  } = useSoundtrack()

  useEffect(() => {
    unlock()
  }, [unlock])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/settings' as any)
          }
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Ambient Soundtrack</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.lead}>
          Immerse yourself in the Plazore atmosphere. Subtle, continuous, never
          in the way.
        </Text>

        <View style={styles.card}>
          {/* ON / OFF */}
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>Ambient Soundtrack</Text>
              <Text style={styles.rowSub}>
                {enabled ? 'On — plays when allowed' : 'Off — position saved'}
              </Text>
            </View>
            <Pressable
              onPress={() => setEnabled(!enabled)}
              style={[styles.toggle, enabled && styles.toggleOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled }}
            >
              <View style={[styles.knob, enabled && styles.knobOn]} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Volume */}
          <Text style={styles.volLabel}>
            Volume · {Math.round(volume * 100)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={setVolume}
            minimumTrackTintColor={GREEN}
            maximumTrackTintColor={LINE}
            thumbTintColor={TEXT}
          />
          <Text style={styles.hint}>
            0% is silent but still On. Use the switch to pause and freeze the
            track.
          </Text>

          {/* Current track */}
          {!!currentTitle && (
            <>
              <View style={styles.divider} />
              <Text style={styles.nowLabel}>Now in cycle</Text>
              <Text style={styles.nowTitle}>{currentTitle}</Text>
              <Text style={styles.stateLine}>{state}</Text>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
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
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.2,
  },
  body: { padding: 16 },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    color: SECONDARY,
    marginBottom: 18,
  },
  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  rowSub: {
    marginTop: 3,
    fontSize: 12,
    color: MUTED,
  },
  toggle: {
    width: 52,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: 'rgba(0,229,117,0.25)',
    borderColor: GREEN,
  },
  knob: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  knobOn: {
    alignSelf: 'flex-end',
    backgroundColor: GREEN,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 16,
  },
  volLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    color: MUTED,
    lineHeight: 16,
  },
  nowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nowTitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  stateLine: {
    marginTop: 4,
    fontSize: 11,
    color: MUTED,
  },
})