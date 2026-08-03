import { Document, Types } from "mongoose";

export interface IAddress extends Document {
  user: Types.ObjectId;
  type: "Home" | "Work" | "Other";
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
  price: number;
  size?: string;
}

export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
  totalAmount: number;
  calculateTotal(): number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  note?: string;
}

export interface IOrder extends Document {
  buyer: Types.ObjectId;
  seller: Types.ObjectId;
  orderNumber: string;
  items: IOrderItem[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  buyerNote?: string;
  orderStatus: "Preparing" | "Shipped" | "Delivered" | "Cancelled";
  shipping: {
    shippingMethod?: "self" | "courier";
    deliveryCompany?: string;
    trackingNumber?: string;
    estimatedDelivery?: Date;
    shippedAt?: Date;
    selfDeliveryNote?: string;
  };
  productShipping?: {
    method?: "self" | "courier";
    courierCompany?: string;
    deliveryFee?: number;
  };
  subtotal: number;
  shippingCost: number;
  totalAmount: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentMethod: "cash" | "card" | "transfer" | "pending";
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Where this product ships from (not seller home address) */
export interface IFulfillmentLocation {
  countryCode: string;
  country: string;
  stateCode?: string;
  state?: string;
  city: string;
  /** Public-safe: "Lagos, Nigeria" — never street-level */
  displayLabel: string;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  subCategory?: string;
  brand?: string;
  stock: number;
  isFeatured: boolean;
  isActive: boolean;
  seller: Types.ObjectId;
  /** Marketplace currency/region inherited from seller (e.g. "NG") */
  region: string;
  shipping?: {
    method: "self" | "courier";
    courierCompany?: string;
    deliveryFee?: number;
  };
  fulfillmentLocation?: IFulfillmentLocation;
  wishlistCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  clerkId: string;
  image?: string;
  role: "buyer" | "seller" | "admin";

  marketplaceRegion: string;

  storeName?: string;
  storeDescription?: string;
  businessGoal?: string;
  storeLogo?: string;
  storeBanner?: string;

  isSellerVerified?: boolean;
  isSellerSuspended?: boolean;
  sellerAppliedAt?: Date;

  payout?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };

  shippingDefaults?: {
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    deliveryMethod?: "courier" | "self" | "";
    courierCompany?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlist extends Document {
  user: Types.ObjectId;
  products: Types.ObjectId[];
  createdAt: Date;
}