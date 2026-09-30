/**
 * Merchant Integrity Engine — rule-based (no external AI).
 * Scores storefront completeness and flags nonsense / risk patterns.
 */

export type IntegritySeverity = "ok" | "warn" | "critical";

export type IntegrityFlag = {
  code: string;
  severity: IntegritySeverity;
  label: string;
  detail: string;
};

export type IntegrityResult = {
  score: number; // 0–100
  severity: IntegritySeverity;
  flags: IntegrityFlag[];
  completeness: {
    storeName: boolean;
    storeLogo: boolean;
    storeBanner: boolean;
    storeDescription: boolean;
    businessGoal: boolean;
    bank: boolean;
    shipping: boolean;
    products: boolean;
    region: boolean;
  };
};

const SPAM_RE =
  /^(test|asdf|qwerty|xxx|aaaa|bbbb|lorem|ipsum|n\/a|na|none|null|undefined|temp|dummy|fake|seller\d*|store\d*|shop\d*|abc|xyz)[\s\d._-]*$/i;
const KEYBOARD_RE = /(asdf|qwer|zxcv|hjkl|1234|0000|1111|9999)/i;
const ALL_CAPS_MIN = 12;
const URL_ONLY_RE = /^(https?:\/\/|www\.)/i;

function isBlank(s?: string | null) {
  return !String(s || "").trim();
}

function looksNonsense(s?: string | null, minLen = 3): boolean {
  const t = String(s || "").trim();
  if (!t) return true;
  if (t.length < minLen) return true;
  if (SPAM_RE.test(t)) return true;
  if (KEYBOARD_RE.test(t)) return true;
  if (t.length >= ALL_CAPS_MIN && t === t.toUpperCase() && /[A-Z]/.test(t)) {
    // Allow short brand all-caps
    if (t.length > 18) return true;
  }
  // Mostly digits / symbols
  const letters = (t.match(/[a-zA-Z]/g) || []).length;
  if (letters < Math.min(2, t.length) && t.length > 4) return true;
  return false;
}

function bankLooksOdd(payout?: {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}): IntegrityFlag | null {
  if (!payout) {
    return {
      code: "bank_missing",
      severity: "warn",
      label: "No payout bank",
      detail: "Seller has not filled bank payout details.",
    };
  }
  const bank = String(payout.bankName || "").trim();
  const name = String(payout.accountName || "").trim();
  const num = String(payout.accountNumber || "").trim().replace(/\s/g, "");
  if (!bank && !name && !num) {
    return {
      code: "bank_missing",
      severity: "warn",
      label: "No payout bank",
      detail: "Seller has not filled bank payout details.",
    };
  }
  if (!bank || !name || !num) {
    return {
      code: "bank_incomplete",
      severity: "warn",
      label: "Incomplete bank details",
      detail: "Bank name, account name, or account number is missing.",
    };
  }
  if (num.length < 6 || num.length > 20 || !/^\d+$/.test(num)) {
    return {
      code: "bank_number_odd",
      severity: "critical",
      label: "Odd account number",
      detail: "Account number length or format looks invalid.",
    };
  }
  if (looksNonsense(bank, 2) || looksNonsense(name, 2)) {
    return {
      code: "bank_name_odd",
      severity: "critical",
      label: "Odd bank naming",
      detail: "Bank or account name looks nonsensical.",
    };
  }
  return null;
}

export type MerchantSnapshot = {
  name?: string;
  email?: string;
  storeName?: string;
  storeDescription?: string;
  businessGoal?: string;
  storeLogo?: string;
  storeBanner?: string;
  marketplaceRegion?: string;
  isSellerVerified?: boolean;
  isSellerSuspended?: boolean;
  payout?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };
  shippingDefaults?: {
    address?: { street?: string; city?: string; state?: string; country?: string };
    deliveryMethod?: string;
  };
  productCount?: number;
  activeProductCount?: number;
  orderCount?: number;
  cancelledOrderCount?: number;
  conversationCount?: number;
  messageCount?: number;
  lastActivityAt?: string | Date | null;
};

