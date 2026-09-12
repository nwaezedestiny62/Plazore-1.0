/**
 * Plazore currency engine — NGN reference base.
 * Silent to customers. Admin-managed rates. Decimal-safe via string math.
 */

import ExchangeRate, {
  BASE_CURRENCY,
  SUPPORTED_CURRENCIES,
  SupportedCurrency,
} from "../models/ExchangeRate.js";

const MINOR: Record<string, number> = {
  NGN: 2, GHS: 2, XOF: 0, XAF: 0, KES: 2, ZAR: 2, EGP: 2,
  USD: 2, CAD: 2, GBP: 2, EUR: 2, AUD: 2,
};

const META: Record<
  string,
  { name: string; symbol: string; locale: string }
> = {
  NGN: { name: "Nigerian Naira", symbol: "₦", locale: "en-NG" },
  GHS: { name: "Ghanaian Cedi", symbol: "GH₵", locale: "en-GH" },
  XOF: { name: "West African CFA franc", symbol: "CFA", locale: "fr-BJ" },
  XAF: { name: "Central African CFA franc", symbol: "FCFA", locale: "fr-CM" },
  KES: { name: "Kenyan Shilling", symbol: "KSh", locale: "en-KE" },
  ZAR: { name: "South African Rand", symbol: "R", locale: "en-ZA" },
  EGP: { name: "Egyptian Pound", symbol: "E£", locale: "en-EG" },
  USD: { name: "US Dollar", symbol: "$", locale: "en-US" },
  CAD: { name: "Canadian Dollar", symbol: "CA$", locale: "en-CA" },
  GBP: { name: "British Pound", symbol: "£", locale: "en-GB" },
  EUR: { name: "Euro", symbol: "€", locale: "en-IE" },
  AUD: { name: "Australian Dollar", symbol: "A$", locale: "en-AU" },
};

/** Seed defaults: 1 UNIT = X NGN (operational starters — Admin must verify) */
const SEED_RATES: Record<string, string> = {
  NGN: "1",
  USD: "1326.68",
  GBP: "1790.00",
  EUR: "1440.00",
  CAD: "975.00",
  AUD: "880.00",
  GHS: "85.50",
  KES: "10.25",
  ZAR: "72.80",
  EGP: "27.10",
  XOF: "2.20",
  XAF: "2.20",
};

type RateMap = Record<string, { rateToNgn: string; version: number }>;

