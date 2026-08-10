import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import RoomOne from './RoomOne'
import RoomTwo from './RoomTwo'
import RoomThree from './RoomThree'
import RoomFour from './RoomFour'
import RoomFive from './RoomFive'

interface AdaptiveShowroomProps {
  products: Product[]
  loading: boolean
  onRoomLayout?: (roomNumber: number, y: number) => void
}

export default function AdaptiveShowroom({
  products,
  loading,
  onRoomLayout,
}: AdaptiveShowroomProps) {
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
        {
          type: 'five' as const,
          products: p,
          title: 'THE ATELIER',
          subtitle: 'Curated Masterpieces',
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
      {
        type: 'five' as const,
        products: p.slice(16, 20).length > 0 ? p.slice(16, 20) : p.slice(16),
        title: 'THE ATELIER',
        subtitle: 'Curated Masterpieces',
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
        const roomNumber =
          section.type === 'one'
            ? 1
            : section.type === 'two'
              ? 2
              : section.type === 'three'
                ? 3
                : section.type === 'four'
                  ? 4
                  : 5

        const content =
          section.type === 'one' ? (
            <RoomOne
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
            />
          ) : section.type === 'two' ? (
            <RoomTwo
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
            />
          ) : section.type === 'three' ? (
            <RoomThree
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
            />
          ) : section.type === 'four' ? (
            <RoomFour
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
              regionLabel={section.regionLabel}
            />
          ) : (
            <RoomFive
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
            />
          )

        return (
          <View
            key={idx}
            onLayout={(e) => {
              onRoomLayout?.(roomNumber, e.nativeEvent.layout.y)
            }}
          >
            {content}
          </View>
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