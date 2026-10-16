/**
 * Format money for Plazore notifications using the order/listing currency
 * (marketplace region), not a fixed ₦.
 *
 * Use: formatMoney(12500, order.currency || currencyForRegion(order.region))
 */

const SYMBOLS: Record<string, string> = {
  NGN: "₦",
  GHS: "GH₵",
  XOF: "CFA",
  XAF: "FCFA",
  KES: "KSh",
  ZAR: "R",
  EGP: "E£",
  USD: "$",
  CAD: "C$",
  GBP: "£",
  EUR: "€",
  AUD: "A$",
  DE: "€",
  FR: "€",
};

const ZERO_DECIMAL = new Set(["NGN", "XOF", "XAF", "KES", "JPY", "UGX", "RWF"]);

export function formatMoney(
  amount: number | null | undefined,
  currency?: string | null
): string {
  const cur = String(currency || "NGN").trim().toUpperCase() || "NGN";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${SYMBOLS[cur] || cur + " "}—`;

  const symbol = SYMBOLS[cur] || `${cur} `;
  const fraction = ZERO_DECIMAL.has(cur) ? 0 : 2;

  try {
    const formatted = new Intl.NumberFormat("en", {
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(n);
    return `${symbol}${formatted}`;
  } catch {
    return `${symbol}${n.toFixed(fraction)}`;
  }
}

/** Prefer order.currency, then feeBreakdown, then region map */
export function moneyFromOrder(order: any, amount?: number): string {
  const cur =
    String(order?.currency || "").toUpperCase() ||
    String(order?.feeBreakdown?.currency || "").toUpperCase() ||
    "NGN";
  const value =
    amount != null
      ? amount
      : Number(
          order?.payout?.amount ??
            order?.feeBreakdown?.sellerPayoutAmount ??
            order?.totalAmount ??
            0
        );
  return formatMoney(value, cur);
}
