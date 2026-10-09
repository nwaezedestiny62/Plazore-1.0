"use client";

import { useAuth } from "@clerk/nextjs";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  LockOpen,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";
const GRAD = "linear-gradient(90deg,#00E575,#3B82F6)";

const NGN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "00103", name: "Globus Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "999992", name: "OPay" },
  { code: "999991", name: "PalmPay" },
] as const;

type OverlayTone = "info" | "success" | "danger";
type OverlayAction = {
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
};
type Overlay = {
  title: string;
  message?: string;
  tone?: OverlayTone;
  actions?: OverlayAction[];
  durationMs?: number;
} | null;

type FormState = {
  region: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  payoutStatus: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  deliveryMethod: "" | "courier" | "self";
  courierCompany: string;
};

const empty: FormState = {
  region: "NG",
  bankCode: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  payoutStatus: "incomplete",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  deliveryMethod: "",
  courierCompany: "",
};

function maskAccount(n: string) {
  const d = n.replace(/\D/g, "");
  if (d.length <= 4) return d || "—";
  return `••••${d.slice(-4)}`;
}

function summarizeChanges(before: FormState, after: FormState): string[] {
  const lines: string[] = [];
  const push = (label: string, a: string, b: string) => {
    if (a.trim() === b.trim()) return;
    lines.push(`${label}: ${a || "—"} → ${b || "—"}`);
  };
  const bankA =
    NGN_BANKS.find((b) => b.code === before.bankCode)?.name || before.bankName;
  const bankB =
    NGN_BANKS.find((b) => b.code === after.bankCode)?.name || after.bankName;
  push("Bank", bankA, bankB);
  push("Account name", before.accountName, after.accountName);
  if (before.accountNumber.trim() !== after.accountNumber.trim()) {
    lines.push(
      `Account number: ${maskAccount(before.accountNumber)} → ${maskAccount(after.accountNumber)}`
    );
  }
  const label = (v: string) =>
    v === "self" ? "Self delivery" : v === "courier" ? "Courier" : "None";
  push("Street", before.street, after.street);
  push("City", before.city, after.city);
  push("State", before.state, after.state);
  push("Zip", before.zipCode, after.zipCode);
  push("Country", before.country, after.country);
  push(
    "Delivery method",
    label(before.deliveryMethod),
    label(after.deliveryMethod)
  );
  push("Courier company", before.courierCompany, after.courierCompany);
  return lines;
}

async function readJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const t = await res.text();
    throw new Error(`Bad response ${res.status}: ${t.slice(0, 60)}`);
  }
  return res.json();
}

