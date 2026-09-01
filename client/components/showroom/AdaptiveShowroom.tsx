import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import RoomOne from './RoomOne'
import RoomTwo from './RoomTwo'
import RoomThree from './RoomThree'
import RoomFour from './RoomFour'

export type ShowroomRooms = {
  1?: Product[]
  2?: Product[]
  3?: Product[]
  4?: Product[]
}

interface AdaptiveShowroomProps {
  products: Product[]
  rooms?: ShowroomRooms | null
  loading: boolean
  onRoomLayout?: (roomNumber: number, y: number) => void
}

const ROOM_CAPACITY = {
  1: 50,
  2: 14,
  3: 16,
  4: 33,
} as const

function uniqueCount(rooms?: ShowroomRooms | null, products?: Product[]) {
  const ids = new Set<string>()
  const add = (list?: Product[]) => {
    ;(list || []).forEach((p) => p?._id && ids.add(String(p._id)))
  }
  add(rooms?.[1])
  add(rooms?.[2])
  add(rooms?.[3])
  add(rooms?.[4])
  add(products)
  return ids.size
}

export default function AdaptiveShowroom({
  products,
  rooms,
  loading,
  onRoomLayout,
}: AdaptiveShowroomProps) {
  const count = uniqueCount(rooms, products)

  const sections = useMemo(() => {
    const p = products || []
    const serverRooms = rooms && (rooms[1]?.length || rooms[2]?.length || rooms[3]?.length || rooms[4]?.length)

    // Tiny catalog → reuse the same products in every room
    const tinyPool =
      (rooms?.[1]?.length ? rooms[1] : p).slice(0, 4)

    if (count > 0 && count <= 4) {
      const pool = tinyPool.length ? tinyPool : p
      return [
        {
          type: 'one' as const,
          products: pool,
          title: 'THE HORIZON',
          subtitle: 'Expanded View',
        },
        {
          type: 'two' as const,
          products: pool,
          title: 'THE CHAMBER',
          subtitle: 'Private Selection',
        },
        {
          type: 'three' as const,
          products: pool,
          title: 'THE SIGNAL',
          subtitle: 'Worth Your Attention',
        },
        {
          type: 'four' as const,
          products: pool,
          title: 'THE LOCALE',
          subtitle: 'From Your Region',
          regionLabel: "A look at what's around you",
        },
      ]
    }

    // Preferred path: use server-ranked rooms as-is
    if (serverRooms) {
      return [
        {
          type: 'one' as const,
          products: (rooms?.[1] || []).slice(0, ROOM_CAPACITY[1]),
          title: 'THE HORIZON',
          subtitle: 'Expanded View',
        },
        {
          type: 'two' as const,
          products: (rooms?.[2] || []).slice(0, ROOM_CAPACITY[2]),
          title: 'THE CHAMBER',
          subtitle: 'Private Selection',
        },
        {
          type: 'three' as const,
          products: (rooms?.[3] || []).slice(0, ROOM_CAPACITY[3]),
          title: 'THE SIGNAL',
          subtitle: 'Worth Your Attention',
        },
        {
          type: 'four' as const,
          products: (rooms?.[4] || []).slice(0, ROOM_CAPACITY[4]),
          title: 'THE LOCALE',
          subtitle: 'From Your Region',
          regionLabel: "A look at what's around you",
        },
      ].filter((s) => s.products.length > 0)
    }

    // Fallback: slice the flat list
    let cursor = 0
    const take = (n: number) => {
      const slice = p.slice(cursor, cursor + n)
      cursor += slice.length
      return slice
    }

    return [
      {
        type: 'one' as const,
        products: take(ROOM_CAPACITY[1]),
        title: 'THE HORIZON',
        subtitle: 'Expanded View',
      },
      {
        type: 'two' as const,
        products: take(ROOM_CAPACITY[2]),
        title: 'THE CHAMBER',
        subtitle: 'Private Selection',
      },
      {
        type: 'three' as const,
        products: take(ROOM_CAPACITY[3]),
        title: 'THE SIGNAL',
        subtitle: 'Worth Your Attention',
      },
      {
        type: 'four' as const,
        products: take(ROOM_CAPACITY[4]),
        title: 'THE LOCALE',
        subtitle: 'From Your Region',
        regionLabel: "A look at what's around you",
      },
    ].filter((s) => s.products.length > 0)
  }, [products, rooms, count])

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
                : 4

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
          ) : (
            <RoomFour
              products={section.products}
              title={section.title}
              subtitle={section.subtitle}
              regionLabel={section.regionLabel}
            />
          )

        return (
          <View
            key={`${section.type}-${idx}`}
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