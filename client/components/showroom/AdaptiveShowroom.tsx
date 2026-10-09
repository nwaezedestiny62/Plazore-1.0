import { Product } from '@/constants/types'
import React, { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import RoomOne from './RoomOne'
import RoomTwo from './RoomTwo'
import RoomThree from './RoomThree'
import RoomFour from './RoomFour'

/**
 * Same contract as web `@/lib/api` ShowroomRooms + Mall ROOM_CAPACITY.
 * Backend `showroomRanker` ROOM_CAPACITY: 50 / 14 / 16 / 30.
 */
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

/** Exact web mall + backend capacities */
const ROOM_CAPACITY = {
  1: 50,
  2: 14,
  3: 16,
  4: 30,
} as const

const ROOM_TITLES = {
  one: { title: 'THE HORIZON', subtitle: 'Expanded View' },
  two: { title: 'THE CHAMBER', subtitle: 'Private Selection' },
  three: { title: 'THE SIGNAL', subtitle: 'Worth Your Attention' },
  four: {
    title: 'THE LOCALE',
    subtitle: 'From Your Region',
    regionLabel: "A look at what's around you",
  },
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

/**
 * Same as web Mall.takeUnique:
 * - prefer server order
 * - never invent products
 * - optional shared `used` so Room 1 + 2 stay unique (web buildRooms)
 */
function takeUnique(
  list: Product[] | undefined,
  cap: number,
  used?: Set<string>,
): Product[] {
  if (!list?.length || cap <= 0) return []
  const local = used ?? new Set<string>()
  const out: Product[] = []
  for (const p of list) {
    if (out.length >= cap) break
    const id = String(p?._id || '')
    if (!id || local.has(id)) continue
    local.add(id)
    out.push(p)
  }
  return out
}

/**
 * Mirror web Mall.buildRooms exactly:
 * - Server rooms: Room1 + Room2 share one seen set (no overlap).
 *   Room3 / Room4 use their own lists (backend may allow controlled reuse).
 * - Fallback: sequential unique slices from flat products list.
 */
function buildRooms(
  products: Product[],
  serverRooms?: ShowroomRooms | null,
) {
  const hasServerRooms = !!(
    serverRooms &&
    ((serverRooms[1]?.length || 0) > 0 ||
      (serverRooms[2]?.length || 0) > 0 ||
      (serverRooms[3]?.length || 0) > 0 ||
      (serverRooms[4]?.length || 0) > 0)
  )

  if (hasServerRooms && serverRooms) {
    const seen12 = new Set<string>()
    const one = takeUnique(serverRooms[1], ROOM_CAPACITY[1], seen12)
    const two = takeUnique(serverRooms[2], ROOM_CAPACITY[2], seen12)
    const three = takeUnique(serverRooms[3], ROOM_CAPACITY[3])
    const four = takeUnique(serverRooms[4], ROOM_CAPACITY[4])
    return { one, two, three, four }
  }

  const seen = new Set<string>()
  return {
    one: takeUnique(products, ROOM_CAPACITY[1], seen),
    two: takeUnique(products, ROOM_CAPACITY[2], seen),
    three: takeUnique(products, ROOM_CAPACITY[3], seen),
    four: takeUnique(products, ROOM_CAPACITY[4], seen),
  }
}

function AdaptiveShowroom({
  products,
  rooms,
  loading,
  onRoomLayout,
}: AdaptiveShowroomProps) {
  const count = uniqueCount(rooms, products)

  const split = useMemo(
    () => buildRooms(products || [], rooms),
    [products, rooms],
  )

  const sections = useMemo(() => {
    return [
      {
        type: 'one' as const,
        products: split.one,
        ...ROOM_TITLES.one,
      },
      {
        type: 'two' as const,
        products: split.two,
        ...ROOM_TITLES.two,
      },
      {
        type: 'three' as const,
        products: split.three,
        ...ROOM_TITLES.three,
      },
      {
        type: 'four' as const,
        products: split.four,
        ...ROOM_TITLES.four,
      },
    ].filter((s) => s.products.length > 0)
  }, [split])

  // Keep previous rooms mounted while refreshing — prevents card re-animation
  if (loading && count === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#94A3B8" size="small" />
      </View>
    )
  }

  if (!loading && count === 0) {
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
              regionLabel={
                'regionLabel' in section ? section.regionLabel : undefined
              }
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

export default React.memo(AdaptiveShowroom)

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