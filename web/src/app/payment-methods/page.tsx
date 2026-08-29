"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, CreditCard, Plus, Trash2, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

const CARD_BRANDS = [
  { key: "Visa", color: "#1A1F71", short: "VISA" },
  { key: "Mastercard", color: "#EB001B", short: "MC" },
  { key: "Verve", color: "#004C3F", short: "VERVE" },
  { key: "Amex", color: "#2E77BC", short: "AMEX" },
  { key: "Discover", color: "#FF6000", short: "DISC" },
  { key: "Other", color: "#4B5563", short: "CARD" },
] as const;

type Brand = (typeof CARD_BRANDS)[number]["key"];

type Card = {
  _id: string;
  brand?: Brand | string;
  last4?: string;
  expMonth?: string;
  expYear?: string;
  name?: string;
  isDefault?: boolean;
};

function maskCard(last4?: string) {
  if (!last4) return "•••• ••••";
  return `•••• ${last4}`;
}

function getBrandMeta(brand?: string) {
  return CARD_BRANDS.find((b) => b.key === brand) || CARD_BRANDS[CARD_BRANDS.length - 1];
}

function formatCardNumber(text: string) {
  const cleaned = text.replace(/\D/g, "").slice(0, 16);
  const parts = cleaned.match(/.{1,4}/g);
  return parts ? parts.join(" ") : cleaned;
}

function formatExpiry(text: string) {
  const cleaned = text.replace(/\D/g, "").slice(0, 4);
  if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return cleaned;
}

function OrbLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090B0F]">
      <div className="relative flex h-[110px] w-[110px] items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-[2.4px] border-transparent border-t-[#00E575] border-r-[#3B82F6] border-l-[#00E575]" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00E575]/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
        </div>
      </div>
      <p className="mt-4 text-[13px] font-semibold text-[#737A86]">Loading cards…</p>
    </div>
  );
}

