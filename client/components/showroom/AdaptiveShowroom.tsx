import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import RoomOne from './RoomOne'
import RoomTwo from './RoomTwo'
import RoomThree from './RoomThree'
import RoomFour from './RoomFour'

interface AdaptiveShowroomProps {
  products: Product[]
  loading: boolean
}

/**
 * AdaptiveShowroom — The signature Plazore experience.
 *
 * Cinematic, exhibition-like scroll experience inspired by:
 * - beyonce.com: full-bleed horizontal rails, dramatic "act" transitions
 * - cristianoronaldo.com: vertical portrait tiles in horizontal scroll
 * - mariahcarey.com: dramatic section transitions, full-viewport chapters
 *
 * Architecture is modular and adaptive. Each Room is a self-contained
 * component that receives its product slice and renders a cinematic section.
 *
 * The showroom adapts its entire flow based on product count:
 * - 0 products: Empty state
 * - 1 product: Single cinematic hero — "CHAPTER 01" dramatic treatment
 * - 2 products: Full-height vertical portrait stack + atmospheric room
 * - 3-5 products: Horizontal rail + atmospheric room
 * - 6+ products: Full multi-chapter cinematic experience
 */
export default function AdaptiveShowroom({ products, loading }: AdaptiveShowroomProps) {
  const count = products?.length || 0

  const { roomOne, roomTwo, roomThree, roomFour } = useMemo(() => {
    const p = products || []
    return {
      roomOne: p.slice(0, 5),
      roomTwo: p.slice(5, 11),
      roomThree: p.slice(11, 15),
      roomFour: p.slice(15),
    }
  }, [products])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#94A3B8" size="small" />
      </View>
    )
  }

  if (count === 0) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon} />
        </View>
      </View>
    )
  }

  // --- 1 product: Single cinematic hero ---
  if (count === 1) {
    return (
      <View style={styles.showroom}>
        <RoomOne products={roomOne} variant="hero" />
      </View>
    )
  }

  // --- 2 products: Full-height portrait stack + atmospheric room ---
  if (count === 2) {
    return (
      <View style={styles.showroom}>
        <RoomTwo products={products} variant="heroSplit" />
        <RoomThree products={products} tone="charcoal" variant="heroSplit" />
      </View>
    )
  }

  // --- 3-5 products: Horizontal rail + atmospheric room ---
  if (count <= 5) {
    return (
      <View style={styles.showroom}>
        <RoomOne products={roomOne} />
        <RoomThree products={roomOne} tone="charcoal" />
      </View>
    )
  }

  // --- 6+ products: Full cinematic multi-chapter experience ---
  return (
    <View style={styles.showroom}>
      {/* Chapter 01: Cinematic Horizontal Discovery Rail */}
      {roomOne.length > 0 && <RoomOne products={roomOne} />}

      {/* Chapter 02: Dramatic Vertical Portrait Section */}
      {roomTwo.length > 0 && <RoomTwo products={roomTwo} />}

      {/* Chapter 03: Atmospheric Tone Transition Room */}
      {roomThree.length > 0 && <RoomThree products={roomThree} tone="charcoal" />}

      {/* Chapter 04: Second Horizontal Discovery */}
      {roomFour.length > 0 && <RoomFour products={roomFour} />}
    </View>
  )
}

const styles = StyleSheet.create({
  showroom: {
    flex: 1,
  },
  loadingContainer: {
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
})
