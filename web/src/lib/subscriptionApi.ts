/**
 * Seller subscription API helpers (web)
 */

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";

async function req<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json as T;
}

export type PlanId = "free" | "dominant" | "business_plus" | "global_reach";

export type PlanRow = {
  id: PlanId;
  name: string;
  benefits: {
    maxImagesPerProduct: number;
    showroomVisibility: string;
    discoveryPriority: number;
    transactionFeeRate: number;
    bannerEligible: boolean;
    priorityDiscovery: boolean;
  };
  price: { amount: number; currency: string; interval: string };
};

export type PlansResponse = {
  success: boolean;
  data: {
    country: string;
    currency: string;
    active: {
      planId: PlanId;
      status: string;
      isPromotional?: boolean;
      promoSlotNumber?: number | null;
      promoExpiresAt?: string | null;
      expiresAt?: string | null;
      transactionFeeRate: number;
      maxImagesPerProduct: number;
    };
    plans: PlanRow[];
    promo: {
      eligible: boolean;
      claimed: boolean;
      durationMonths: number;
      planId: string;
      price: number;
    };
  };
};

export function fetchSellerPlans(token: string) {
  return req<PlansResponse>("/seller/plans", token);
}

export function initiatePlan(
  token: string,
  planId: PlanId,
  callbackUrl?: string
) {
  return req<{
    success: boolean;
    data: {
      activated?: boolean;
      paymentRequired?: boolean;
      authorizationUrl?: string;
      reference?: string;
      amount?: number;
      currency?: string;
      planId?: string;
      subscription?: unknown;
      message?: string;
    };
  }>("/seller/subscriptions/initiate", token, {
    method: "POST",
    body: JSON.stringify({ planId, callbackUrl }),
  });
}

export function verifyPlan(token: string, reference: string) {
  return req<{ success: boolean; data: { activated?: boolean; subscription?: unknown; message?: string } }>(
    "/seller/subscriptions/verify",
    token,
    { method: "POST", body: JSON.stringify({ reference }) }
  );
}

export function activatePromoPlan(token: string) {
  return req<{ success: boolean; data: { activated?: boolean; message?: string } }>(
    "/seller/subscriptions/activate-promo",
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function activateFreePlan(token: string) {
  return req<{ success: boolean; data: { activated?: boolean } }>(
    "/seller/subscriptions/activate-free",
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
}
