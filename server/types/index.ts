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
    deliveryCompany?: string;
    trackingNumber?: string;
    estimatedDelivery?: Date;
    shippedAt?: Date;
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

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  sizes?: string[];
  category:
    | {
        _id: string;
        name: string;
      }
    | string;
  stock: number;
  ratings: {
    average: number;
    count: number;
  };
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string;
  wishlistCount?: number; // ← add this line
}

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  clerkId: string;
  image?: string;
  role: "buyer" | "seller" | "admin";

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