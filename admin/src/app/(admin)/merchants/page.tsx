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
  BadgeCheck,
  CheckCircle2,
  CreditCard,
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
  Ban,
  User,
  Clock,
  Percent,
  Image as ImageIcon,
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

/** Aligns with server/config/payment.ts REGION_TO_CURRENCY */
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

/** Plan display helpers (matches monetization plans.ts) */
const PLAN_FEE: Record<string, number> = {
  free: 8,
  dominant: 5,
  business_plus: 3.5,
  global_reach: 2,
  pro: 5,
  business: 3.5,
};

const PLAN_IMAGES: Record<string, number> = {
  free: 6,
  dominant: 12,
  business_plus: 20,
  global_reach: 20,
  pro: 12,
  business: 20,
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free Seller",
  dominant: "Dominant Niche",
  business_plus: "Business Plus",
  global_reach: "Global Reach",
  pro: "Dominant Niche",
  business: "Business Plus",
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

function normalizePlanId(raw?: string | null) {
  const p = String(raw || "free")
    .toLowerCase()
    .trim();
  if (p === "pro" || p === "global" || p === "dominant_niche") return "dominant";
  if (p === "business") return "business_plus";
  return p || "free";
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

type LocAddress = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  landmark?: string;
  label?: string;
};

type MerchantDetail = {
  user: MerchantRow & {
    payout?: {
      bankName?: string;
      accountName?: string;
      accountNumber?: string;
      provider?: string;
      stripeAccountId?: string;
      paystackRecipientCode?: string;
    };
    shippingDefaults?: {
      address?: LocAddress;
      deliveryMethod?: string;
      courierCompany?: string;
    };
    sellerOnboardingCompleted?: boolean;
    businessLocationCompleted?: boolean;
    sellerAppliedAt?: string;
    clerkId?: string;
    role?: string;
    lastSeenPlatform?: string;
    moderation?: {
      status?: string;
      reason?: string;
      publicReason?: string;
      endsAt?: string;
      restrictions?: {
        preventNewListings?: boolean;
        preventPublishing?: boolean;
      };
    };
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
  subscription: {
    plan: string;
    status: string;
    note?: string;
    isPromotional?: boolean;
    endsAt?: string | null;
    currency?: string;
  };
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

/** Accessible switch toggle */
function Toggle({
  checked,
  disabled,
  onChange,
  label,
  tone = "green",
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  tone?: "green" | "red";
}) {
  const on = checked;
  const track =
    tone === "red"
      ? on
        ? "bg-[#F87171]"
        : "bg-white/15"
      : on
        ? "bg-[#00E575]"
        : "bg-white/15";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
        track,
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          on ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
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
            Storefront monitoring · integrity scan · verify & suspend
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
    document.body
  );
}

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
  const locCountry = address?.country || "";
  const locCurrency = currencyForRegion(locCountry) || "";

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MapPin className="h-4 w-4 text-[#00E575]" />
        <p className="text-[13px] font-bold">Business location</p>
        {locCountry ? (
          <span className="text-[11px] text-white/40">
            Pricing country · {locCountry}
            {locCurrency ? ` · ${locCurrency}` : ""}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
                  <p className="mt-0.5 text-[13px] font-medium text-white/90">{v}</p>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <p className="text-[12px] text-white/40">
            No business location on file. This country drives seller plan
            currency (NG → NGN, US → USD). Use Edit to set one.
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
              ["country", "Country *", "e.g. Nigeria or NG"],
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
              className="h-10 rounded-xl border border-white/12 px-4 text-[13px] font-semibold text-white/70"
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
  onListFlagsChanged,
}: {
  open: boolean;
  detail: MerchantDetail | null;
  loading: boolean;
  onClose: () => void;
  getToken: () => Promise<string | null>;
  setDetail: Dispatch<SetStateAction<MerchantDetail | null>>;
  onListFlagsChanged: (id: string, patch: Partial<MerchantRow>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [toggleBusy, setToggleBusy] = useState<"verify" | "suspend" | null>(
    null
  );
  const [toggleErr, setToggleErr] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) {
      setToggleErr(null);
      setToggleBusy(null);
    }
  }, [open]);

  if (!mounted || !open) return null;

  const u = detail?.user;
  const planId = normalizePlanId(detail?.subscription?.plan);
  const planLabel = PLAN_LABEL[planId] || planId;
  const feePct = PLAN_FEE[planId] ?? 8;
  const maxImages = PLAN_IMAGES[planId] ?? 6;
  const marketReg =
    asRegionCode(u?.marketplaceRegion) || u?.marketplaceRegion || "—";
  const bizCountry =
    u?.shippingDefaults?.address?.country ||
    (u as any)?.businessLocation?.country ||
    "";

  const setVerified = async (next: boolean) => {
    if (!u?._id) return;
    setToggleBusy("verify");
    setToggleErr(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await adminFetch(`/admin/sellers/${u._id}/verify`, token, {
        method: "PATCH",
        body: JSON.stringify({ verified: next }),
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              user: { ...prev.user, isSellerVerified: next },
            }
          : prev
      );
      onListFlagsChanged(u._id, { isSellerVerified: next });
    } catch (e: any) {
      setToggleErr(e?.message || "Failed to update verification");
    } finally {
      setToggleBusy(null);
    }
  };

  const setSuspended = async (next: boolean) => {
    if (!u?._id) return;
    setToggleBusy("suspend");
    setToggleErr(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await adminFetch(`/admin/sellers/${u._id}/suspend`, token, {
        method: "PATCH",
        body: JSON.stringify({ suspended: next }),
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              user: { ...prev.user, isSellerSuspended: next },
            }
          : prev
      );
      onListFlagsChanged(u._id, { isSellerSuspended: next });
    } catch (e: any) {
      setToggleErr(e?.message || "Failed to update suspension");
    } finally {
      setToggleBusy(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
      style={{ zIndex: Z_MODAL }}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0E1116] shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />

        {/* Header */}
        <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
          {u?.storeLogo || u?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.storeLogo || u.image}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
              <Store className="h-5 w-5 text-white/40" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold">
              {u?.storeName || u?.name || "Merchant"}
            </p>
            <p className="truncate text-[12px] text-white/45">
              {u?.email || "—"}
              {u?.phone ? ` · ${u.phone}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {u?.isSellerSuspended ? (
                <Badge tone="error">Suspended</Badge>
              ) : u?.isSellerVerified ? (
                <Badge tone="green">Verified</Badge>
              ) : (
                <Badge tone="neutral">Unverified</Badge>
              )}
              {detail?.integrity ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
                  <SeverityIcon severity={detail.integrity.severity} />
                  Score {detail.integrity.score}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/50 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !detail ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <OrbLoader />
            </div>
          ) : detail && u ? (
            <div className="space-y-4">
              {/* ——— Verify / Suspend toggles ——— */}
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Account controls
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                        <BadgeCheck className="h-4 w-4 text-[#00E575]" />
                        Verified seller
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        Badge on storefront · builds buyer trust
                      </p>
                    </div>
                    <Toggle
                      checked={!!u.isSellerVerified}
                      disabled={toggleBusy !== null}
                      onChange={(v) => void setVerified(v)}
                      label="Toggle verified"
                      tone="green"
                    />
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                        <Ban className="h-4 w-4 text-[#F87171]" />
                        Suspended
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        Blocks selling actions while active
                      </p>
                    </div>
                    <Toggle
                      checked={!!u.isSellerSuspended}
                      disabled={toggleBusy !== null}
                      onChange={(v) => void setSuspended(v)}
                      label="Toggle suspended"
                      tone="red"
                    />
                  </div>
                </div>
                {toggleBusy ? (
                  <p className="mt-2 text-[11px] text-white/40">Updating…</p>
                ) : null}
                {toggleErr ? (
                  <p className="mt-2 text-xs text-red-400">{toggleErr}</p>
                ) : null}
              </section>

              {/* ——— Identity & status ——— */}
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-[#00E575]" />
                  <p className="text-[13px] font-bold">Seller profile</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["Name", u.name],
                      ["Email", u.email],
                      ["Phone", u.phone || "—"],
                      ["Role", u.role || "seller"],
                      ["Marketplace region", marketReg],
                      [
                        "Business country",
                        bizCountry || "— (set under location)",
                      ],
                      [
                        "Applied",
                        u.sellerAppliedAt
                          ? new Date(u.sellerAppliedAt).toLocaleDateString()
                          : "—",
                      ],
                      [
                        "Joined",
                        u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : "—",
                      ],
                      [
                        "Last activity",
                        relTime(detail.lastActivityAt || u.lastSeenAt),
                      ],
                      [
                        "Last platform",
                        u.lastSeenPlatform || "—",
                      ],
                      ["Clerk ID", u.clerkId || "—"],
                      [
                        "Onboarding",
                        u.sellerOnboardingCompleted ? "Complete" : "Pending",
                      ],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-xl border border-white/[0.06] bg-[#0A0D12]/50 px-3 py-2"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                        {k}
                      </p>
                      <p className="mt-0.5 break-all text-[13px] font-medium text-white/90">
                        {v}
                      </p>
                    </div>
                  ))}
                </div>
                {u.storeDescription ? (
                  <p className="mt-3 text-[12px] leading-relaxed text-white/55">
                    {u.storeDescription}
                  </p>
                ) : null}
                {u.businessGoal ? (
                  <p className="mt-1.5 text-[12px] text-white/40">
                    Goal: {u.businessGoal}
                  </p>
                ) : null}
              </section>

              {/* ——— Subscription / fee ——— */}
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4 text-[#00E575]" />
                  <p className="text-[13px] font-bold">Subscription & fees</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/[0.06] bg-[#0A0D12]/50 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-white/35">
                      Plan
                    </p>
                    <p className="mt-0.5 text-[15px] font-bold">{planLabel}</p>
                    <p className="text-[11px] text-white/40">
                      {detail.subscription.status || "—"}
                      {detail.subscription.isPromotional ? " · Promo" : ""}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-[#0A0D12]/50 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-white/35">
                      Transaction fee
                    </p>
                    <p className="mt-0.5 text-[15px] font-bold text-[#00E575]">
                      {feePct}%
                    </p>
                    <p className="text-[11px] text-white/40">
                      Of product price (delivery excluded)
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-[#0A0D12]/50 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-white/35">
                      Image limit
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[15px] font-bold">
                      <ImageIcon className="h-3.5 w-3.5 text-white/40" />
                      {maxImages}
                    </p>
                    <p className="text-[11px] text-white/40">Per product</p>
                  </div>
                </div>
                {detail.subscription.endsAt ? (
                  <p className="mt-2 text-[11px] text-white/40">
                    Ends {new Date(detail.subscription.endsAt).toLocaleString()}
                  </p>
                ) : null}
                {detail.subscription.note ? (
                  <p className="mt-1.5 text-[11px] text-white/35">
                    {detail.subscription.note}
                  </p>
                ) : null}
              </section>

              {/* ——— Payout ——— */}
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#00E575]" />
                  <p className="text-[13px] font-bold">Payout</p>
                </div>
                {u.payout?.bankName ||
                u.payout?.accountNumber ||
                u.payout?.stripeAccountId ||
                u.payout?.paystackRecipientCode ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["Bank", u.payout?.bankName],
                        ["Account name", u.payout?.accountName],
                        ["Account number", u.payout?.accountNumber],
                        ["Provider", u.payout?.provider],
                        ["Stripe account", u.payout?.stripeAccountId],
                        ["Paystack recipient", u.payout?.paystackRecipientCode],
                      ] as [string, string | undefined][]
                    )
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded-xl border border-white/[0.06] bg-[#0A0D12]/50 px-3 py-2"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                            {k}
                          </p>
                          <p className="mt-0.5 break-all text-[13px] font-medium">
                            {v}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-white/40">
                    No payout method on file yet.
                  </p>
                )}
              </section>

              {/* ——— Moderation ——— */}
              {u.moderation?.status && u.moderation.status !== "NORMAL" ? (
                <section className="rounded-2xl border border-[#FBBF24]/25 bg-[#FBBF24]/[0.06] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#FBBF24]" />
                    <p className="text-[13px] font-bold">Moderation</p>
                    <Badge tone="neutral">{u.moderation.status}</Badge>
                  </div>
                  {u.moderation.publicReason || u.moderation.reason ? (
                    <p className="text-[12px] text-white/60">
                      {u.moderation.publicReason || u.moderation.reason}
                    </p>
                  ) : null}
                  {u.moderation.endsAt ? (
                    <p className="mt-1 text-[11px] text-white/40">
                      Ends {new Date(u.moderation.endsAt).toLocaleString()}
                    </p>
                  ) : null}
                  {u.moderation.restrictions ? (
                    <p className="mt-1 text-[11px] text-white/40">
                      {u.moderation.restrictions.preventNewListings
                        ? "No new listings · "
                        : ""}
                      {u.moderation.restrictions.preventPublishing
                        ? "Publishing blocked"
                        : ""}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {/* ——— Integrity flags ——— */}
              {detail.integrity?.flags?.length ? (
                <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <p className="mb-2 text-[13px] font-bold">Integrity flags</p>
                  <ul className="space-y-1.5">
                    {detail.integrity.flags.map((f) => (
                      <li
                        key={f.code}
                        className="flex items-start gap-2 text-[12px]"
                      >
                        <SeverityIcon severity={f.severity} />
                        <span>
                          <span className="font-semibold text-white/80">
                            {f.label}
                          </span>
                          {f.detail ? (
                            <span className="text-white/40"> — {f.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <BusinessLocationCard
                merchantId={u._id}
                address={u.shippingDefaults?.address}
                deliveryMethod={u.shippingDefaults?.deliveryMethod}
                courierCompany={u.shippingDefaults?.courierCompany}
                businessLocationCompleted={u.businessLocationCompleted}
                sellerOnboardingCompleted={u.sellerOnboardingCompleted}
                getToken={getToken}
                onSaved={(next) => {
                  setDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          user: {
                            ...prev.user,
                            businessLocationCompleted: true,
                            shippingDefaults: {
                              ...prev.user.shippingDefaults,
                              address: next,
                            },
                          },
                        }
                      : prev
                  );
                }}
              />

              {/* Stats strip */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Products", detail.stats.productCount, `${detail.stats.activeProductCount} live`],
                  ["Orders", detail.stats.orderCount, `${detail.stats.cancelledOrderCount} cancelled`],
                  ["Chats", detail.stats.conversationCount, `${detail.stats.messageCount} msgs`],
                  ["Plan", planLabel, detail.subscription.status],
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

              {/* Products */}
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

              {/* Orders */}
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
                      const feeRate = o?.feeBreakdown?.feeRate;
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
                              {typeof feeRate === "number"
                                ? ` · fee ${(feeRate * 100).toFixed(1)}%`
                                : ""}
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

              {/* Messages */}
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
                Business location country drives plan currency. Marketplace
                region is browse-only.
              </p>
            </div>
          ) : (
            <ErrorBlock message="Could not load merchant." />
          )}
        </div>
      </div>
    </div>,
    document.body
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
    [getToken, qLive, region, severity, sort, spot]
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
      { rootMargin: "240px" }
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
        token
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

  const onListFlagsChanged = (id: string, patch: Partial<MerchantRow>) => {
    setItems((prev) =>
      prev.map((m) => (m._id === id ? { ...m, ...patch } : m))
    );
  };

  const criticalCount = useMemo(
    () => items.filter((i) => i.integrity?.severity === "critical").length,
    [items]
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
              Prices use each listing’s region currency. Verify / suspend from
              the seller detail panel. Business location drives plan pricing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <Badge tone="error">{criticalCount} critical on page</Badge>
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
          <EmptyState
            title="No merchants"
            body="No storefronts match these filters."
          />
        ) : (
          <ul className="space-y-2.5">
            {items.map((m) => {
              const sev = m.integrity?.severity || "ok";
              const reg =
                asRegionCode(m.marketplaceRegion) ||
                m.marketplaceRegion ||
                "—";
              const cur = currencyForRegion(reg) || "";
              return (
                <li key={m._id}>
                  <button
                    type="button"
                    onClick={() => void openMerchant(m._id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#11141A]/90 p-3.5 text-left transition hover:border-white/14 hover:bg-[#14181F]",
                      openId === m._id &&
                        modalOpen &&
                        "border-[#00E575]/35 bg-[#00E575]/[0.05]"
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
                              : "text-[#00E575]"
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
          <p className="py-3 text-center text-[12px] text-white/35">
            Loading more…
          </p>
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
        onListFlagsChanged={onListFlagsChanged}
      />
    </Gate>
  );
}
