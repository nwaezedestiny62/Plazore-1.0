import { Product, WishlistContextType } from '@/constants/types'
import api from '@/constants/api'
import { useAuth } from '@clerk/clerk-expo'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

const WishlistContext = createContext<WishlistContextType | undefined>(
  undefined
)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth()
  const [wishlist, setWishlist] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  // Latest wishlist for sync checks without stale closures
  const wishlistRef = useRef<Product[]>([])
  wishlistRef.current = wishlist

  // Prevent parallel toggles for the same productId
  const inFlightRef = useRef<Set<string>>(new Set())

  const fetchWishlist = useCallback(async () => {
    if (!isSignedIn) {
      setWishlist([])
      wishlistRef.current = []
      return
    }

    try {
      setLoading(true)
      const token = await getTokenRef.current()
      const res = await api.get('/wishlist', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        const list: Product[] = res.data.data || []
        setWishlist(list)
        wishlistRef.current = list
      }
    } catch (error) {
      console.log('Fetch wishlist error:', error)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn])

  /**
   * mode:
   *  - 'toggle' → heart button (add if missing, remove if present)
   *  - 'add'    → double-tap image (only add; never remove; never double-count)
   *
   * Returns: { ok, inWishlist, changed }
   */
  const mutateWishlist = async (
    product: Product,
    mode: 'toggle' | 'add' = 'toggle'
  ): Promise<{ ok: boolean; inWishlist: boolean; changed: boolean }> => {
    if (!isSignedIn || !product?._id) {
      return { ok: false, inWishlist: false, changed: false }
    }

    const id = String(product._id)

    // Ignore spam taps while this product is already updating
    if (inFlightRef.current.has(id)) {
      const currently = wishlistRef.current.some((p) => p._id === id)
      return { ok: true, inWishlist: currently, changed: false }
    }

    const currentlyIn = wishlistRef.current.some((p) => p._id === id)

    // Double-tap: only ADD. Already in list → no-op (no second count)
    if (mode === 'add' && currentlyIn) {
      return { ok: true, inWishlist: true, changed: false }
    }

    const willBeIn = mode === 'add' ? true : !currentlyIn

    inFlightRef.current.add(id)

    // Optimistic local list (unique by _id)
    setWishlist((prev) => {
      const without = prev.filter((p) => p._id !== id)
      const next = willBeIn ? [...without, product] : without
      wishlistRef.current = next
      return next
    })

    try {
      const token = await getTokenRef.current()
      const res = await api.post(
        '/wishlist/toggle',
        {
          productId: id,
          // Optional: backend can honor this later
          action: willBeIn ? 'add' : 'remove',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data.success && Array.isArray(res.data.data)) {
        // Server is source of truth — still unique by _id
        const seen = new Set<string>()
        const unique = (res.data.data as Product[]).filter((p) => {
          if (!p?._id || seen.has(p._id)) return false
          seen.add(p._id)
          return true
        })
        setWishlist(unique)
        wishlistRef.current = unique
        const finalIn = unique.some((p) => p._id === id)
        return { ok: true, inWishlist: finalIn, changed: finalIn !== currentlyIn }
      }

      // If API shape differs but succeeded, keep optimistic result
      return { ok: true, inWishlist: willBeIn, changed: willBeIn !== currentlyIn }
    } catch (error) {
      console.log('Wishlist mutate error:', error)
      // Rollback from server
      await fetchWishlist()
      const recovered = wishlistRef.current.some((p) => p._id === id)
      return { ok: false, inWishlist: recovered, changed: false }
    } finally {
      inFlightRef.current.delete(id)
    }
  }

  const toggleWishlist = async (product: Product) => {
    await mutateWishlist(product, 'toggle')
  }

  const addToWishlist = async (product: Product) => {
    await mutateWishlist(product, 'add')
  }

  const isInWishlist = useCallback((productId: string) => {
    return wishlistRef.current.some((p) => p._id === productId)
  }, [])

  // Re-sync when auth changes
  useEffect(() => {
    fetchWishlist()
  }, [isSignedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        loading,
        isInWishlist,
        toggleWishlist,
        // @ts-expect-error extend type if needed
        addToWishlist,
        mutateWishlist,
        fetchWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (context === undefined) {
    throw new Error('useWishlist must be within a WishlistProvider')
  }
  return context
}