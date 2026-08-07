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

export default function AdaptiveShowroom({ products, loading }: AdaptiveShowroomProps) {
  const count = products?.length || 0

  const sections = useMemo(() => {
    const p = products || []

    // With 4 or fewer → fill all rooms
    if (p.length > 0 && p.length <= 4) {
      return [
        {
          type: 'one' as const,
          products: p,
          title: 'THE HORIZON',
          subtitle: 'Expanded View',
        },
        {
          type: 'two' as const,
          products: p,
          title: 'THE CHAMBER',
          subtitle: 'Private Selection',
        },
        {
          type: 'three' as const,
          products: p,
          title: 'THE SIGNAL',
          subtitle: 'Worth Your Attention',
        },
        {
          type: 'four' as const,
          products: p,
          title: 'THE LOCALE',
          subtitle: 'From Your Region',
          regionLabel: 'Regional Selection',
        },
      ]
    }

    // Normal path
    return [
      {
        type: 'one' as const,
        products: p.slice(0, 4),
        title: 'THE HORIZON',
        subtitle: 'Expanded View',
      },
      {
        type: 'two' as const,
        products: p.slice(4, 8),
        title: 'THE CHAMBER',
        subtitle: 'Private Selection',
      },
      {
        type: 'three' as const,
        products: p.slice(8, 12),
        title: 'THE SIGNAL',
        subtitle: 'Worth Your Attention',
      },
      {
        type: 'four' as const,
        products: p.slice(12, 16),
        title: 'THE LOCALE',
        subtitle: 'From Your Region',
        regionLabel: 'Regional Selection',
      },
    ].filter((s) => s.products.length > 0)
  }, [products])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#94A3B8" size="small" />
      </View>
    )
  }

  if (count === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.empty} />
      </View>
    )
  }

  return (
    <View style={styles.showroom}>
      {sections.map((section, idx) => {
        if (section.type === 'one') {
          return (
            <RoomOne
              key={idx}
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
            />
          )
        }
        if (section.type === 'two') {
          return (
            <RoomTwo
              key={idx}
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
            />
          )
        }
        if (section.type === 'three') {
          return (
            <RoomThree
              key={idx}
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
            />
          )
        }
        return (
          <RoomFour
            key={idx}
            products={section.products}
            title={section.title}
            subtitle={section.subtitle}
            regionLabel={section.regionLabel}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  showroom: {
    flex: 1,
  },
  center: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
  },
  empty: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
})