export default function PaymentMethodsPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [brand, setBrand] = useState<Brand>("Visa");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getToken]);

  const fetchCards = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API}/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success) setCards(json.data || []);
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    fetchCards();
  }, [isLoaded, isSignedIn, fetchCards, router]);

  const resetForm = () => {
    setBrand("Visa");
    setName("");
    setNumber("");
    setExpiry("");
    setCvc("");
    setIsDefault(false);
    setFocus(null);
    setError(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    const cleanNumber = number.replace(/\s/g, "");
    if (!name.trim() || cleanNumber.length < 12 || !expiry.trim() || !cvc.trim()) {
      setError("Please fill all card details correctly");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
      setError("Use expiry format MM/YY");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/payment-methods`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          brand,
          name: name.trim(),
          last4: cleanNumber.slice(-4),
          expMonth: expiry.split("/")[0],
          expYear: expiry.split("/")[1],
          isDefault,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setError(json?.message || "Failed to save card");
        return;
      }
      closeModal();
      fetchCards();
    } catch {
      setError("Failed to save card");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const headers = await authHeaders();
      await fetch(`${API}/payment-methods/${id}/default`, {
        method: "PUT",
        headers,
        body: "{}",
      });
      fetchCards();
    } catch {
      setError("Could not set default card");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const headers = await authHeaders();
      await fetch(`${API}/payment-methods/${id}`, { method: "DELETE", headers });
      setDeleteId(null);
      fetchCards();
    } catch {
      setError("Could not delete card");
      setDeleteId(null);
    }
  };

  const fieldClass = (key: string) =>
    `flex min-h-[50px] items-center border bg-[#171B22] px-3.5 ${
      focus === key ? "border-[#00E575] bg-[#00E575]/[0.06]" : "border-white/[0.08]"
    }`;

  if (!isLoaded || (loading && isSignedIn)) return <OrbLoader />;

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-[#090B0F]/95 px-3 py-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.08] bg-[#11141A]"
            aria-label="Back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-[#00E575]">Account</p>
            <h1 className="truncate text-lg font-extrabold tracking-tight">Payment Methods</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ backgroundImage: GRAD }}
          aria-label="Add card"
        >
          <Plus className="h-[22px] w-[22px] text-[#041412]" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {error && !modalOpen ? (
          <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        ) : null}

        {cards.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-16 text-center sm:pt-24">
            <div className="mb-4 flex h-20 w-20 items-center justify-center border border-white/[0.08] bg-[#11141A]">
              <CreditCard className="h-[34px] w-[34px] text-[#737A86]" />
            </div>
            <h2 className="text-[17px] font-bold">No cards yet</h2>
            <p className="mt-1.5 mb-6 text-[13px] leading-5 text-[#A7ADB8]">
              Add a card so checkout is faster and more secure.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-[22px] py-[13px] text-[15px] font-extrabold text-[#041412]"
              style={{ backgroundImage: GRAD }}
            >
              <Plus className="h-[18px] w-[18px]" />
              Add Card
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cards.map((item) => {
              const meta = getBrandMeta(item.brand);
              return (
                <li key={item._id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !item.isDefault && handleSetDefault(item._id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !item.isDefault) handleSetDefault(item._id);
                    }}
                    className={`flex cursor-pointer items-start border p-4 ${
                      item.isDefault
                        ? "border-[#00E575]/45 bg-[#171B22]"
                        : "border-white/[0.08] bg-[#11141A]"
                    }`}
                  >
                    <div
                      className="mr-3 flex h-[34px] w-12 shrink-0 items-center justify-center"
                      style={{ backgroundColor: `${meta.color}22` }}
                    >
                      <span className="text-[10px] font-extrabold tracking-wide" style={{ color: meta.color }}>
                        {meta.short}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="max-w-[70%] truncate text-[15px] font-bold">
                          {item.brand || "Card"} {maskCard(item.last4)}
                        </p>
                        {item.isDefault ? (
                          <span className="inline-flex items-center gap-0.5 bg-[#00E575]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#00E575]">
                            <Check className="h-[11px] w-[11px]" />
                            DEFAULT
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[13px] leading-[18px] text-[#A7ADB8]">
                        Expires {item.expMonth}/{item.expYear}
                        {item.name ? ` · ${item.name}` : ""}
                      </p>
                      {!item.isDefault ? (
                        <p className="mt-1.5 text-[11px] text-[#737A86]">Tap to set as default</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(item._id);
                      }}
                      className="ml-1 p-1.5 text-[#EF4444]"
                      aria-label="Delete card"
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {modalOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/72 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden border-t border-white/[0.08] bg-[#11141A] sm:border">
            <div className="flex items-center justify-between px-5 pt-5 pb-2 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-[#00E575]">Secure</p>
                <h2 className="text-[19px] font-extrabold">New Card</h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-[34px] w-[34px] items-center justify-center border border-white/[0.08] bg-[#171B22]"
                aria-label="Close"
              >
                <X className="h-[18px] w-[18px] text-[#A7ADB8]" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-8 sm:px-6">
              {error ? (
                <p className="mt-3 border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                  {error}
                </p>
              ) : null}

              <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Card brand
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CARD_BRANDS.map((b) => {
                  const active = brand === b.key;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setBrand(b.key)}
                      className={`flex items-center gap-2 px-2.5 py-2.5 text-left text-xs font-semibold ${
                        active
                          ? "border border-[#00E575] bg-[#00E575]/8 text-[#F5F7FA]"
                          : "border border-white/[0.08] bg-[#171B22] text-[#A7ADB8]"
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="truncate">{b.key}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3.5 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Name on card *
              </p>
              <div className={fieldClass("name")}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoCapitalize="words"
                  onFocus={() => setFocus("name")}
                  onBlur={() => setFocus(null)}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                />
              </div>

              <p className="mt-3.5 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Card number *
              </p>
              <div className={fieldClass("number")}>
                <input
                  value={number}
                  onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                  placeholder="ACCT-000003"
                  inputMode="numeric"
                  maxLength={19}
                  onFocus={() => setFocus("number")}
                  onBlur={() => setFocus(null)}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mt-3.5 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    Expiry *
                  </p>
                  <div className={fieldClass("expiry")}>
                    <input
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      inputMode="numeric"
                      maxLength={5}
                      onFocus={() => setFocus("expiry")}
                      onBlur={() => setFocus(null)}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                    />
                  </div>
                </div>
                <div>
                  <p className="mt-3.5 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    CVC *
                  </p>
                  <div className={fieldClass("cvc")}>
                    <input
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="123"
                      inputMode="numeric"
                      maxLength={4}
                      type="password"
                      onFocus={() => setFocus("cvc")}
                      onBlur={() => setFocus(null)}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDefault((v) => !v)}
                className="mt-[18px] flex w-full items-center gap-2.5 text-left"
              >
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 ${
                    isDefault ? "border-[#00E575] bg-[#00E575]" : "border-[#737A86]"
                  }`}
                >
                  {isDefault ? <Check className="h-3.5 w-3.5 text-[#090B0F]" /> : null}
                </span>
                <span className="text-sm font-medium">Set as default payment method</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-6 flex h-[50px] w-full items-center justify-center text-base font-extrabold text-[#041412] disabled:opacity-60"
                style={{
                  backgroundImage: saving ? "none" : GRAD,
                  backgroundColor: saving ? "#4B5563" : undefined,
                }}
              >
                {saving ? "Saving…" : "Save Card"}
              </button>

              <p className="mt-3.5 text-center text-[11px] leading-4 text-[#737A86]">
                Only the last 4 digits are stored. Full payment processing comes with Stripe later.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-5">
          <div className="w-full max-w-sm border border-white/[0.08] bg-[#11141A] p-5">
            <h3 className="text-base font-bold">Delete Card</h3>
            <p className="mt-2 text-sm text-[#A7ADB8]">Remove this card?</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-white/[0.08] bg-[#171B22] py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-[#EF4444] py-3 text-sm font-extrabold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}