export type RegionCode = string;

export interface RegionConfig {
  code: RegionCode;
  name: string;
  currency: {
    code: string;
    symbol: string;
    position: "before" | "after";
  };
  locale: string;
  subscriptionTier: "nigeria" | "international";
  flag: string;
}

/**
 * Marketplace regions (13). Currency is attached for display.
 * Rates: 1 unit of currency = rateToNgn NGN (offline fallback until /api/currency is live).
 */
export const REGIONS: Record<string, RegionConfig> = {
  NG: {
    code: "NG",
    name: "Nigeria",
    currency: { code: "NGN", symbol: "₦", position: "before" },
    locale: "en-NG",
    subscriptionTier: "nigeria",
    flag: "🇳🇬",
  },
  GH: {
    code: "GH",
    name: "Ghana",
    currency: { code: "GHS", symbol: "GH₵", position: "before" },
    locale: "en-GH",
    subscriptionTier: "international",
    flag: "🇬🇭",
  },
  BJ: {
    code: "BJ",
    name: "Benin",
    currency: { code: "XOF", symbol: "CFA", position: "before" },
    locale: "fr-BJ",
    subscriptionTier: "international",
    flag: "🇧🇯",
  },
  CM: {
    code: "CM",
    name: "Cameroon",
    currency: { code: "XAF", symbol: "FCFA", position: "before" },
    locale: "fr-CM",
    subscriptionTier: "international",
    flag: "🇨🇲",
  },
  KE: {
    code: "KE",
    name: "Kenya",
    currency: { code: "KES", symbol: "KSh", position: "before" },
    locale: "en-KE",
    subscriptionTier: "international",
    flag: "🇰🇪",
  },
  ZA: {
    code: "ZA",
    name: "South Africa",
    currency: { code: "ZAR", symbol: "R", position: "before" },
    locale: "en-ZA",
    subscriptionTier: "international",
    flag: "🇿🇦",
  },
  EG: {
    code: "EG",
    name: "Egypt",
    currency: { code: "EGP", symbol: "E£", position: "before" },
    locale: "en-EG",
    subscriptionTier: "international",
    flag: "🇪🇬",
  },
  US: {
    code: "US",
    name: "United States",
    currency: { code: "USD", symbol: "$", position: "before" },
    locale: "en-US",
    subscriptionTier: "international",
    flag: "🇺🇸",
  },
  CA: {
    code: "CA",
    name: "Canada",
    currency: { code: "CAD", symbol: "CA$", position: "before" },
    locale: "en-CA",
    subscriptionTier: "international",
    flag: "🇨🇦",
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: { code: "GBP", symbol: "£", position: "before" },
    locale: "en-GB",
    subscriptionTier: "international",
    flag: "🇬🇧",
  },
  DE: {
    code: "DE",
    name: "Germany",
    currency: { code: "EUR", symbol: "€", position: "before" },
    locale: "de-DE",
    subscriptionTier: "international",
    flag: "🇩🇪",
  },
  FR: {
    code: "FR",
    name: "France",
    currency: { code: "EUR", symbol: "€", position: "before" },
    locale: "fr-FR",
    subscriptionTier: "international",
    flag: "🇫🇷",
  },
  AU: {
    code: "AU",
    name: "Australia",
    currency: { code: "AUD", symbol: "A$", position: "before" },
    locale: "en-AU",
    subscriptionTier: "international",
    flag: "🇦🇺",
  },
};

/** Old / alternate codes → current region codes */
export const REGION_ALIASES: Record<string, string> = {
  EU: "FR", // legacy “Europe” → France (EUR)
  EUROPE: "FR",
  FRANCE: "FR",
  GERMANY: "DE",
  UK: "GB",
  USA: "US",
};

export const DEFAULT_REGION = "NG";
export const REGION_LIST = Object.values(REGIONS);

