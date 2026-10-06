"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  CreditCard,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://plazore-api.onrender.com/api";
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
  bank?: string;
  isDefault?: boolean;
};

function maskCard(last4?: string) {
  if (!last4) return "•••• ••••";
  return `•••• ${last4}`;
}

function getBrandMeta(brand?: string) {
  return (
    CARD_BRANDS.find((b) => b.key === brand) ||
    CARD_BRANDS[CARD_BRANDS.length - 1]
  );
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
      <p className="mt-4 text-[13px] font-semibold text-[#737A86]">
        Loading cards…
      </p>
    </div>
  );
}

export default function PaymentMethodsPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
      await fetch(`${API}/payment-methods/${id}`, {
        method: "DELETE",
        headers,
      });
      setDeleteId(null);
      fetchCards();
    } catch {
      setError("Could not remove card");
      setDeleteId(null);
    }
  };

  if (!isLoaded || (loading && isSignedIn)) return <OrbLoader />;

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-[#090B0F]/95 px-3 py-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.08] bg-[#0E1116]"
            aria-label="Back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-[#00E575]">
              Account
            </p>
            <h1 className="truncate text-lg font-extrabold tracking-tight">
              Payment Methods
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {error ? (
          <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        ) : null}

        {/* Security banner */}
        <div className="mb-5 flex gap-3 border border-white/[0.08] bg-[#0E1116] p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#00E575]/25 bg-[#00E575]/10">
            <ShieldCheck className="h-[18px] w-[18px] text-[#00E575]" />
          </span>
          <div>
            <p className="text-[13px] font-bold">Cards stay with Paystack</p>
            <p className="mt-1 text-[12.5px] leading-[18px] text-white/55">
              We never collect full card numbers on this page. After you pay on
              checkout, Paystack returns a secure token. Only the last four
              digits appear here for recognition and defaults.
            </p>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-10 text-center sm:pt-16">
            <div className="mb-4 flex h-20 w-20 items-center justify-center border border-white/[0.08] bg-[#0E1116]">
              <CreditCard className="h-[34px] w-[34px] text-[#737A86]" />
            </div>
            <h2 className="text-[17px] font-bold">No saved cards yet</h2>
            <p className="mt-2 mb-6 max-w-sm text-[13px] leading-5 text-[#A7ADB8]">
              Place an order and complete payment with Paystack. Your card will
              be tokenized securely and listed here for faster checkouts later.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-[22px] py-[13px] text-[15px] font-extrabold text-[#041412]"
              style={{ backgroundImage: GRAD }}
            >
              Browse Showroom
            </Link>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {cards.map((item) => {
                const meta = getBrandMeta(item.brand);
                return (
                  <li key={item._id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        !item.isDefault && handleSetDefault(item._id)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !item.isDefault)
                          handleSetDefault(item._id);
                      }}
                      className={`flex cursor-pointer items-start border p-4 transition-colors ${
                        item.isDefault
                          ? "border-[#00E575]/45 bg-[#14181F]"
                          : "border-white/[0.08] bg-[#0E1116] hover:border-white/[0.14]"
                      }`}
                    >
                      <div
                        className="mr-3 flex h-[34px] w-12 shrink-0 items-center justify-center"
                        style={{ backgroundColor: `${meta.color}22` }}
                      >
                        <span
                          className="text-[10px] font-extrabold tracking-wide"
                          style={{ color: meta.color }}
                        >
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
                        {item.bank ? (
                          <p className="mt-0.5 truncate text-[11px] text-[#737A86]">
                            {item.bank}
                          </p>
                        ) : null}
                        {!item.isDefault ? (
                          <p className="mt-1.5 text-[11px] text-[#737A86]">
                            Click to set as default
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(item._id);
                        }}
                        className="ml-1 p-1.5 text-[#EF4444] transition-opacity hover:opacity-80"
                        aria-label="Remove card"
                      >
                        <Trash2 className="h-[18px] w-[18px]" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 text-center text-[11px] leading-4 text-[#737A86]">
              Managed securely · Paystack tokenisation · Plazore never stores
              full card numbers
            </p>
          </>
        )}
      </main>

      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-5">
          <div className="w-full max-w-sm border border-white/[0.08] bg-[#0E1116] p-5">
            <h3 className="text-base font-bold">Remove card</h3>
            <p className="mt-2 text-sm text-[#A7ADB8]">
              This card will be removed from your account. You can always pay
              again with Paystack on checkout.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-white/[0.08] bg-[#14181F] py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-[#EF4444] py-3 text-sm font-extrabold text-white"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}