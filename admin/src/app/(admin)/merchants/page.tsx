"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Store,
  X,
  MapPin,
  Pencil,
  Save,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import { Badge, Button, EmptyState, ErrorBlock, Input, cn } from "@/components/ui";
import { REGION_LIST } from "@/lib/region";

const GATE_KEY = "plazore.admin.merchantsGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_MERCHANTS_PASSWORD?.trim() || "";
const PAGE_SIZE = 25;
const Z_FLOAT = 90;
const Z_MODAL = 9999;

/** Exact match of server/config/payment.ts REGION_TO_CURRENCY */
const REGION_TO_CURRENCY: Record<string, string> = {
  NG: "NGN",
  GH: "GHS",
  BJ: "XOF",
  TG: "XOF",
  CI: "XOF",
  SN: "XOF",
  CM: "XAF",
  KE: "KES",
  ZA: "ZAR",
  EG: "EGP",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  UK: "GBP",
  DE: "EUR",
  FR: "EUR",
  NL: "EUR",
  IT: "EUR",
  ES: "EUR",
  EU: "EUR",
  AU: "AUD",
};

const KNOWN_CURRENCIES = new Set(Object.values(REGION_TO_CURRENCY));

const REGION_NAME: Record<string, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  BJ: "Benin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Senegal",
  CM: "Cameroon",
  KE: "Kenya",
  ZA: "South Africa",
  EG: "Egypt",
  UG: "Uganda",
  TZ: "Tanzania",
  RW: "Rwanda",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  IT: "Italy",
  ES: "Spain",
  EU: "Europe",
  AU: "Australia",
};

function norm(s?: string | null) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function isIsoCurrency(s?: string | null) {
  const v = norm(s);
  return v.length === 3 && /^[A-Z]{3}$/.test(v);
}

function currencyForRegion(region?: string | null): string {
  const key = norm(region);
  if (!key) return "";
  if (REGION_TO_CURRENCY[key]) return REGION_TO_CURRENCY[key];
  if (KNOWN_CURRENCIES.has(key)) return key;
  const base = key.split(/[-_]/)[0];
  if (REGION_TO_CURRENCY[base]) return REGION_TO_CURRENCY[base];
  if (KNOWN_CURRENCIES.has(base)) return base;
  return "";
}

function asRegionCode(raw?: string | null): string {
  const key = norm(raw);
  if (!key) return "";
  if (REGION_TO_CURRENCY[key]) return key;
  const base = key.split(/[-_]/)[0];
  if (REGION_TO_CURRENCY[base]) return base;
  if (key.length === 2) return key;
  return "";
}

function pickCurrency(...cands: Array<string | undefined | null>): string {
  for (const c of cands) {
    const v = norm(c);
    if (!v) continue;
    if (REGION_TO_CURRENCY[v]) return REGION_TO_CURRENCY[v];
    if (isIsoCurrency(v)) return v;
  }
  return "";
}

function regionName(code?: string | null) {
  const k = asRegionCode(code) || norm(code);
  if (!k) return "";
  const hit = (REGION_LIST as { code?: string; name?: string }[]).find(
    (r) => String(r.code).toUpperCase() === k
  );
  if (hit?.name) return hit.name;
  return REGION_NAME[k] || k;
}