export function assessMerchantIntegrity(m: MerchantSnapshot): IntegrityResult {
  const flags: IntegrityFlag[] = [];
  let score = 100;

  const completeness = {
    storeName: !isBlank(m.storeName),
    storeLogo: !isBlank(m.storeLogo),
    storeBanner: !isBlank(m.storeBanner),
    storeDescription: !isBlank(m.storeDescription),
    businessGoal: !isBlank(m.businessGoal),
    bank: !!(
      m.payout?.bankName &&
      m.payout?.accountName &&
      m.payout?.accountNumber
    ),
    shipping: !!(
      m.shippingDefaults?.address?.city &&
      m.shippingDefaults?.address?.country
    ),
    products: (m.activeProductCount || 0) > 0,
    region: !isBlank(m.marketplaceRegion),
  };

  // Naming
  if (isBlank(m.storeName)) {
    flags.push({
      code: "store_name_missing",
      severity: "critical",
      label: "No store name",
      detail: "Storefront has no public store name.",
    });
    score -= 22;
  } else if (looksNonsense(m.storeName, 2)) {
    flags.push({
      code: "store_name_odd",
      severity: "critical",
      label: "Odd store name",
      detail: "Store name looks like spam, placeholder, or nonsense.",
    });
    score -= 18;
  }

  if (looksNonsense(m.name, 2) && !isBlank(m.name)) {
    flags.push({
      code: "seller_name_odd",
      severity: "warn",
      label: "Odd seller name",
      detail: "Account display name looks unusual.",
    });
    score -= 6;
  }

  // Images
  if (isBlank(m.storeLogo)) {
    flags.push({
      code: "logo_missing",
      severity: "warn",
      label: "No logo",
      detail: "Store logo is missing.",
    });
    score -= 8;
  }
  if (isBlank(m.storeBanner)) {
    flags.push({
      code: "banner_missing",
      severity: "warn",
      label: "No banner",
      detail: "Store banner is missing.",
    });
    score -= 5;
  }

  // Description / goal
  if (isBlank(m.storeDescription)) {
    flags.push({
      code: "desc_missing",
      severity: "warn",
      label: "No description",
      detail: "Store description is empty.",
    });
    score -= 6;
  } else if (
    looksNonsense(m.storeDescription, 12) ||
    URL_ONLY_RE.test(String(m.storeDescription))
  ) {
    flags.push({
      code: "desc_odd",
      severity: "critical",
      label: "Odd description",
      detail: "Store description looks empty of meaning or is URL-only.",
    });
    score -= 12;
  }

  if (isBlank(m.businessGoal)) {
    flags.push({
      code: "goal_missing",
      severity: "warn",
      label: "No business goal",
      detail: "Seller did not state a business goal.",
    });
    score -= 4;
  } else if (looksNonsense(m.businessGoal, 8)) {
    flags.push({
      code: "goal_odd",
      severity: "critical",
      label: "Odd business goal",
      detail: "Business goal looks nonsensical or placeholder.",
    });
    score -= 10;
  }

  const bankFlag = bankLooksOdd(m.payout);
  if (bankFlag) {
    flags.push(bankFlag);
    score -= bankFlag.severity === "critical" ? 14 : 7;
  }

  if (!completeness.shipping) {
    flags.push({
      code: "shipping_incomplete",
      severity: "warn",
      label: "Shipping incomplete",
      detail: "Default ship-from address is incomplete.",
    });
    score -= 8;
  }

  if (!completeness.region) {
    flags.push({
      code: "region_missing",
      severity: "warn",
      label: "No region",
      detail: "Marketplace region is not set.",
    });
    score -= 5;
  }

  // Catalog
  const pc = m.productCount || 0;
  const ap = m.activeProductCount || 0;
  if (pc === 0) {
    flags.push({
      code: "no_products",
      severity: "warn",
      label: "No products",
      detail: "Seller has zero listings.",
    });
    score -= 10;
  } else if (ap === 0) {
    flags.push({
      code: "no_active_products",
      severity: "warn",
      label: "No active listings",
      detail: "All products are inactive.",
    });
    score -= 8;
  }

  // Orders / cancellations
  const oc = m.orderCount || 0;
  const cc = m.cancelledOrderCount || 0;
  if (oc >= 5 && cc / oc >= 0.4) {
    flags.push({
      code: "high_cancel_rate",
      severity: "critical",
      label: "High cancel rate",
      detail: `${cc}/${oc} seller orders cancelled.`,
    });
    score -= 15;
  }

  if (m.isSellerSuspended) {
    flags.push({
      code: "suspended",
      severity: "critical",
      label: "Suspended",
      detail: "Seller is currently suspended.",
    });
    score -= 25;
  }

  // Messages volume with no products can be spammy
  if ((m.messageCount || 0) > 40 && ap === 0) {
    flags.push({
      code: "msg_no_catalog",
      severity: "warn",
      label: "Messages without catalog",
      detail: "High chat volume with no active products.",
    });
    score -= 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let severity: IntegritySeverity = "ok";
  if (flags.some((f) => f.severity === "critical") || score < 45) {
    severity = "critical";
  } else if (flags.some((f) => f.severity === "warn") || score < 72) {
    severity = "warn";
  }

  return { score, severity, flags, completeness };
}
