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

export interface IFulfillmentLocation {
  countryCode: string;
  country: string;
  stateCode?: string;
  state?: string;
  city: string;
  displayLabel: string;
}

export interface IVerificationDocument {
  documentName: string;
  documentType: string;
  secureUrl: string;
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
  region: string;
  shipping?: {
    method: "self" | "courier";
    courierCompany?: string;
    deliveryFee?: number;
  };
  fulfillmentLocation?: IFulfillmentLocation;
  specifications?: Map<string, string> | Record<string, string>;
  verificationDocuments?: IVerificationDocument[];
  wishlistCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ModerationStatus =
  | "NORMAL"
  | "ACTIVITY_CHECK"
  | "UNDER_REVIEW"
  | "SUSPENDED"
  | "BLOCKED"
  | "PARDONED"
  | "RESTORED";

export type ModerationLastOutcome = "PARDONED" | "RESTORED" | null;

export interface IModerationSide {
  status: ModerationStatus;
  reason?: string;
  publicReason?: string;
  startedAt?: Date;
  endsAt?: Date;
  caseId?: Types.ObjectId;
  updatedAt?: Date;
  lastOutcome?: ModerationLastOutcome;
  restrictions?: {
    preventNewListings?: boolean;
    preventPublishing?: boolean;
  };
}

export interface IUserModeration {
  buyer: IModerationSide;
  seller: IModerationSide;
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

  moderation?: IUserModeration;

  createdAt: Date;
  updatedAt: Date;
}

export interface IWishlist extends Document {
  user: Types.ObjectId;
  products: Types.ObjectId[];
  createdAt: Date;
}