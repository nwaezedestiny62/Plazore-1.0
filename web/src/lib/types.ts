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

/** Buyer-selectable option group (not the same as specifications) */
export interface ProductOption {
  id: string
  name: string
  values: string[]
}

/** Concrete combination with its own stock / optional price */
export interface ProductVariant {
  variantId: string
  key: string
  options: Record<string, string>
  stock: number
  /** null/undefined = use product.price */
  price?: number | null
  available: boolean
}

export interface Product {
  _id: string
  name: string
  description: string
  price: number
  comparePrice?: number
  images: string[]
  /** @deprecated Prefer options/variants */
  sizes?: string[]
  category:
    | {
        _id: string
        name: string
      }
    | string
  subCategory?: string
  brand?: string
  /** Simple inventory when hasVariants is false */
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
      }
  shipping?: {
    feeMode?: 'free' | 'fixed' | 'on_delivery'
    method: 'self' | 'courier'
    courierCompany?: string
    deliveryFee: number
    deliveryNote?: string
  }
  fulfillmentLocation?: FulfillmentLocation
  /** Category-specific structured specs (factual) */
  specifications?: Record<string, string>
  verificationDocuments?: VerificationDocument[]
  wishlistCount?: number

  /** true when options/variants drive inventory */
  hasVariants?: boolean
  options?: ProductOption[]
  variants?: ProductVariant[]

  createdAt: string
}

export type ProductCardProps = {
  product: Product
}

/** Local web cart line (localStorage) */
export interface CartItem {
  /** Stable line id: productId or productId::variantKey */
  id: string
  product: Product
  quantity: number
  note: string
  /** Unit price at add time (variant override if any) */
  price: number
  variantId?: string
  variantKey?: string
  selectedOptions?: Record<string, string>
}

export type CartItemProps = {
  item: {
    id: string
    product: { name: string; price: number; images: string[] }
    quantity: number
    selectedOptions?: Record<string, string>
    variantKey?: string
  }
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
  note?: string
  variantId?: string
  variantKey?: string
  selectedOptions?: Record<string, string>
}

export interface Order {
  _id: string
  user?: User | string
  buyer?: User | string
  seller?:
    | string
    | {
        _id: string
        name?: string
        storeName?: string
        storeLogo?: string
      }
  orderNumber: string
  items: OrderItem[]
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  paymentMethod: string
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
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
  subtotal: number
  shippingCost: number
  tax?: number
  totalAmount: number
  notes?: string
  buyerNote?: string
  deliveredAt?: string
  createdAt: string
}

export type WishlistContextType = {
  wishlist: Product[]
  toggleWishlist: (product: Product) => void
  isInWishlist: (productId: string) => boolean
  loading: boolean
}

/** Helpers for UI */
export function productHasVariants(p: Product | null | undefined): boolean {
  return !!(p?.hasVariants && Array.isArray(p.variants) && p.variants.length > 0)
}

export function getVariantUnitPrice(
  product: Product,
  variant?: ProductVariant | null
): number {
  if (
    variant &&
    variant.price != null &&
    Number.isFinite(Number(variant.price))
  ) {
    return Number(variant.price)
  }
  return Number(product.price) || 0
}

export function getAvailableStock(
  product: Product,
  variant?: ProductVariant | null
): number {
  if (productHasVariants(product)) {
    if (!variant || variant.available === false) return 0
    return Math.max(0, Number(variant.stock) || 0)
  }
  return Math.max(0, Number(product.stock) || 0)
}

export function formatSelectedOptions(
  opts?: Record<string, string> | null
): string {
  if (!opts) return ''
  return Object.entries(opts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')
}