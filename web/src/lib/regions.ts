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
  EU: "FR",
  EUROPE: "FR",
  FRANCE: "FR",
  GERMANY: "DE",
  UK: "GB",
  USA: "US",
};

/**
 * ISO 3166-1 alpha-2 country → marketplace region.
 * Only listed countries resolve; everything else falls back to DEFAULT_REGION (NG).
 */
export const COUNTRY_TO_REGION: Record<string, string> = {
  NG: "NG",
  GH: "GH",
  BJ: "BJ",
  CM: "CM",
  KE: "KE",
  ZA: "ZA",
  EG: "EG",
  US: "US",
  CA: "CA",
  GB: "GB",
  DE: "DE",
  FR: "FR",
  AU: "AU",
  // Common near-matches that share currency / market intent
  UK: "GB",
  USA: "US",
  AT: "DE", // Austria → EUR / DE market
  BE: "FR", // Belgium → EUR
  NL: "DE",
  IE: "GB",
  CH: "DE",
  NZ: "AU",
};

/**
 * IANA timezone → region (instant, offline, no network).
 * Used for guest auto-detect before any API call.
 */
export const TIMEZONE_TO_REGION: Record<string, string> = {
  // Nigeria
  "Africa/Lagos": "NG",
  // Ghana
  "Africa/Accra": "GH",
  // Benin
  "Africa/Porto-Novo": "BJ",
  // Cameroon
  "Africa/Douala": "CM",
  // Kenya
  "Africa/Nairobi": "KE",
  // South Africa
  "Africa/Johannesburg": "ZA",
  // Egypt
  "Africa/Cairo": "EG",
  // United States
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "America/Honolulu": "US",
  "America/Detroit": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Boise": "US",
  "Pacific/Honolulu": "US",
  // Canada
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  // United Kingdom
  "Europe/London": "GB",
  // Germany
  "Europe/Berlin": "DE",
  // France
  "Europe/Paris": "FR",
  // Australia
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
};

/** Locale tag prefix → region (navigator.language / Intl) */
export const LOCALE_TO_REGION: Record<string, string> = {
  "en-NG": "NG",
  "en-GH": "GH",
  "fr-BJ": "BJ",
  "fr-CM": "CM",
  "en-KE": "KE",
  "en-ZA": "ZA",
  "ar-EG": "EG",
  "en-EG": "EG",
  "en-US": "US",
  "en-CA": "CA",
  "fr-CA": "CA",
  "en-GB": "GB",
  "de-DE": "DE",
  "fr-FR": "FR",
  "en-AU": "AU",
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

/**
 * Map a country code to a supported marketplace region.
 * Unsupported countries → DEFAULT_REGION (NG / Naira).
 */
export function regionFromCountry(country?: string | null): string {
  if (!country) return DEFAULT_REGION;
  const cc = String(country).trim().toUpperCase();
  const mapped = COUNTRY_TO_REGION[cc] || REGION_ALIASES[cc];
  if (mapped && REGIONS[mapped]) return mapped;
  return DEFAULT_REGION;
}

export function getRegion(code?: string | null): RegionConfig {
  return REGIONS[resolveRegionCode(code)];
}

export function regionCurrencyCode(regionCode?: string | null): string {
  return getRegion(regionCode).currency.code;
}

/**
 * Instant offline guess from timezone + browser locale.
 * Returns null if nothing maps to a supported region (caller falls back to NG).
 */
export function detectRegionFromBrowser(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz && TIMEZONE_TO_REGION[tz] && REGIONS[TIMEZONE_TO_REGION[tz]]) {
      return TIMEZONE_TO_REGION[tz];
    }
  } catch {
    /* ignore */
  }

  try {
    const locale =
      (typeof navigator !== "undefined" &&
        (navigator.languages?.[0] || navigator.language)) ||
      "";
    const tag = String(locale).trim();
    if (tag && LOCALE_TO_REGION[tag] && REGIONS[LOCALE_TO_REGION[tag]]) {
      return LOCALE_TO_REGION[tag];
    }
    // en-US → US via country suffix
    const parts = tag.replace("_", "-").split("-");
    if (parts.length >= 2) {
      const fromLocale = regionFromCountry(parts[parts.length - 1]);
      if (fromLocale !== DEFAULT_REGION) return fromLocale;
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Optional network confirm via free geo IP (short timeout).
 * Never blocks UX longer than `timeoutMs`. Failures return null.
 */
export async function detectRegionFromGeoIp(
  timeoutMs = 1800
): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Lightweight public endpoint — country_code only
    const res = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { country_code?: string };
    const region = regionFromCountry(data?.country_code);
    // Only accept if it's a real supported market (not forced NG from unknown)
    if (data?.country_code) {
      const cc = String(data.country_code).toUpperCase();
      if (COUNTRY_TO_REGION[cc] || REGION_ALIASES[cc]) return region;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Guest bootstrap: browser first (instant), then optional geo IP.
 * Always returns a valid region code; unknown → NG.
 */
export async function detectGuestRegion(): Promise<string> {
  const fromBrowser = detectRegionFromBrowser();
  if (fromBrowser && REGIONS[fromBrowser]) return fromBrowser;

  const fromIp = await detectRegionFromGeoIp(1800);
  if (fromIp && REGIONS[fromIp]) return fromIp;

  return DEFAULT_REGION;
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

/** Deterministic money string — identical on server and client (no locale drift). */
export function formatMoney(
  amount: number,
  regionCode?: string | null
): string {
  const region = getRegion(regionCode);
  const code = region.currency.code;
  const n = Number(amount) || 0;
  const zeroDecimal =
    code === "XOF" || code === "XAF" || code === "NGN" || code === "KES";
  const decimals = zeroDecimal ? 0 : 2;
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, frac] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = n < 0 ? "-" : "";
  const body = decimals > 0 ? `${withCommas}.${frac}` : withCommas;

  if (code === "XOF") return `${sign}CFA ${body}`;
  if (code === "XAF") return `${sign}FCFA ${body}`;

  return region.currency.position === "before"
    ? `${sign}${region.currency.symbol}${body}`
    : `${sign}${body}${region.currency.symbol}`;
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