/** 1 UNIT of this currency = X NGN (fallback until server rates load) */
export const DEFAULT_RATES_TO_NGN: Record<string, number> = {
  NGN: 1,
  USD: 1326.68,
  GBP: 1790,
  EUR: 1440,
  CAD: 975,
  AUD: 880,
  GHS: 85.5,
  KES: 10.25,
  ZAR: 72.8,
  EGP: 27.1,
  XOF: 2.2,
  XAF: 2.2,
};

export type ClientRateMap = Record<string, number>;

export function resolveRegionCode(code?: string | null): string {
  if (!code) return DEFAULT_REGION;
  const raw = String(code).trim();
  const upper = raw.toUpperCase();
  const aliased = REGION_ALIASES[upper] || REGION_ALIASES[raw] || upper;
  if (REGIONS[aliased]) return aliased;
  return DEFAULT_REGION;
}

export function getRegion(code?: string | null): RegionConfig {
  return REGIONS[resolveRegionCode(code)];
}

export function regionCurrencyCode(regionCode?: string | null): string {
  return getRegion(regionCode).currency.code;
}

/**
 * Convert using NGN as pivot.
 * amount_to = amount_from * (from→NGN) / (to→NGN)
 */
export function convertWithNgnRates(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  ratesToNgn?: ClientRateMap | null
): number | null {
  const from = String(fromCurrency || "").toUpperCase();
  const to = String(toCurrency || "").toUpperCase();
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (from === to) return n;

  const rates = { ...DEFAULT_RATES_TO_NGN, ...(ratesToNgn || {}) };
  const fr = rates[from];
  const tr = rates[to];
  if (!(fr > 0) || !(tr > 0)) return null;

  const converted = (n * fr) / tr;
  const zeroDecimal = to === "XOF" || to === "XAF";
  const factor = zeroDecimal ? 1 : 100;
  return Math.round(converted * factor) / factor;
}

/** @deprecated name kept for old imports — same as convert via region codes */
export function convertPrice(
  amount: number,
  fromRegionCode?: string | null,
  toRegionCode?: string | null,
  ratesToNgn?: ClientRateMap | null
): number {
  const fromC = regionCurrencyCode(fromRegionCode);
  const toC = regionCurrencyCode(toRegionCode);
  const out = convertWithNgnRates(amount, fromC, toC, ratesToNgn);
  return out == null ? Number(amount) || 0 : out;
}

export function formatMoney(
  amount: number,
  regionCode?: string | null
): string {
  const region = getRegion(regionCode);
  const code = region.currency.code;
  const zeroDecimal = code === "XOF" || code === "XAF";
  const formatted = Number(amount || 0).toLocaleString(region.locale, {
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  });
  if (code === "XOF") return `CFA ${formatted}`;
  if (code === "XAF") return `FCFA ${formatted}`;
  return region.currency.position === "before"
    ? `${region.currency.symbol}${formatted}`
    : `${formatted}${region.currency.symbol}`;
}

/**
 * Product amount is in product.region’s currency.
 * Display in buyer region currency.
 */
export function formatProductPrice(
  amount: number,
  productRegion?: string | null,
  buyerRegion?: string | null,
  ratesToNgn?: ClientRateMap | null
): string {
  const from = regionCurrencyCode(productRegion);
  const to = regionCurrencyCode(buyerRegion);
  const converted = convertWithNgnRates(
    Number(amount) || 0,
    from,
    to,
    ratesToNgn
  );
  if (converted == null) {
    // Fail safe: show canonical product currency, do not invent
    return formatMoney(amount, productRegion);
  }
  return formatMoney(converted, buyerRegion);
}

/** Legacy export — prefer DEFAULT_RATES_TO_NGN / server config */
export const USD_RATES: Record<string, number> = {
  USD: 1,
  NGN: 1326.68,
  GBP: 1790 / 1326.68,
  EUR: 1440 / 1326.68,
  CAD: 975 / 1326.68,
  AUD: 880 / 1326.68,
  GHS: 85.5 / 1326.68,
  KES: 10.25 / 1326.68,
  ZAR: 72.8 / 1326.68,
};