let cache: { rates: RateMap; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

function parseDec(s: string): number {
  const n = Number(String(s).replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Invalid decimal: ${s}`);
  return n;
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(
    String(code).toUpperCase()
  );
}

export function invalidateRateCache() {
  cache = null;
}

export async function ensureSeedRates() {
  for (const code of SUPPORTED_CURRENCIES) {
    const existing = await ExchangeRate.findOne({
      currencyCode: code,
      isActive: true,
    });
    if (existing) continue;
    await ExchangeRate.create({
      currencyCode: code,
      rateToNgn: SEED_RATES[code] || "1",
      isActive: true,
      version: 1,
      reason: "system_seed",
      effectiveFrom: new Date(),
    });
  }
  invalidateRateCache();
}

export async function loadActiveRates(force = false): Promise<RateMap> {
  if (!force && cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.rates;
  }
  await ensureSeedRates();
  const rows = await ExchangeRate.find({ isActive: true }).lean();
  const rates: RateMap = {};
  for (const r of rows) {
    rates[r.currencyCode] = {
      rateToNgn: String(r.rateToNgn),
      version: r.version,
    };
  }
  // NGN always 1
  rates.NGN = rates.NGN || { rateToNgn: "1", version: 1 };
  cache = { rates, loadedAt: Date.now() };
  return rates;
}

/**
 * Convert amount from → to using NGN pivot.
 * Returns null if either rate is missing (fail safe — never invent).
 */
export async function convertAmount(
  amount: number,
  fromCode: string,
  toCode: string
): Promise<{
  amount: number;
  from: string;
  to: string;
  rateVersionFrom: number;
  rateVersionTo: number;
  rateUsed: number;
} | null> {
  const from = String(fromCode).toUpperCase();
  const to = String(toCode).toUpperCase();
  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) return null;
  if (!Number.isFinite(amount)) return null;

  if (from === to) {
    const rates = await loadActiveRates();
    return {
      amount: roundTo(amount, MINOR[to] ?? 2),
      from,
      to,
      rateVersionFrom: rates[from]?.version ?? 1,
      rateVersionTo: rates[to]?.version ?? 1,
      rateUsed: 1,
    };
  }

  const rates = await loadActiveRates();
  const fr = rates[from];
  const tr = rates[to];
  if (!fr || !tr) return null;

  const fromNgn = parseDec(fr.rateToNgn);
  const toNgn = parseDec(tr.rateToNgn);
  if (fromNgn <= 0 || toNgn <= 0) return null;

  // amount_from * fromNgn / toNgn
  const converted = (amount * fromNgn) / toNgn;
  const decimals = MINOR[to] ?? 2;
  return {
    amount: roundTo(converted, decimals),
    from,
    to,
    rateVersionFrom: fr.version,
    rateVersionTo: tr.version,
    rateUsed: fromNgn / toNgn,
  };
}

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string
): string {
  const code = String(currencyCode).toUpperCase();
  const meta = META[code] || { symbol: code, locale: "en-US" };
  const decimals = MINOR[code] ?? 2;
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString(meta.locale, {
    minimumFractionDigits: decimals === 0 ? 0 : 2,
    maximumFractionDigits: decimals,
  });
  if (code === "XOF") return `CFA ${formatted}`;
  if (code === "XAF") return `FCFA ${formatted}`;
  return `${meta.symbol}${formatted}`;
}

export async function getPublicRateConfig() {
  const rates = await loadActiveRates();
  return {
    baseCurrency: BASE_CURRENCY,
    currencies: SUPPORTED_CURRENCIES.map((code) => ({
      code,
      ...META[code],
      minorUnit: MINOR[code] ?? 2,
      rateToNgn: rates[code]?.rateToNgn ?? null,
      version: rates[code]?.version ?? null,
      available: !!rates[code],
    })),
    loadedAt: new Date().toISOString(),
  };
}

export async function listAdminRates() {
  const rates = await loadActiveRates(true);
  const actives = await ExchangeRate.find({ isActive: true })
    .sort({ currencyCode: 1 })
    .lean();

  return SUPPORTED_CURRENCIES.map((code) => {
    const row = actives.find((a) => a.currencyCode === code);
    return {
      currencyCode: code,
      name: META[code]?.name,
      symbol: META[code]?.symbol,
      baseCurrency: BASE_CURRENCY,
      rateToNgn: rates[code]?.rateToNgn ?? null,
      isActive: !!row?.isActive,
      version: row?.version ?? 0,
      lastUpdated: row?.updatedAt ?? null,
      changedByName: row?.changedByName ?? null,
      reason: row?.reason ?? null,
      percentChange: row?.percentChange ?? null,
    };
  });
}

export async function getRateHistory(currencyCode: string, limit = 30) {
  const code = String(currencyCode).toUpperCase();
  if (!isSupportedCurrency(code)) return [];
  return ExchangeRate.find({ currencyCode: code })
    .sort({ version: -1 })
    .limit(limit)
    .lean();
}

export async function updateRate(opts: {
  currencyCode: string;
  newRateToNgn: string | number;
  adminId?: string;
  adminName?: string;
  reason?: string;
  sourceNote?: string;
  reviewThresholdPct?: number;
}) {
  const code = String(opts.currencyCode).toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new Error("Unsupported currency");
  }
  if (code === "NGN") {
    throw new Error("NGN is the base currency and is always 1");
  }

  const newRateStr = String(opts.newRateToNgn).trim();
  const newRate = parseDec(newRateStr);
  if (!(newRate > 0) || !Number.isFinite(newRate)) {
    throw new Error("Rate must be a positive finite number");
  }
  if (newRate > 1_000_000) {
    throw new Error("Rate exceeds safety ceiling");
  }

  const current = await ExchangeRate.findOne({
    currencyCode: code,
    isActive: true,
  });

  const oldRate = current ? parseDec(String(current.rateToNgn)) : null;
  let percentChange: number | null = null;
  if (oldRate && oldRate > 0) {
    percentChange = ((newRate - oldRate) / oldRate) * 100;
  }

  const threshold = opts.reviewThresholdPct ?? 8;
  const significant =
    percentChange != null && Math.abs(percentChange) >= threshold;

  if (current) {
    current.isActive = false;
    current.effectiveTo = new Date();
    await current.save();
  }

  const nextVersion = (current?.version || 0) + 1;
  const created = await ExchangeRate.create({
    currencyCode: code,
    rateToNgn: newRateStr,
    isActive: true,
    version: nextVersion,
    previousRateToNgn: current ? String(current.rateToNgn) : undefined,
    changedBy: opts.adminId || undefined,
    changedByName: opts.adminName || undefined,
    reason: opts.reason || undefined,
    sourceNote: opts.sourceNote || undefined,
    percentChange: percentChange ?? undefined,
    effectiveFrom: new Date(),
  });

  invalidateRateCache();

  return {
    rate: created,
    significant,
    percentChange,
    warning: significant
      ? "This is a significant rate change. Verify the reference rate before relying on it."
      : null,
    note: "This rate change affects future currency conversions only. Historical transactions will not be recalculated.",
  };
}

export { META, MINOR, SEED_RATES, BASE_CURRENCY, SUPPORTED_CURRENCIES };