function TopOverlay({
  state,
  onDismiss,
}: {
  state: Overlay;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!state || state.actions?.length) return;
    const t = setTimeout(onDismiss, state.durationMs ?? 3800);
    return () => clearTimeout(t);
  }, [state, onDismiss]);

  if (!state) return null;
  const accent =
    state.tone === "danger"
      ? "#EF4444"
      : state.tone === "success"
        ? "#00E575"
        : "#3B82F6";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-3.5 pt-3">
      <div className="pointer-events-auto flex w-full max-w-lg overflow-hidden border border-white/10 bg-[#11141A] shadow-2xl">
        <span className="w-[3px] shrink-0" style={{ backgroundColor: accent }} />
        <div className="flex-1 p-3.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">{state.title}</p>
              {state.message && (
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[19px] text-[#A7ADB8]">
                  {state.message}
                </p>
              )}
            </div>
            {!state.actions?.length && (
              <button type="button" onClick={onDismiss} aria-label="Close">
                <X className="h-4 w-4 text-[#737A86]" />
              </button>
            )}
          </div>
          {!!state.actions?.length && (
            <div className="mt-3.5 flex gap-2.5">
              {state.actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    onDismiss();
                    setTimeout(() => a.onPress(), 40);
                  }}
                  className={`flex-1 py-3 text-[13px] font-extrabold ${
                    a.primary
                      ? "bg-[#00E575] text-[#041412]"
                      : a.destructive
                        ? "bg-[#EF4444]/12 text-[#EF4444]"
                        : "border border-white/[0.07] bg-[#171B22]"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="mb-3.5">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
        {label}
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        maxLength={maxLength}
        readOnly={readOnly}
        className="w-full rounded-[14px] border border-white/[0.07] bg-[#0A121C] px-3.5 py-[13px] text-[15px] text-[#F5F7FA] outline-none placeholder:text-[#3D5268] focus:border-[#00E575]/40 read-only:opacity-70"
        autoComplete="off"
      />
    </div>
  );
}

export default function SellerPayoutPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [unlocked, setUnlocked] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [pendingConnect, setPendingConnect] = useState(false);
  const [lastFour, setLastFour] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showBanks, setShowBanks] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [baseline, setBaseline] = useState<FormState>(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);

  const isNigeria = (form.region || "NG").toUpperCase() === "NG";
  const selectedBank = NGN_BANKS.find((b) => b.code === form.bankCode);

  const toast = useCallback(
    (title: string, message?: string, tone: OverlayTone = "info") => {
      setOverlay({ title, message, tone, durationMs: 3800 });
    },
    []
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    return () => {
      setUnlocked(false);
      setLastFour("");
      setSetupRequired(false);
    };
  }, []);

  const loadSensitive = async () => {
    try {
      setLoading(true);
      const token = await getTokenRef.current();
      const res = await fetch(`${API}/seller/store`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await readJson(res);
      if (json?.success) {
        const d = json.data;
        const next: FormState = {
          region: d.marketplaceRegion || "NG",
          bankCode: d.payout?.bankCode || "",
          bankName: d.payout?.bankName || "",
          accountName: d.payout?.accountName || "",
          accountNumber: d.payout?.accountNumber || "",
          payoutStatus: d.payout?.status || "incomplete",
          street: d.shippingDefaults?.address?.street || "",
          city: d.shippingDefaults?.address?.city || "",
          state: d.shippingDefaults?.address?.state || "",
          zipCode: d.shippingDefaults?.address?.zipCode || "",
          country: d.shippingDefaults?.address?.country || "",
          deliveryMethod: d.shippingDefaults?.deliveryMethod || "",
          courierCompany: d.shippingDefaults?.courierCompany || "",
        };
        setForm(next);
        setBaseline(next);
        if (next.payoutStatus === "pending_connect") setPendingConnect(true);
      }
    } catch {
      toast("Error", "Could not load payout details", "danger");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    const digits = String(lastFour).replace(/\D/g, "").slice(0, 4);
    if (digits.length !== 4) {
      toast("Required", "Enter exactly 4 digits", "danger");
      return;
    }
    try {
      setVerifying(true);
      const token = await getTokenRef.current();
      if (!token) {
        toast("Error", "Not signed in", "danger");
        return;
      }
      const res = await fetch(`${API}/seller/store/verify-payout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lastFour: digits }),
      });
      const json = await readJson(res);
      if (json?.success && json?.data?.unlocked) {
        setUnlocked(true);
        setSetupRequired(!!json.data.setupRequired);
        setPendingConnect(!!json.data.pendingConnect);
        await loadSensitive();
      } else {
        toast("Access denied", json?.message || "Could not unlock", "danger");
      }
    } catch (e: any) {
      toast("Access denied", e?.message || "Digits did not match", "danger");
    } finally {
      setVerifying(false);
    }
  };

  const performSave = async () => {
    try {
      setSaving(true);
      const token = await getTokenRef.current();
      const fd = new FormData();
      const bankName =
        NGN_BANKS.find((b) => b.code === form.bankCode)?.name || form.bankName;
      fd.append(
        "payout",
        JSON.stringify(
          isNigeria
            ? {
                bankCode: form.bankCode,
                bankName,
                accountName: form.accountName.trim(),
                accountNumber: form.accountNumber.replace(/\D/g, ""),
              }
            : { provider: "stripe" }
        )
      );
      fd.append(
        "shippingDefaults",
        JSON.stringify({
          address: {
            street: form.street.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            zipCode: form.zipCode.trim(),
            country: form.country.trim(),
          },
          deliveryMethod: form.deliveryMethod,
          courierCompany: form.courierCompany.trim(),
        })
      );

      const res = await fetch(`${API}/seller/store`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await readJson(res);
      if (json?.success) {
        const savedName = json.data?.payout?.accountName || form.accountName;
        const savedStatus = json.data?.payout?.status || form.payoutStatus;
        const next = {
          ...form,
          bankName,
          accountName: savedName,
          payoutStatus: savedStatus,
        };
        setForm(next);
        setBaseline(next);
        setSetupRequired(false);
        toast(
          savedStatus === "verified" ? "Account verified" : "Updated",
          savedStatus === "verified"
            ? `Paystack confirmed ${savedName}.`
            : savedStatus === "pending_connect"
              ? "Shipping saved. Stripe Connect is still required before payout."
              : "Saved. Paystack will verify this account when keys are set.",
          "success"
        );
      } else {
        toast("Error", json?.message || "Could not save", "danger");
      }
    } catch (e: any) {
      toast("Error", e?.message || "Could not save", "danger");
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (isNigeria) {
      if (!form.bankCode) {
        toast("Required", "Select your bank", "danger");
        return;
      }
      if (!/^\d{10}$/.test(form.accountNumber.replace(/\D/g, ""))) {
        toast("Required", "Account number must be 10 digits", "danger");
        return;
      }
    }
    const changes = summarizeChanges(baseline, form);
    if (!changes.length) {
      toast("No changes", "Nothing was modified.", "info");
      return;
    }
    const list = changes.map((c) => `• ${c}`).join("\n");
    setOverlay({
      title: "Confirm update",
      message:
        `You are about to update:\n\n${list}\n\n` +
        (isNigeria
          ? "Future Paystack payouts use this bank account. Shipping defaults apply to new products."
          : "Stripe Connect is not linked yet. Shipping defaults still save."),
      tone: "info",
      actions: [
        { label: "No", onPress: () => {} },
        { label: "Proceed", primary: true, onPress: () => performSave() },
      ],
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#090B0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575]/30 border-t-[#00E575]" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#090B0F] px-6 text-center">
        <p className="font-semibold">Sign in required</p>
        <Link href="/sign-in" className="mt-4 font-bold text-[#00E575]">
          Sign in
        </Link>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen flex-col bg-[#090B0F] text-[#F5F7FA]">
        <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00E575]/12">
            <ShieldCheck className="h-7 w-7 text-[#00E575]" />
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight">
            Protected details
          </h1>
          <p className="mb-6 mt-2 text-sm leading-[21px] text-[#A7ADB8]">
            Payout account and shipping defaults are sensitive. Enter the last 4
            digits of the account number to continue.
          </p>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
            Last 4 digits
          </p>
          <input
            value={lastFour}
            onChange={(e) =>
              setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            type="password"
            autoFocus
            className="mb-3 w-full rounded-[14px] border border-white/[0.07] bg-[#0A121C] py-[13px] text-center text-[22px] font-bold tracking-[0.4em] text-[#F5F7FA] outline-none focus:border-[#00E575]/40"
          />
          <button
            type="button"
            onClick={verify}
            disabled={verifying || lastFour.length !== 4}
            className="flex h-[50px] w-full items-center justify-center text-[15px] font-extrabold text-[#041412] disabled:opacity-50"
            style={{ backgroundImage: GRAD }}
          >
            {verifying ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/30 border-t-[#041412]" />
            ) : (
              "Unlock"
            )}
          </button>
          <p className="mt-4 text-xs leading-[18px] text-[#737A86]">
            First time with no Nigerian account saved? Any 4 digits open setup.
            Stripe regions open the same way until Connect is linked.
          </p>
          <Link
            href="/seller/settings"
            className="mt-6 text-center text-[13px] text-[#737A86]"
          >
            Go back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <TopOverlay state={overlay} onDismiss={() => setOverlay(null)} />
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-3 backdrop-blur">
        <Link
          href="/seller/settings"
          className="flex h-10 w-10 items-center justify-center"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[17px] font-extrabold">Payout & shipping</h1>
        </div>
        <span className="mr-2 inline-flex items-center gap-1 bg-[#00E575]/10 px-2 py-1 text-[11px] font-bold text-[#00E575]">
          <LockOpen className="h-3.5 w-3.5" /> Unlocked
        </span>
      </header>

      <div className="mx-auto max-w-lg px-[18px] py-5 pb-14">
        <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#737A86]">
          Sensitive
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
          Payout & shipping
        </h2>
        <p className="mb-4 mt-1.5 text-[13px] leading-[19px] text-[#A7ADB8]">
          Where Plazore sends your earnings, and default shipping for new
          products. Leaving this screen locks access again.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00E575]/30 border-t-[#00E575]" />
          </div>
        ) : (
          <>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#737A86]">
              Payout account
            </p>
            <div className="mb-[18px] border border-white/[0.07] bg-[#11141A] p-3.5">
              {isNigeria ? (
                <>
                  {setupRequired && (
                    <div className="mb-3.5 rounded-[14px] border border-[#5C3D1E] bg-[#2A1F14] px-3.5 py-3">
                      <p className="text-[13px] font-bold text-[#F0C070]">
                        Select your bank
                      </p>
                      <p className="mt-1 text-xs leading-[18px] text-[#C4A882]">
                        A typed bank name cannot be paid. Pick the bank, then the
                        10-digit account number.
                      </p>
                    </div>
                  )}
                  {form.payoutStatus === "verified" && (
                    <p className="mb-3 text-[12px] font-bold text-[#00E575]">
                      Verified with Paystack
                    </p>
                  )}
                  {form.payoutStatus === "unverified" && (
                    <p className="mb-3 text-[12px] font-semibold text-[#F0C070]">
                      Saved, not verified yet. Add Paystack keys and save again.
                    </p>
                  )}
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    Bank
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowBanks((v) => !v)}
                    className="mb-3 flex w-full items-center rounded-[14px] border border-white/[0.07] bg-[#0A121C] px-3.5 py-[13px] text-left"
                  >
                    <span className="flex-1 text-[15px]">
                      {selectedBank?.name || form.bankName || "Select bank"}
                    </span>
                    {showBanks ? (
                      <ChevronUp className="h-4 w-4 text-[#737A86]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[#737A86]" />
                    )}
                  </button>
                  {showBanks && (
                    <div className="mb-3 max-h-56 overflow-y-auto border border-white/[0.07] bg-[#0A121C]">
                      {NGN_BANKS.map((b) => {
                        const on = form.bankCode === b.code;
                        return (
                          <button
                            key={b.code}
                            type="button"
                            onClick={() => {
                              setField("bankCode", b.code);
                              setField("bankName", b.name);
                              setShowBanks(false);
                            }}
                            className={`flex w-full items-center px-3.5 py-3 text-left text-[14px] ${
                              on ? "bg-[#00E575]/10 text-[#00E575]" : ""
                            }`}
                          >
                            <span className="flex-1">{b.name}</span>
                            {on && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <Field
                    label="Account name"
                    value={form.accountName}
                    onChange={(t) => setField("accountName", t)}
                    placeholder="Filled by Paystack when keys are on"
                    readOnly={form.payoutStatus === "verified"}
                  />
                  <Field
                    label="Account number"
                    value={form.accountNumber}
                    onChange={(t) =>
                      setField(
                        "accountNumber",
                        t.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    placeholder="0123456789"
                  />
                </>
              ) : (
                <div className="rounded-[14px] border border-[#5C3D1E] bg-[#2A1F14] px-3.5 py-3">
                  <p className="text-[13px] font-bold text-[#F0C070]">
                    Stripe Connect not linked
                  </p>
                  <p className="mt-1 text-xs leading-[18px] text-[#C4A882]">
                    {form.region} sellers are not paid with a Nigerian account
                    number. Earnings stay held until Stripe Connect is added.
                    You can still save shipping defaults below.
                  </p>
                  {pendingConnect ? null : null}
                </div>
              )}
            </div>

            <p className="mb-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#737A86]">
              Shipping defaults
            </p>
            <div className="mb-[18px] border border-white/[0.07] bg-[#11141A] p-3.5">
              <Field
                label="Street"
                value={form.street}
                onChange={(t) => setField("street", t)}
                placeholder="Street address"
              />
              <Field
                label="City"
                value={form.city}
                onChange={(t) => setField("city", t)}
              />
              <Field
                label="State"
                value={form.state}
                onChange={(t) => setField("state", t)}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <Field
                  label="Zip"
                  value={form.zipCode}
                  onChange={(t) => setField("zipCode", t)}
                />
                <Field
                  label="Country"
                  value={form.country}
                  onChange={(t) => setField("country", t)}
                />
              </div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Default method
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                {(["courier", "self"] as const).map((m) => {
                  const active = form.deliveryMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setField("deliveryMethod", m)}
                      className={`flex flex-col items-center rounded-[14px] border py-3.5 ${
                        active
                          ? "border-[#00E575]/40 bg-[#00E575]/8"
                          : "border-white/[0.07] bg-[#0A121C]"
                      }`}
                    >
                      <Truck
                        className={`h-[18px] w-[18px] ${active ? "text-[#00E575]" : "text-[#737A86]"}`}
                      />
                      <span
                        className={`mt-1.5 text-[13px] font-semibold ${
                          active ? "text-[#F5F7FA]" : "text-[#737A86]"
                        }`}
                      >
                        {m === "self" ? "Self delivery" : "Courier"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {form.deliveryMethod === "courier" && (
                <Field
                  label="Courier company"
                  value={form.courierCompany}
                  onChange={(t) => setField("courierCompany", t)}
                  placeholder="e.g. DHL, GIG"
                />
              )}
            </div>

            <button
              type="button"
              onClick={requestSave}
              disabled={saving}
              className="flex h-[50px] w-full items-center justify-center text-[15px] font-extrabold text-[#041412] disabled:opacity-60"
              style={{ backgroundImage: GRAD }}
            >
              {saving ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#041412]/30 border-t-[#041412]" />
              ) : (
                "Save payout & shipping"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}