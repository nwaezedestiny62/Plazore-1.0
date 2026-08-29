"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Check,
  ChevronLeft,
  Home,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";

const ADDRESS_TYPES = [
  { key: "Home" as const, Icon: Home },
  { key: "Office" as const, Icon: Briefcase },
  { key: "Other" as const, Icon: MapPin },
];

type AddressType = "Home" | "Office" | "Other";

type Address = {
  _id: string;
  type: AddressType | string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault?: boolean;
};

function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "Home") return <Home className={className} />;
  if (type === "Office") return <Briefcase className={className} />;
  return <MapPin className={className} />;
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
      <p className="mt-4 text-[13px] font-semibold text-[#737A86]">Loading addresses…</p>
    </div>
  );
}

export default function AddressesPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [type, setType] = useState<AddressType>("Home");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [getToken]);

  const fetchAddresses = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/addresses`, { headers });
      const json = await res.json();
      if (json?.success) setAddresses(json.data || []);
    } catch {
      /* keep list */
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    fetchAddresses();
  }, [isLoaded, isSignedIn, fetchAddresses, router]);

  const resetForm = () => {
    setType("Home");
    setStreet("");
    setCity("");
    setState("");
    setZipCode("");
    setCountry("");
    setIsDefault(false);
    setFocus(null);
    setError(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!street.trim() || !city.trim() || !state.trim() || !zipCode.trim() || !country.trim()) {
      setError("Please fill all address fields");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/addresses`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type,
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          country: country.trim(),
          isDefault,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setError(json?.message || "Failed to save address");
        return;
      }
      closeModal();
      fetchAddresses();
    } catch {
      setError("Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/addresses/${id}/default`, {
        method: "PUT",
        headers,
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (json?.success) fetchAddresses();
    } catch {
      setError("Could not set default address");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const headers = await authHeaders();
      await fetch(`${API}/addresses/${id}`, { method: "DELETE", headers });
      setDeleteId(null);
      fetchAddresses();
    } catch {
      setError("Could not delete address");
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
            <h1 className="text-lg font-extrabold tracking-tight sm:text-[18px]">Addresses</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ backgroundImage: GRAD }}
          aria-label="Add address"
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

        {addresses.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-16 text-center sm:pt-24">
            <div className="mb-4 flex h-20 w-20 items-center justify-center border border-white/[0.08] bg-[#11141A]">
              <MapPin className="h-[34px] w-[34px] text-[#737A86]" />
            </div>
            <h2 className="text-[17px] font-bold">No addresses yet</h2>
            <p className="mt-1.5 mb-6 text-[13px] leading-5 text-[#A7ADB8]">
              Add a Home, Office or other location so checkout is faster.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-[22px] py-[13px] text-[15px] font-extrabold text-[#041412]"
              style={{ backgroundImage: GRAD }}
            >
              <Plus className="h-[18px] w-[18px]" />
              Add Address
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {addresses.map((item) => (
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
                    className={`mr-3 flex h-[42px] w-[42px] shrink-0 items-center justify-center border ${
                      item.isDefault
                        ? "border-[#00E575] bg-[#00E575] text-[#090B0F]"
                        : "border-white/[0.08] bg-[#171B22] text-[#A7ADB8]"
                    }`}
                  >
                    <TypeIcon type={item.type} className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-bold">{item.type}</p>
                      {item.isDefault ? (
                        <span className="inline-flex items-center gap-0.5 bg-[#00E575]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#00E575]">
                          <Check className="h-[11px] w-[11px]" />
                          DEFAULT
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[13px] leading-[19px] text-[#A7ADB8]">
                      {item.street}
                      <br />
                      {item.city}, {item.state} {item.zipCode}
                      <br />
                      {item.country}
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
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {modalOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/72 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden border-t border-white/[0.08] bg-[#11141A] sm:border">
            <div className="flex items-center justify-between px-5 pt-5 pb-2 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-[#00E575]">Delivery</p>
                <h2 className="text-[19px] font-extrabold">New Address</h2>
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
                Address type
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ADDRESS_TYPES.map((t) => {
                  const active = type === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={`flex items-center justify-center gap-1.5 py-3 text-xs font-semibold ${
                        active
                          ? "bg-[#00E575] text-[#090B0F]"
                          : "border border-white/[0.08] bg-[#171B22] text-[#A7ADB8]"
                      }`}
                    >
                      <t.Icon className="h-4 w-4" />
                      {t.key}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                Street *
              </p>
              <div className={fieldClass("street")}>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Street address"
                  onFocus={() => setFocus("street")}
                  onBlur={() => setFocus(null)}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    City *
                  </p>
                  <div className={fieldClass("city")}>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      onFocus={() => setFocus("city")}
                      onBlur={() => setFocus(null)}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                    />
                  </div>
                </div>
                <div>
                  <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    State *
                  </p>
                  <div className={fieldClass("state")}>
                    <input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                      onFocus={() => setFocus("state")}
                      onBlur={() => setFocus(null)}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                    />
                  </div>
                </div>
                <div>
                  <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    Zip code *
                  </p>
                  <div className={fieldClass("zip")}>
                    <input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="Zip"
                      onFocus={() => setFocus("zip")}
                      onBlur={() => setFocus(null)}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                    />
                  </div>
                </div>
                <div>
                  <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#737A86]">
                    Country *
                  </p>
                  <div className={fieldClass("country")}>
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country"
                      onFocus={() => setFocus("country")}
                      onBlur={() => setFocus(null)}
                      className="w-full bg-transparent text-[15px] outline-none placeholder:text-[#737A86]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDefault((v) => !v)}
                className="mt-[18px] flex w-full items-center gap-3 border border-white/[0.08] bg-[#171B22] p-3.5 text-left"
              >
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 ${
                    isDefault ? "border-[#00E575] bg-[#00E575]" : "border-[#737A86]"
                  }`}
                >
                  {isDefault ? <Check className="h-3.5 w-3.5 text-[#090B0F]" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-semibold">Set as default address</span>
                  <span className="mt-0.5 block text-[11px] text-[#737A86]">
                    Used automatically at checkout
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-6 flex h-[50px] w-full items-center justify-center text-base font-extrabold text-[#041412] disabled:opacity-60"
                style={{ backgroundImage: saving ? "none" : GRAD, backgroundColor: saving ? "#4B5563" : undefined }}
              >
                {saving ? "Saving…" : "Save Address"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-5">
          <div className="w-full max-w-sm border border-white/[0.08] bg-[#11141A] p-5">
            <h3 className="text-base font-bold">Delete Address</h3>
            <p className="mt-2 text-sm text-[#A7ADB8]">Remove this address?</p>
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