function fmtMoney(n?: number, currencyOrRegion?: string) {
  const v = Number(n || 0);
  const cur =
    pickCurrency(currencyOrRegion) ||
    currencyForRegion(currencyOrRegion) ||
    "NGN";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString()} ${cur}`;
  }
}

/** Listing currency for a product on this storefront. No live FX. */
function listingCurrency(p: any, merchantRegion?: string) {
  return (
    pickCurrency(p?.currency) ||
    currencyForRegion(p?.region) ||
    currencyForRegion(merchantRegion) ||
    "NGN"
  );
}

function listingRegion(p: any, merchantRegion?: string) {
  return (
    asRegionCode(p?.region) ||
    asRegionCode(p?.fulfillmentLocation?.countryCode) ||
    asRegionCode(merchantRegion) ||
    "—"
  );
}

/** Frozen checkout currency on an order. */
function orderCurrency(o: any) {
  const frozen = pickCurrency(
    o?.feeBreakdown?.currency,
    o?.currency,
    o?.items?.[0]?.currency
  );
  if (frozen) return frozen;
  const mapped = currencyForRegion(
    o?.feeBreakdown?.region || o?.region || o?.items?.[0]?.region
  );
  if (mapped) return mapped;
  return "NGN";
}

function orderRegion(o: any) {
  return (
    asRegionCode(o?.feeBreakdown?.region) ||
    asRegionCode(o?.region) ||
    asRegionCode(o?.items?.[0]?.region) ||
    "—"
  );
}

function chargedTotal(o: any) {
  const g = Number(o?.feeBreakdown?.grossAmount);
  if (Number.isFinite(g) && g > 0) return g;
  return Number(o?.totalAmount || 0);
}

type IntegrityFlag = {
  code: string;
  severity: "ok" | "warn" | "critical";
  label: string;
  detail: string;
};

type Integrity = {
  score: number;
  severity: "ok" | "warn" | "critical";
  flags: IntegrityFlag[];
  completeness?: Record<string, boolean>;
};

type MerchantRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  storeName?: string;
  storeDescription?: string;
  businessGoal?: string;
  storeLogo?: string;
  storeBanner?: string;
  marketplaceRegion?: string;
  isSellerVerified?: boolean;
  isSellerSuspended?: boolean;
  lastSeenAt?: string | null;
  lastActivityAt?: string | null;
  createdAt?: string;
  productStats?: { total: number; active: number };
  orderStats?: { total: number; cancelled: number };
  chatStats?: { conversations: number };
  integrity?: Integrity;
};

type MerchantDetail = {
  user: MerchantRow & {
    payout?: { bankName?: string; accountName?: string; accountNumber?: string };
    shippingDefaults?: {
      address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
        landmark?: string;
        label?: string;
      };
      deliveryMethod?: string;
      courierCompany?: string;
    };
    sellerOnboardingCompleted?: boolean;
    businessLocationCompleted?: boolean;
    sellerAppliedAt?: string;
    clerkId?: string;
  };
  lastActivityAt?: string | null;
  integrity: Integrity;
  stats: {
    productCount: number;
    activeProductCount: number;
    orderCount: number;
    cancelledOrderCount: number;
    conversationCount: number;
    messageCount: number;
  };
  products: any[];
  orders: any[];
  conversations: any[];
  subscription: { plan: string; status: string; note: string };
};

function relTime(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const d = Date.now() - t;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function SeverityIcon({ severity }: { severity?: string }) {
  if (severity === "critical")
    return <ShieldAlert className="h-4 w-4 text-[#F87171]" aria-label="Critical" />;
  if (severity === "warn")
    return <AlertTriangle className="h-4 w-4 text-[#FBBF24]" aria-label="Warning" />;
  return <CheckCircle2 className="h-4 w-4 text-[#00E575]" aria-label="Healthy" />;
}

function Gate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") setUnlocked(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EXPECTED_PASSWORD) {
      setErr("Set NEXT_PUBLIC_ADMIN_MERCHANTS_PASSWORD in env.");
      return;
    }
    if (password === EXPECTED_PASSWORD) {
      try {
        sessionStorage.setItem(GATE_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setErr("");
      return;
    }
    setErr("Incorrect password.");
  };

  if (!ready)
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/35">…</div>
    );

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 text-[#F5F7FA]">
        <div className="rounded-2xl border border-white/10 bg-[#0E1116]/95 p-6 sm:p-8">
          <div className="h-px bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
          <Lock className="mt-5 h-5 w-5 text-[#00E575]" />
          <h1 className="mt-3 text-2xl font-semibold">Merchants</h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            Storefront monitoring · integrity scan
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-white/12 bg-[#14181F] px-4 text-sm outline-none focus:border-[#00E575]/45"
            />
            {err ? <p className="text-xs text-red-400">{err}</p> : null}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] text-sm font-extrabold text-[#041412]"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function ActivityFloat({
  summary,
  hidden,
}: {
  summary: {
    total: number;
    new7d: number;
    suspended: number;
    verified: number;
    pageCritical: number;
    pageWarn: number;
    pageAvgScore: number;
  } | null;
  hidden?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || hidden || !summary) return null;

  const score = summary.pageAvgScore;
  const accent =
    summary.pageCritical > 0
      ? "#F87171"
      : summary.pageWarn > 0
        ? "#FBBF24"
        : "#00E575";

  return createPortal(
    <div
      className="pointer-events-none"
      style={{ position: "fixed", left: 16, bottom: 20, zIndex: Z_FLOAT }}
    >
      <div className="pointer-events-auto flex flex-col items-start gap-2 sm:ml-[72px]">
        {open ? (
          <div className="w-[min(calc(100vw-5rem),300px)] overflow-hidden rounded-2xl border border-white/12 bg-[#0A0D12]/96 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div
              className="h-[2px] w-full"
              style={{
                background: `linear-gradient(90deg, ${accent}, #14B8A6, #3B82F6)`,
              }}
            />
            <div className="p-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Merchant pulse
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-[#F5F7FA]">
                Integrity avg {score}
              </p>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, Math.min(100, score))}%`,
                    background: `linear-gradient(90deg, ${accent}, #3B82F6)`,
                  }}
                />
              </div>
              <p className="mt-2.5 text-[10px] leading-snug text-white/40">
                {summary.total} merchants · {summary.new7d} new ·{" "}
                {summary.verified} verified · {summary.suspended} suspended
              </p>
              <p className="mt-1 text-[10px] text-white/30">
                This page: {summary.pageCritical} critical · {summary.pageWarn}{" "}
                warn
              </p>
              <p className="mt-1 text-[9px] text-white/22">
                Rule engine — naming, images, bank, catalog, orders, chat
              </p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Merchant activity"
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/14 bg-[#0A0D12]/96 backdrop-blur-md transition hover:border-white/25"
          style={{ boxShadow: `0 0 0 1px ${accent}33` }}
        >
          <Activity className="h-5 w-5" style={{ color: accent }} />
          {summary.pageCritical > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#F87171]" />
          ) : null}
        </button>
      </div>
    </div>,
    document.body,
  );
}

