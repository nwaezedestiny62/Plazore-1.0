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
      }
  shipping?: {
    method: 'self' | 'courier'
    courierCompany?: string
    deliveryFee: number
  }
  fulfillmentLocation?: FulfillmentLocation
  /** Category-specific structured specs */
  specifications?: Record<string, string>
  /** Cloudinary metadata only */
  verificationDocuments?: VerificationDocument[]
  wishlistCount?: number
  createdAt: string
}

export type ProductCardProps = {
  product: Product
}

export interface CartItem {
  product: Product
  quantity: number
  size: string
}

export type CartItemProps = {
  item: {
    id: string
    product: { name: string; price: number; images: string[] }
    quantity: number
    size: string
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
  size?: string
  note?: string
}

export interface Order {
  _id: string
  user: User | string
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
  deliveredAt?: string
  createdAt: string
}

export type WishlistContextType = {
  wishlist: Product[]
  toggleWishlist: (product: Product) => void
  isInWishlist: (productId: string) => boolean
  loading: boolean
}