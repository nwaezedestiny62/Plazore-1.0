export interface User {
  _id: string
  name: string
  email: string
  role: 'user' | 'admin' | 'buyer' | 'seller'
  phone?: string
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  storeName?: string
  storeLogo?: string
  storeDescription?: string
  marketplaceRegion?: string
  createdAt: string
}

/** Where this product ships from (public: city + country only) */
export interface FulfillmentLocation {
  countryCode: string
  country: string
  stateCode?: string
  state?: string
  city: string
  displayLabel: string
}

export interface VerificationDocument {
  documentName: string
  documentType: string
  secureUrl: string
}

/** Buyer-selectable option group (Size, Color, …) — not specifications */
export interface ProductOption {
  id: string
  name: string
  values: string[]
}

/** Concrete combination of option values + inventory */
export interface ProductVariant {
  variantId: string
  /** Sorted "opt=val|…" key for matching */
  variantKey?: string
  /** Map of option name → value */
  options: Record<string, string>
  price?: number | null
  stock: number
  sku?: string
  image?: string
  isActive?: boolean
}

export interface Product {
  _id: string
  name: string
  description: string
  price: number
  comparePrice?: number
  images: string[]
  sizes?: string[]
  category:
    | {
        _id: string
        name: string
      }
    | string
  subCategory?: string
  brand?: string
  stock: number
  ratings?: {
    average: number
    count: number
  }
  isFeatured: boolean
  isActive: boolean
  region?: string
  seller?:
    | string
    | {
        _id: string
        name?: string
        storeName?: string
        storeLogo?: string
        storeDescription?: string
        marketplaceRegion?: string
        shippingDefaults?: {
          address?: {
            street?: string
            city?: string
            state?: string
            zipCode?: string
            country?: string
          }
        }
      }
  shipping?: {
    method: 'self' | 'courier'
    courierCompany?: string
    deliveryFee: number
  }
  fulfillmentLocation?: FulfillmentLocation
  /** Category-specific structured specs (not buyer options) */
  specifications?: Record<string, string>
  verificationDocuments?: VerificationDocument[]
  wishlistCount?: number
  /** When true, inventory & optional price live on variants */
  hasVariants?: boolean
  options?: ProductOption[]
  variants?: ProductVariant[]
  createdAt: string
}

export type ProductCardProps = {
  product: Product
}

export interface CartItem {
  id: string
  productId: string
  product: Product
  quantity: number
  /** @deprecated legacy size field — prefer selectedOptions */
  size?: string
  price: number
  note?: string
  variantId?: string
  variantKey?: string
  selectedOptions?: Record<string, string>
  image?: string
}

export type CartItemProps = {
  item: CartItem
  onRemove?: () => void
  onUpdateQuantity?: (newQty: number) => void
}

export type CategoryItemProps = {
  item: { id: string | number; name: string; icon: string }
  isSelected?: boolean
  onPress?: () => void
}

export type HeaderProps = {
  title?: string
  showBack?: boolean
  showSearch?: boolean
  showCart?: boolean
  showMenu?: boolean
  showLogo?: boolean
}

export interface Address {
  _id: string
  type: 'Home' | 'Work' | 'Other'
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  isDefault: boolean
  createdAt: string
}

export interface OrderItem {
  product: Product | string
  name: string
  quantity: number
  price: number
  image?: string
  size?: string
  note?: string
  variantId?: string
  variantKey?: string
  selectedOptions?: Record<string, string>
  isSellerOwnedPurchase?: boolean
}

export interface Order {
  _id: string
  user?: User | string
  buyer?: User | string
  seller?: User | string
  orderNumber: string
  items: OrderItem[]
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  paymentMethod?: string
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | string
  orderStatus:
    | 'placed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'Preparing'
    | 'Shipped'
    | 'Delivered'
    | 'Cancelled'
    | string
  subtotal?: number
  shippingCost?: number
  tax?: number
  totalAmount: number
  notes?: string
  buyerNote?: string
  region?: string
  isSellerOwnedPurchase?: boolean
  deliveredAt?: string
  createdAt: string
}

export type WishlistContextType = {
  wishlist: Product[]
  toggleWishlist: (product: Product) => void
  isInWishlist: (productId: string) => boolean
  loading: boolean
}

/** Helpers used across product / cart / showroom */
export function productHasVariants(product?: Product | null): boolean {
  if (!product) return false
  if (product.hasVariants) return true
  return Array.isArray(product.variants) && product.variants.length > 0
}

export function effectiveProductStock(product?: Product | null): number {
  if (!product) return 0
  if (productHasVariants(product)) {
    const list = product.variants || []
    return list.reduce((sum, v) => {
      if (v.isActive === false) return sum
      return sum + Math.max(0, Number(v.stock) || 0)
    }, 0)
  }
  return Math.max(0, Number(product.stock) || 0)
}

export function formatSelectedOptions(
  opts?: Record<string, string> | null
): string {
  if (!opts || typeof opts !== 'object') return ''
  return Object.entries(opts)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
}
