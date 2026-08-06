import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import RoomThree from './RoomThree'

interface AdaptiveShowroomProps {
  products: Product[]
  loading: boolean
}

/**
 * AdaptiveShowroom — Aura-Rae Inspired Redesign
 * 
 * A clean, mobile-first vertical product feed with alternating 
 * cool-shade backgrounds and smooth animations.
 */
export default function AdaptiveShowroom({ products, loading }: AdaptiveShowroomProps) {
  const count = products?.length || 0

  const { sections } = useMemo(() => {
    const p = products || []
    return {
      sections: [
        { products: p.slice(0, 4), tone: 'ice' as const, title: 'NEW DROP', subtitle: 'Summer Essentials' },
        { products: p.slice(4, 8), tone: 'mint' as const, title: 'FEATURED', subtitle: 'Best Sellers' },
        { products: p.slice(8, 12), tone: 'lavender' as const, title: 'COLLECTION', subtitle: 'Soft Tones' },
        { products: p.slice(12, 16), tone: 'slate' as const, title: 'CURATED', subtitle: 'Modern Staples' },
        { products: p.slice(16), tone: 'dusk' as const, title: 'ARCHIVE', subtitle: 'Last Chance' },
      ].filter(s => s.products.length > 0)
    }
  }, [products])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#0EA5E9" size="small" />
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

  return (
    <View style={styles.showroom}>
      {sections.map((section, idx) => (
        <RoomThree
          key={idx}
          products={section.products}
          tone={section.tone}
          title={section.title}
          subtitle={section.subtitle}
        />
      ))}
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
