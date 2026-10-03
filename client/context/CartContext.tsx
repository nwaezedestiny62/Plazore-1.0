import api from '@/constants/api'
import {
  Product,
  ProductVariant,
  productHasVariants,
} from '@/constants/types'
import { useAuth } from '@clerk/clerk-expo'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export interface CartItem {
  id: string
  productId: string
  product: Product
  quantity: number
  /** @deprecated prefer selectedOptions */
  size?: string
  price: number
  note?: string
  variantId?: string
  variantKey?: string
  selectedOptions?: Record<string, string>
  image?: string
}

export type AddToCartOpts = {
  quantity?: number
  size?: string
  variantId?: string
  variantKey?: string
  selectedOptions?: Record<string, string>
  price?: number
  image?: string
}

type CartContextType = {
  cartItems: CartItem[]
  addToCart: (product: Product, opts?: AddToCartOpts | string) => Promise<void>
  removeFromCart: (itemId: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  updateItemNote: (itemId: string, note: string) => void
  clearCart: () => Promise<void>
  cartTotal: number
  itemCount: number
  isLoading: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function lineKey(
  productId: string,
  variantId?: string,
  size?: string,
  selectedOptions?: Record<string, string>
) {
  if (variantId) return `${productId}::v:${variantId}`
  if (selectedOptions && Object.keys(selectedOptions).length) {
    const sorted = Object.keys(selectedOptions)
      .sort()
      .map((k) => `${k}=${selectedOptions[k]}`)
      .join('|')
    return `${productId}::o:${sorted}`
  }
  if (size) return `${productId}::s:${size}`
  return `${productId}::base`
}

function resolveUnitPrice(
  product: Product,
  opts?: AddToCartOpts
): number {
  if (opts?.price != null && Number.isFinite(Number(opts.price))) {
    return Number(opts.price)
  }
  if (opts?.variantId && productHasVariants(product)) {
    const v = (product.variants || []).find(
      (x) => x.variantId === opts.variantId
    )
    if (v && v.price != null && Number.isFinite(Number(v.price))) {
      return Number(v.price)
    }
  }
  return Number(product.price) || 0
}

function resolveImage(product: Product, opts?: AddToCartOpts): string | undefined {
  if (opts?.image) return opts.image
  if (opts?.variantId && product.variants) {
    const v = product.variants.find((x) => x.variantId === opts.variantId)
    if (v?.image) return v.image
  }
  return product.images?.[0]
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoading] = useState(false)
  const [cartTotal, setCartTotal] = useState(0)

  const trackCartAdd = async (productId: string) => {
    try {
      if (!isSignedIn) return
      const token = await getToken()
      if (!token) return
      await api.post(
        '/analytics/track',
        { productId, action: 'cart' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch {
      /* never block cart */
    }
  }

  /**
   * addToCart(product) — simple product
   * addToCart(product, "M") — legacy size string
   * addToCart(product, { variantId, selectedOptions, price }) — variants
   */
  const addToCart = useCallback(
    async (product: Product, optsOrSize?: AddToCartOpts | string) => {
      const opts: AddToCartOpts =
        typeof optsOrSize === 'string'
          ? { size: optsOrSize }
          : optsOrSize || {}

      const qty = Math.max(1, Number(opts.quantity) || 1)
      const unit = resolveUnitPrice(product, opts)
      const image = resolveImage(product, opts)

      setCartItems((prev) => {
        const key = lineKey(
          product._id,
          opts.variantId,
          opts.size,
          opts.selectedOptions
        )
        const existing = prev.find(
          (item) =>
            lineKey(
              item.productId,
              item.variantId,
              item.size,
              item.selectedOptions
            ) === key
        )

        if (existing) {
          return prev.map((item) =>
            item.id === existing.id
              ? { ...item, quantity: item.quantity + qty }
              : item
          )
        }

        const newItem: CartItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          productId: product._id,
          product,
          quantity: qty,
          size: opts.size,
          price: unit,
          note: '',
          variantId: opts.variantId,
          variantKey: opts.variantKey,
          selectedOptions: opts.selectedOptions
            ? { ...opts.selectedOptions }
            : undefined,
          image,
        }
        return [...prev, newItem]
      })

      if (product._id) trackCartAdd(String(product._id))
    },
    [getToken, isSignedIn]
  )

  const removeFromCart = async (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    )
  }

  const updateItemNote = (itemId: string, note: string) => {
    const cleanNote = note.slice(0, 120)
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, note: cleanNote } : item
      )
    )
  }

  const clearCart = async () => {
    setCartItems([])
    setCartTotal(0)
  }

  const calculatedTotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  )

  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  )

  useEffect(() => {
    setCartTotal(calculatedTotal)
  }, [calculatedTotal])

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateItemNote,
        clearCart,
        cartTotal,
        itemCount,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

/** Match a variant from selected option map */
export function findVariant(
  product: Product,
  selected: Record<string, string>
): ProductVariant | null {
  const list = product.variants || []
  if (!list.length) return null
  const entries = Object.entries(selected).filter(([, v]) => v != null && v !== '')
  if (!entries.length) return null
  return (
    list.find((v) => {
      const o = v.options || {}
      return entries.every(([k, val]) => String(o[k]) === String(val))
    }) || null
  )
}
