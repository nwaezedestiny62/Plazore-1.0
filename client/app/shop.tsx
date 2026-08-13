// client/app/shop.tsx
import ProductCard from '@/components/ProductCard'
import PlazoreNavigationHub from '@/components/PlazoreNavigationHub'
import api from '@/constants/api'
import { PRODUCT_CATEGORIES, CATEGORY_LIST } from '@/constants/productCatalog'
import { Product } from '@/constants/types'
import { useMarketplace } from '@/context/MarketplaceContext'
import { Ionicons } from '@expo/vector-icons'
import { Image as ExpoImage } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const CATEGORY_IMAGES: Record<string, [string, string, string]> = {
  Electronics: [
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&q=80',
    'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  ],
  'Phones & Accessories': [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80',
    'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&q=80',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&q=80',
  ],
  Computers: [
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac882e75?w=600&q=80',
  ],
  Fashion: [
    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80',
  ],
  'Beauty & Personal Care': [
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80',
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80',
    'https://images.unsplash.com/photo-1571781926291-c77df8097c1f?w=600&q=80',
  ],
  'Home & Living': [
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&q=80',
    'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=600&q=80',
  ],
  Furniture: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&q=80',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
  ],
  'Kitchen & Dining': [
    'https://images.unsplash.com/photo-1556911220-bff31c812dce?w=600&q=80',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    'https://images.unsplash.com/photo-1585515320310-4726b6f1f3d4?w=600&q=80',
  ],
  Groceries: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80',
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&q=80',
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80',
  ],
  Health: [
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80',
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80',
  ],
  'Sports & Outdoors': [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=600&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623066027b?w=600&q=80',
  ],
  Automotive: [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80',
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&q=80',
  ],
  Books: [
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80',
  ],
  'Office Supplies': [
    'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=600&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&q=80',
  ],
  'Toys & Games': [
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&q=80',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&q=80',
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80',
  ],
  'Baby Products': [
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80',
    'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&q=80',
  ],
  'Pet Supplies': [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=80',
    'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&q=80',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&q=80',
  ],
  'Jewelry & Watches': [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80',
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80',
  ],
  'Musical Instruments': [
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80',
    'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  ],
  'Art & Crafts': [
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80',
    'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=600&q=80',
  ],
  'Industrial Equipment': [
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80',
    'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=80',
    'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=600&q=80',
  ],
  Agriculture: [
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3855?w=600&q=80',
    'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&q=80',
    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&q=80',
  ],
  'Building Materials': [
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80',
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&q=80',
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80',
  ],
  Collectibles: [
    'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=600&q=80',
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  ],
  'Luxury Goods': [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
  ],
  Others: [
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80',
    'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600&q=80',
  ],
}

type Mode = 'categories' | 'new' | 'trending' | 'stores' | 'category'

type StoreItem = {
  _id: string
  storeName?: string
  name?: string
  storeLogo?: string
  isSellerVerified?: boolean
}

function str(v: any): string {
  if (Array.isArray(v)) return v[0] || ''
  return v || ''
}

function CategoryImage({ category }: { category: string }) {
  const urls = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Others
  const [idx, setIdx] = useState(0)

  return (
    <ExpoImage
      source={{ uri: urls[idx] }}
      style={{ width: '100%', height: 110 }}
      contentFit="cover"
      transition={200}
      onError={() => {
        if (idx < 2) setIdx((i) => i + 1)
      }}
    />
  )
}

/* Bold 3-line menu that opens Plazore Navigation Hub */
function MenuToggle({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 22, gap: 5 }}>
        <View style={{ height: 2.5, backgroundColor: '#0F172A', borderRadius: 2 }} />
        <View style={{ height: 2.5, backgroundColor: '#0F172A', borderRadius: 2, width: '70%' }} />
        <View style={{ height: 2.5, backgroundColor: '#0F172A', borderRadius: 2 }} />
      </View>
    </Pressable>
  )
}

function ShopHeader({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
      }}
    >
      <MenuToggle onPress={onMenu} />
      <Text
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: '700',
          color: '#0F172A',
          marginRight: 40,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  )
}

