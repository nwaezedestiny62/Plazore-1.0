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
 * Full 13 marketplace regions Plazore supports.
 * Kept in sync with web + client constants.
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

/** Closest regions used by Room 4 (THE LOCALE) fill logic */
export const NEAREST_REGIONS: Record<string, string[]> = {
  NG: ["GH", "BJ", "CM", "KE"],
  GH: ["NG", "BJ", "CM"],
  BJ: ["NG", "GH", "CM"],
  CM: ["NG", "GH", "BJ"],
  KE: ["NG", "UG", "TZ", "RW"], // UG/TZ/RW not full regions yet but useful
  ZA: ["KE", "NG"],
  EG: ["KE", "NG"],
  US: ["CA", "GB"],
  CA: ["US", "GB"],
  GB: ["DE", "FR", "US"],
  DE: ["FR", "GB", "US"],
  FR: ["DE", "GB", "US"],
  AU: ["US", "GB"],
};

export const DEFAULT_REGION = "NG";
export const REGION_LIST = Object.values(REGIONS);

export function getRegion(code?: string | null): RegionConfig {
  if (code && REGIONS[code]) return REGIONS[code];
  return REGIONS[DEFAULT_REGION];
}

export function formatMoney(amount: number, regionCode?: string | null): string {
  const region = getRegion(regionCode);
  const formatted = Number(amount || 0).toLocaleString(region.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return region.currency.position === "before"
    ? `${region.currency.symbol}${formatted}`
    : `${formatted}${region.currency.symbol}`;
}

/** Helper used by showroomRanker */
export function getNearestRegions(region: string): string[] {
  return NEAREST_REGIONS[String(region || "").toUpperCase()] || [];
}