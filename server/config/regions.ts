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

export const REGIONS: Record<string, RegionConfig> = {
  NG: {
    code: "NG",
    name: "Nigeria",
    currency: { code: "NGN", symbol: "₦", position: "before" },
    locale: "en-NG",
    subscriptionTier: "nigeria",
    flag: "🇳🇬",
  },
  US: {
    code: "US",
    name: "United States",
    currency: { code: "USD", symbol: "$", position: "before" },
    locale: "en-US",
    subscriptionTier: "international",
    flag: "🇺🇸",
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: { code: "GBP", symbol: "£", position: "before" },
    locale: "en-GB",
    subscriptionTier: "international",
    flag: "🇬🇧",
  },
  CA: {
    code: "CA",
    name: "Canada",
    currency: { code: "CAD", symbol: "C$", position: "before" },
    locale: "en-CA",
    subscriptionTier: "international",
    flag: "🇨🇦",
  },
  EU: {
    code: "EU",
    name: "Europe",
    currency: { code: "EUR", symbol: "€", position: "before" },
    locale: "en-IE",
    subscriptionTier: "international",
    flag: "🇪🇺",
  },
  GH: {
    code: "GH",
    name: "Ghana",
    currency: { code: "GHS", symbol: "GH₵", position: "before" },
    locale: "en-GH",
    subscriptionTier: "international",
    flag: "🇬🇭",
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