type LocAddress = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  landmark?: string;
  label?: string;
};

function BusinessLocationCard({
  merchantId,
  address,
  deliveryMethod,
  courierCompany,
  businessLocationCompleted,
  sellerOnboardingCompleted,
  getToken,
  onSaved,
}: {
  merchantId: string;
  address?: LocAddress | null;
  deliveryMethod?: string;
  courierCompany?: string;
  businessLocationCompleted?: boolean;
  sellerOnboardingCompleted?: boolean;
  getToken: () => Promise<string | null>;
  onSaved: (next: LocAddress) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<LocAddress>({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    landmark: "",
    label: "",
  });

  useEffect(() => {
    setForm({
      street: address?.street || "",
      city: address?.city || "",
      state: address?.state || "",
      zipCode: address?.zipCode || "",
      country: address?.country || "",
      landmark: address?.landmark || "",
      label: address?.label || "",
    });
    setEditing(false);
    setErr(null);
  }, [address, merchantId]);

  const set = (k: keyof LocAddress, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.country?.trim() || !form.city?.trim() || !form.street?.trim()) {
      setErr("Country, city and business address are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await adminFetch(
        `/admin/merchants/${merchantId}/business-location`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            street: form.street?.trim(),
            city: form.city?.trim(),
            state: form.state?.trim() || "",
            zipCode: form.zipCode?.trim() || "",
            country: form.country?.trim(),
            landmark: form.landmark?.trim() || "",
            label: form.label?.trim() || "",
          }),
        }
      );
      onSaved({
        street: form.street?.trim(),
        city: form.city?.trim(),
        state: form.state?.trim() || "",
        zipCode: form.zipCode?.trim() || "",
        country: form.country?.trim(),
        landmark: form.landmark?.trim() || "",
        label: form.label?.trim() || "",
      });
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message || "Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const rows: [string, string | undefined][] = [
    ["Label", address?.label],
    ["Street", address?.street],
    ["City", address?.city],
    ["State / Province", address?.state],
    ["Postal / ZIP", address?.zipCode],
    ["Country", address?.country],
    ["Landmark", address?.landmark],
    [
      "Delivery",
      [deliveryMethod, courierCompany].filter(Boolean).join(" · ") || undefined,
    ],
  ];

  const hasLoc = !!(address?.city || address?.street || address?.country);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[#00E575]" />
        <p className="text-[13px] font-bold">Business location</p>
        <div className="ml-auto flex items-center gap-2">
          {businessLocationCompleted ? (
            <Badge tone="green">Complete</Badge>
          ) : (
            <Badge tone="error">Missing</Badge>
          )}
          {sellerOnboardingCompleted === false ? (
            <Badge tone="neutral">Onboarding pending</Badge>
          ) : null}
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/70 hover:border-white/20 hover:text-white"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {!editing ? (
        hasLoc ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map(([k, v]) =>
              v ? (
                <div
                  key={k}
                  className="rounded-xl border border-white/[0.06] bg-[#0A0D12]/50 px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                    {k}
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium text-white/90">
                    {v}
                  </p>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <p className="text-[12px] text-white/40">
            No business location on file. Use Edit to set one.
          </p>
        )
      ) : (
        <div className="space-y-2.5">
          {(
            [
              ["label", "Location label", "e.g. Main warehouse"],
              ["street", "Business address *", "Street, building, suite"],
              ["city", "City *", "City or town"],
              ["state", "State / Province", ""],
              ["zipCode", "Postal / ZIP", ""],
              ["country", "Country *", ""],
              ["landmark", "Landmark", "Optional"],
            ] as const
          ).map(([key, lab, ph]) => (
            <div key={key}>
              <label className="mb-1 block text-[11px] font-semibold text-white/45">
                {lab}
              </label>
              <input
                value={(form as any)[key] || ""}
                onChange={(e) => set(key, e.target.value)}
                placeholder={ph}
                className="h-10 w-full rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] outline-none focus:border-[#00E575]/45"
              />
            </div>
          ))}
          {err ? <p className="text-xs text-red-400">{err}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00E575] to-[#00C060] text-[13px] font-bold text-[#041008] disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save location"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setErr(null);
                setForm({
                  street: address?.street || "",
                  city: address?.city || "",
                  state: address?.state || "",
                  zipCode: address?.zipCode || "",
                  country: address?.country || "",
                  landmark: address?.landmark || "",
                  label: address?.label || "",
                });
              }}
              className="h-10 rounded-xl border border-white/12 px-4 text-[13px] font-semibold text-white/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DetailModal({
  open,
  detail,
  loading,
  onClose,
  getToken,
  setDetail,
}: {
  open: boolean;
  detail: MerchantDetail | null;
  loading: boolean;
  onClose: () => void;
  getToken: () => Promise<string | null>;
  setDetail: Dispatch<SetStateAction<MerchantDetail | null>>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const u = detail?.user;
  const integ = detail?.integrity;
  const storeRegion =
    asRegionCode(u?.marketplaceRegion) || u?.marketplaceRegion || "—";
  const storeCurrency = currencyForRegion(storeRegion) || "NGN";
  const storeCountry = regionName(storeRegion);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-[#0E1116] sm:rounded-2xl">
        <div className="h-[2px] w-full bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Storefront dossier
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold">
              {u?.storeName || u?.name || "Merchant"}
            </h2>
            <p className="truncate text-[12px] text-white/45">
              {u?.email || "—"} · last active {relTime(detail?.lastActivityAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !detail ? (
            <div className="flex justify-center py-16">
              <OrbLoader />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11141A]">
                {u?.storeBanner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.storeBanner}
                    alt=""
                    className="h-28 w-full object-cover sm:h-36"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-white/[0.03] text-[12px] text-white/30 sm:h-36">
                    No banner
                  </div>
                )}
                <div className="absolute -bottom-6 left-4 flex items-end gap-3">
                  {u?.storeLogo || u?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.storeLogo || u.image}
                      alt=""
                      className="h-16 w-16 rounded-2xl object-cover ring-2 ring-[#0E1116]"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#171B22] ring-2 ring-[#0E1116]">
                      <Store className="h-6 w-6 text-white/40" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      u?.isSellerSuspended
                        ? "error"
                        : u?.isSellerVerified
                          ? "green"
                          : "neutral"
                    }
                  >
                    {u?.isSellerSuspended
                      ? "Suspended"
                      : u?.isSellerVerified
                        ? "Verified"
                        : "Unverified"}
                  </Badge>
                  <Badge tone="blue">{storeRegion}</Badge>
                  <Badge tone="neutral">{storeCurrency}</Badge>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-white/50">
                    <SeverityIcon severity={integ?.severity} />
                    Integrity {integ?.score ?? "—"}
                  </span>
                </div>
              </div>

              <section className="rounded-2xl border border-[#00E575]/25 bg-[#00E575]/[0.06] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Marketplace listing region
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {storeRegion}
                  {storeCountry ? ` · ${storeCountry}` : ""}
                </p>
                <p className="mt-1 text-[12px] text-white/50">
                  Listings on this store are priced in {storeCurrency}. Checkout
                  charges that currency. No live conversion.
                </p>
              </section>

              {integ?.flags?.length ? (
                <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Integrity engine
                  </p>
                  <ul className="space-y-2">
                    {integ.flags.map((f) => (
                      <li
                        key={f.code}
                        className="flex gap-2 rounded-xl border border-white/[0.06] bg-[#0A0D12]/60 px-3 py-2"
                      >
                        <SeverityIcon severity={f.severity} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold">{f.label}</p>
                          <p className="text-[11px] text-white/45">{f.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <section className="rounded-2xl border border-[#00E575]/20 bg-[#00E575]/[0.06] p-4 text-[13px] text-[#00E575]">
                  No integrity issues flagged for this storefront.
                </section>
              )}

              <section className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Store name", u?.storeName],
                  ["Owner", u?.name],
                  ["Phone", u?.phone],
                  [
                    "Region",
                    storeRegion !== "—"
                      ? `${storeRegion}${storeCountry ? ` · ${storeCountry}` : ""} · ${storeCurrency}`
                      : "—",
                  ],
                  ["Business goal", u?.businessGoal],
                  [
                    "Bank",
                    u?.payout?.bankName
                      ? `${u.payout.bankName} · ${u.payout.accountName || "—"} · ${u.payout.accountNumber ? "••••" + String(u.payout.accountNumber).slice(-4) : "—"}`
                      : "—",
                  ],
                  ["Joined", u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"],
                ].map(([k, v]) => (
                  <div
                    key={String(k)}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                      {k}
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-white/90">
                      {v || "—"}
                    </p>
                  </div>
                ))}
              </section>

              <BusinessLocationCard
                merchantId={u?._id || ""}
                address={u?.shippingDefaults?.address}
                deliveryMethod={u?.shippingDefaults?.deliveryMethod}
                courierCompany={u?.shippingDefaults?.courierCompany}
                businessLocationCompleted={u?.businessLocationCompleted}
                sellerOnboardingCompleted={u?.sellerOnboardingCompleted}
                getToken={getToken}
                onSaved={(next) => {
                  setDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          user: {
                            ...prev.user,
                            shippingDefaults: {
                              ...(prev.user.shippingDefaults || {}),
                              address: next,
                            },
                            businessLocationCompleted: true,
                          },
                        }
                      : prev
                  );
                }}
              />

              {u?.storeDescription ? (
                <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Description
                  </p>
                  <p className="text-[13px] leading-5 text-white/70">
                    {u.storeDescription}
                  </p>
                </section>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Products", detail.stats.productCount, `${detail.stats.activeProductCount} active`],
                  ["Orders", detail.stats.orderCount, `${detail.stats.cancelledOrderCount} cancelled`],
                  ["Chats", detail.stats.conversationCount, `${detail.stats.messageCount} msgs`],
                  ["Plan", detail.subscription.plan, detail.subscription.status],
                ].map(([a, b, c]) => (
                  <div
                    key={String(a)}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-white/35">
                      {a}
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{b}</p>
                    <p className="text-[10px] text-white/40">{c}</p>
                  </div>
                ))}
              </div>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#00E575]" />
                  <p className="text-[13px] font-bold">Products</p>
                  <span className="ml-auto text-[11px] text-white/35">
                    {detail.products.length}
                  </span>
                </div>
                {detail.products.length === 0 ? (
                  <p className="text-[12px] text-white/40">No listings</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.products.slice(0, 12).map((p: any) => {
                      const cur = listingCurrency(p, u?.marketplaceRegion);
                      const reg = listingRegion(p, u?.marketplaceRegion);
                      return (
                        <li
                          key={p._id}
                          className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-[#0A0D12]/50 px-2.5 py-2"
                        >
                          {p.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.images[0]}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                              <Package className="h-4 w-4 text-white/30" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-white/40">
                              {p.isActive ? "Active" : "Inactive"} · stock{" "}
                              {p.stock ?? "—"} · {reg} · {cur}
                            </p>
                          </div>
                          <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[#00E575]">
                            {fmtMoney(p.price, cur)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#00E575]" />
                  <p className="text-[13px] font-bold">Orders</p>
                  <span className="ml-auto text-[11px] text-white/35">
                    {detail.orders.length}
                  </span>
                </div>
                {detail.orders.length === 0 ? (
                  <p className="text-[12px] text-white/40">No orders yet</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.orders.slice(0, 12).map((o: any) => {
                      const cur = orderCurrency(o);
                      const reg = orderRegion(o);
                      return (
                        <li
                          key={o._id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-[#0A0D12]/50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold">
                              {o.orderNumber}
                            </p>
                            <p className="text-[11px] text-white/40">
                              {o.buyer?.name || o.buyer?.email || "Buyer"} ·{" "}
                              {relTime(o.createdAt)}
                              {o.isSellerOwnedPurchase ? " · self-purchase" : ""}
                              {reg !== "—" ? ` · ${reg}` : ""}
                            </p>
                            <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-[#00E575]">
                              {fmtMoney(chargedTotal(o), cur)}
                              <span className="ml-1 font-normal text-white/35">
                                {cur}
                              </span>
                            </p>
                          </div>
                          <Badge>{o.orderStatus}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#00E575]" />
                  <p className="text-[13px] font-bold">Messages</p>
                  <span className="ml-auto text-[11px] text-white/35">
                    {detail.conversations.length}
                  </span>
                </div>
                {detail.conversations.length === 0 ? (
                  <p className="text-[12px] text-white/40">No conversations</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.conversations.slice(0, 12).map((c: any) => (
                      <li
                        key={c._id}
                        className="rounded-xl border border-white/[0.05] bg-[#0A0D12]/50 px-3 py-2"
                      >
                        <p className="text-[13px] font-semibold">
                          {c.buyer?.name || c.buyer?.email || "Buyer"}
                          {c.product?.name ? (
                            <span className="font-normal text-white/40">
                              {" "}
                              · {c.product.name}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-white/45">
                          {c.lastMessage?.text || "—"}
                        </p>
                        <p className="mt-1 text-[10px] text-white/30">
                          {relTime(c.updatedAt || c.lastMessage?.createdAt)} ·
                          unread {c.unreadBySeller ?? 0}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="pb-2 text-center text-[11px] text-white/30">
                {detail.subscription.note}
              </p>
            </div>
          ) : (
            <ErrorBlock message="Could not load merchant." />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function MerchantsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [items, setItems] = useState<MerchantRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [region, setRegion] = useState("");
  const [severity, setSeverity] = useState("");
  const [sort, setSort] = useState("newest");
  const [spot, setSpot] = useState("");
  const [summary, setSummary] = useState<{
    total: number;
    new7d: number;
    suspended: number;
    verified: number;
    pageCritical: number;
    pageWarn: number;
    pageAvgScore: number;
  } | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (p = 1, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else {
          setLoading(true);
          setError(null);
        }
        const token = await getToken();
        if (!token) return;
        const params = new URLSearchParams({
          page: String(p),
          limit: String(PAGE_SIZE),
          sort,
        });
        if (qLive.trim()) params.set("q", qLive.trim());
        if (region) params.set("region", region);
        if (severity) params.set("severity", severity);
        if (spot) params.set("spot", spot);

        const json = await adminFetch<{
          success: boolean;
          data: {
            items: MerchantRow[];
            page: number;
            pages: number;
            total: number;
            summary: any;
          };
        }>(`/admin/merchants?${params}`, token);

        const list = json.data?.items || [];
        setItems((prev) => (append ? [...prev, ...list] : list));
        setPage(json.data?.page || p);
        setPages(json.data?.pages || 1);
        if (json.data?.summary) setSummary(json.data.summary);
      } catch (e: any) {
        setError(e?.message || "Failed to load merchants");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getToken, qLive, region, severity, sort, spot],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void load(1, false);
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setQLive(q), 320);
    return () => {
      if (qTimer.current) clearTimeout(qTimer.current);
    };
  }, [q]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= pages) return;
    void load(page + 1, true);
  }, [load, loading, loadingMore, page, pages]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, items.length]);

  const openMerchant = async (id: string) => {
    setOpenId(id);
    setModalOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const json = await adminFetch<{ success: boolean; data: MerchantDetail }>(
        `/admin/merchants/${id}`,
        token,
      );
      setDetail(json.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    window.setTimeout(() => {
      setOpenId(null);
      setDetail(null);
    }, 220);
  };

  const criticalCount = useMemo(
    () => items.filter((i) => i.integrity?.severity === "critical").length,
    [items],
  );

  return (
    <Gate>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Marketplace
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight">Merchants</h1>
            <p className="mt-1 text-[13px] text-white/45">
              Prices use each listing’s region currency (US → USD, DE → EUR, NG
              → NGN). Orders show the amount charged at checkout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <Badge tone="error">
                {criticalCount} critical on page
              </Badge>
            ) : null}
            <Button
              type="button"
              tone="ghost"
              onClick={() => void load(1, false)}
              className="h-10 w-10 rounded-xl border border-white/10 p-0"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search store, email, goal…"
              className="h-11 rounded-xl border-white/12 bg-[#14181F] pl-10"
            />
          </div>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-11 rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] outline-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="">All regions</option>
            {REGION_LIST.map((r: any) => (
              <option key={r.code || r} value={r.code || r}>
                {r.name ? `${r.name} (${r.code})` : r.code || r}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-11 rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] outline-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="">All integrity</option>
            <option value="critical">Critical</option>
            <option value="warn">Warn</option>
            <option value="ok">Healthy</option>
          </select>
          <select
            value={spot}
            onChange={(e) => setSpot(e.target.value)}
            className="h-11 rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] outline-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="">All spots</option>
            <option value="new">New 7d</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-11 rounded-xl border border-white/12 bg-[#14181F] px-3 text-[13px] outline-none"
            style={{ colorScheme: "dark" }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="active">Last active</option>
          </select>
        </div>

        {error ? <ErrorBlock message={error} /> : null}

        {loading && items.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <OrbLoader />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No merchants" body="No storefronts match these filters." />
        ) : (
          <ul className="space-y-2.5">
            {items.map((m) => {
              const sev = m.integrity?.severity || "ok";
              const reg = asRegionCode(m.marketplaceRegion) || m.marketplaceRegion || "—";
              const cur = currencyForRegion(reg) || "";
              return (
                <li key={m._id}>
                  <button
                    type="button"
                    onClick={() => void openMerchant(m._id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#11141A]/90 p-3.5 text-left transition hover:border-white/14 hover:bg-[#14181F]",
                      openId === m._id && modalOpen && "border-[#00E575]/35 bg-[#00E575]/[0.05]"
                    )}
                  >
                    {m.storeLogo || m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.storeLogo || m.image}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
                        <Store className="h-5 w-5 text-white/40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-bold">
                          {m.storeName || m.name || "Unnamed store"}
                        </p>
                        <SeverityIcon severity={sev} />
                        {m.isSellerSuspended ? (
                          <span className="text-[10px] font-bold uppercase text-[#F87171]">
                            Suspended
                          </span>
                        ) : m.isSellerVerified ? (
                          <span className="text-[10px] font-bold uppercase text-[#00E575]">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-white/45">
                        {m.email || "—"} · {reg}
                        {cur ? ` · ${cur}` : ""} · {m.productStats?.active ?? 0}{" "}
                        live · {m.orderStats?.total ?? 0} orders
                      </p>
                      {m.integrity?.flags?.[0] ? (
                        <p className="mt-1 truncate text-[11px] text-white/35">
                          {m.integrity.flags[0].label}
                          {m.integrity.flags.length > 1
                            ? ` · +${m.integrity.flags.length - 1} more`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p
                        className={cn(
                          "text-[13px] font-bold tabular-nums",
                          sev === "critical"
                            ? "text-[#F87171]"
                            : sev === "warn"
                              ? "text-[#FBBF24]"
                              : "text-[#00E575]",
                        )}
                      >
                        {m.integrity?.score ?? "—"}
                      </p>
                      <p className="text-[10px] text-white/35">
                        {relTime(m.lastActivityAt || m.lastSeenAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div ref={sentinelRef} className="h-8" />
        {loadingMore ? (
          <p className="py-3 text-center text-[12px] text-white/35">Loading more…</p>
        ) : null}
      </div>

      <ActivityFloat summary={summary} hidden={modalOpen} />
      <DetailModal
        open={modalOpen}
        detail={detail}
        loading={detailLoading}
        onClose={closeModal}
        getToken={getToken}
        setDetail={setDetail}
      />
    </Gate>
  );
}