export default function Shop() {
  const { region } = useMarketplace()
  const router = useRouter()
  const raw = useLocalSearchParams()

  const mode = (str(raw.mode) as Mode) || 'categories'
  const selectedCategory = str(raw.category)
  const selectedSub = str(raw.sub)

  const isCategories = mode === 'categories' && !selectedCategory
  const isStores = mode === 'stores'

  const [hubOpen, setHubOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)

  const load = useCallback(async () => {
    if (isCategories) {
      setLoading(false)
      setProducts([])
      setStores([])
      return
    }

    setLoading(true)

    try {
      if (isStores) {
        const res = await api.get(`/products?limit=100&region=${region || 'NG'}`)
        const map = new Map<string, StoreItem>()

        ;(res.data?.data || []).forEach((p: any) => {
          const s = p.seller
          if (!s?._id) return
          const id = String(s._id)
          if (!map.has(id)) {
            map.set(id, {
              _id: id,
              storeName: s.storeName,
              name: s.name,
              storeLogo: s.storeLogo,
              isSellerVerified: s.isSellerVerified,
            })
          }
        })

        setStores(Array.from(map.values()))
        setProducts([])
      } else {
        const qs = new URLSearchParams()
        qs.set('page', '1')
        qs.set('limit', '20')
        qs.set('region', region || 'NG')

        if (mode === 'new') qs.set('sort', 'newest')
        if (mode === 'trending') qs.set('sort', 'trending')
        if (mode === 'category' && selectedCategory) {
          qs.set('category', selectedCategory)
          if (selectedSub) qs.set('subCategory', selectedSub)
        }

        const res = await api.get(`/products?${qs.toString()}`)
        const list = Array.isArray(res.data?.data) ? res.data.data : []
        setProducts(list)
        setStores([])
      }
    } catch (e) {
      console.error(e)
      setProducts([])
      setStores([])
    } finally {
      setLoading(false)
    }
  }, [mode, selectedCategory, selectedSub, region, isCategories, isStores])

  useEffect(() => {
    setSearch('')
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly(false)
    load()
  }, [load])

  const displayedProducts = useMemo(() => {
    let list = [...products]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q)
      )
    }

    const min = Number(minPrice)
    const max = Number(maxPrice)
    if (Number.isFinite(min) && min > 0) list = list.filter((p) => Number(p.price) >= min)
    if (Number.isFinite(max) && max > 0) list = list.filter((p) => Number(p.price) <= max)
    if (inStockOnly) list = list.filter((p) => Number(p.stock ?? 0) > 0)

    return list
  }, [products, search, minPrice, maxPrice, inStockOnly])

  const displayedStores = useMemo(() => {
    if (!search.trim()) return stores
    const q = search.toLowerCase()
    return stores.filter(
      (s) =>
        (s.storeName || '').toLowerCase().includes(q) ||
        (s.name || '').toLowerCase().includes(q)
    )
  }, [stores, search])

  const title =
    mode === 'new'
      ? 'New Arrivals'
      : mode === 'trending'
        ? 'Trending'
        : mode === 'stores'
          ? 'Stores'
          : mode === 'category' && selectedCategory
            ? selectedSub
              ? `${selectedCategory} · ${selectedSub}`
              : selectedCategory
            : 'Categories'

  // ── Categories ─────────────────────────────────────────
  if (isCategories) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
        <ShopHeader title="Categories" onMenu={() => setHubOpen(true)} />

        <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              paddingHorizontal: 12,
              height: 44,
            }}
          >
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A' }}
              placeholder="Search categories…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        <FlatList
          data={CATEGORY_LIST.filter((c) =>
            c.toLowerCase().includes(search.toLowerCase())
          )}
          keyExtractor={(item) => item}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/shop',
                  params: { mode: 'category', category: item },
                } as any)
              }
              style={{
                width: '48%',
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                marginBottom: 14,
                overflow: 'hidden',
              }}
            >
              <CategoryImage category={item} />
              <View style={{ padding: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }} numberOfLines={2}>
                  {item}
                </Text>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  {PRODUCT_CATEGORIES[item]?.length || 0} sub-rooms
                </Text>
              </View>
            </Pressable>
          )}
        />

        <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
      </SafeAreaView>
    )
  }

  // ── Stores ─────────────────────────────────────────────
  if (isStores) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
        <ShopHeader title="Stores" onMenu={() => setHubOpen(true)} />

        <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              paddingHorizontal: 12,
              height: 44,
            }}
          >
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A' }}
              placeholder="Search stores…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={10}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0F172A" />
          </View>
        ) : (
          <FlatList
            data={displayedStores}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/store/${item._id}` as any)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    backgroundColor: '#F8FAFC',
                    marginRight: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {item.storeLogo ? (
                    <ExpoImage
                      source={{ uri: item.storeLogo }}
                      style={{ width: 56, height: 56 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="storefront-outline" size={22} color="#64748B" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: '#0F172A', fontSize: 15, fontWeight: '600' }}
                    numberOfLines={1}
                  >
                    {item.storeName || item.name || 'Store'}
                  </Text>
                  {item.isSellerVerified && (
                    <Text
                      style={{
                        color: '#16A34A',
                        fontSize: 11,
                        marginTop: 3,
                        fontWeight: '600',
                      }}
                    >
                      Verified Seller
                    </Text>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Text style={{ color: '#64748B', fontSize: 13 }}>
                  {stores.length === 0 ? 'No stores found' : 'No stores match your search'}
                </Text>
              </View>
            }
          />
        )}

        <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
      </SafeAreaView>
    )
  }

  // ── Products (New / Trending / Category) ───────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <ShopHeader title={title} onMenu={() => setHubOpen(true)} />

      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginVertical: 10 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            paddingHorizontal: 12,
            height: 44,
          }}
        >
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A' }}
            placeholder="Search products…"
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={{
            width: 44,
            height: 44,
            backgroundColor: '#0F172A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="options-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {mode === 'category' && selectedCategory && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 16,
            marginBottom: 8,
          }}
        >
          <Pressable
            onPress={() =>
              router.setParams({ mode: 'category', category: selectedCategory, sub: '' })
            }
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              backgroundColor: !selectedSub ? '#0F172A' : '#fff',
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: !selectedSub ? '#fff' : '#0F172A',
              }}
            >
              All
            </Text>
          </Pressable>

          {(PRODUCT_CATEGORIES[selectedCategory] || []).map((sub) => (
            <Pressable
              key={sub}
              onPress={() =>
                router.setParams({ mode: 'category', category: selectedCategory, sub })
              }
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                backgroundColor: selectedSub === sub ? '#0F172A' : '#fff',
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: selectedSub === sub ? '#fff' : '#0F172A',
                }}
              >
                {sub}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : (
        <FlatList
          data={displayedProducts}
          keyExtractor={(item) => String(item._id)}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => <ProductCard product={item} />}
          ListEmptyComponent={
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Text style={{ color: '#64748B', fontSize: 13 }}>
                {products.length === 0
                  ? 'No products found'
                  : 'No products match your filters'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={filterOpen} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setFilterOpen(false)}
        />
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 40,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', marginBottom: 20 }}>Filters</Text>

          <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Price</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            <TextInput
              style={inputStyle}
              placeholder="Min"
              keyboardType="numeric"
              value={minPrice}
              onChangeText={setMinPrice}
              placeholderTextColor="#94A3B8"
            />
            <TextInput
              style={inputStyle}
              placeholder="Max"
              keyboardType="numeric"
              value={maxPrice}
              onChangeText={setMaxPrice}
              placeholderTextColor="#94A3B8"
            />
          </View>

          <Pressable
            onPress={() => setInStockOnly((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderWidth: 1.5,
                borderColor: inStockOnly ? '#0F172A' : '#CBD5E1',
                backgroundColor: inStockOnly ? '#0F172A' : '#fff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {inStockOnly && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={{ fontSize: 14 }}>In stock only</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => {
                setMinPrice('')
                setMaxPrice('')
                setInStockOnly(false)
                setFilterOpen(false)
              }}
              style={{
                flex: 1,
                height: 48,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontWeight: '600', color: '#64748B' }}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterOpen(false)}
              style={{
                flex: 1,
                height: 48,
                backgroundColor: '#0F172A',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontWeight: '600', color: '#fff' }}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
    </SafeAreaView>
  )
}

const inputStyle = {
  flex: 1,
  height: 44,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  paddingHorizontal: 12,
  fontSize: 14,
  color: '#0F172A',
  backgroundColor: '#F8FAFC',
}