"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  CheckCircle2,
  MessageCircle,
  AlertTriangle,
  Store,
  Package,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const CONTACT_CATEGORIES = [
  { value: "buying", label: "Buying on Plazore" },
  { value: "selling", label: "Selling on Plazore" },
  { value: "order_payment", label: "Order or payment enquiry" },
  { value: "delivery", label: "Delivery or fulfilment help" },
  { value: "feedback", label: "Feedback or suggestion" },
  { value: "technical", label: "Technical problem" },
  { value: "account", label: "Account assistance" },
  { value: "other", label: "Something else" },
];

const PRODUCT_REPORT_REASONS = [
  { value: "counterfeit", label: "Counterfeit or suspected fake product" },
  { value: "misleading_info", label: "Misleading product information" },
  { value: "photos_mismatch", label: "Product photos do not match" },
  { value: "incorrect_specs", label: "Incorrect specifications" },
  { value: "misleading_price", label: "Incorrect or misleading price" },
  { value: "unavailable", label: "Product unavailable despite being listed" },
  { value: "unsafe_prohibited", label: "Unsafe or prohibited product" },
  { value: "ip_concern", label: "Intellectual property concern" },
  { value: "suspicious_listing", label: "Suspicious listing/activity" },
  { value: "other_product", label: "Other product issue" },
];

const STORE_REPORT_REASONS = [
  { value: "fraudulent_store", label: "Suspected fraudulent store" },
  { value: "impersonation", label: "Store impersonation" },
  { value: "misleading_business", label: "Misleading business information" },
  { value: "abusive_behaviour", label: "Abusive or inappropriate behaviour" },
  { value: "repeated_misleading", label: "Repeated misleading listings" },
  { value: "prohibited_activity", label: "Prohibited business activity" },
  { value: "ip_concern_store", label: "Intellectual property concern" },
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "other_store", label: "Other store issue" },
];

function wordCount(text: string) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function ContactPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const mode = (search.get("mode") || "contact").toLowerCase(); // contact | report
  const contextType = (search.get("context") || "general").toLowerCase();
  const productId = search.get("productId") || "";
  const storeId = search.get("storeId") || "";
  const orderId = search.get("orderId") || "";

  const isReport = mode === "report";
  const isStoreContext = contextType === "store" || !!storeId;
  const isProductContext = contextType === "product" || !!productId;

  const roleMeta = (user?.publicMetadata?.role as string) || "buyer";
  const canSeller = roleMeta === "seller" || roleMeta === "admin";

  const [contactAs, setContactAs] = useState<"buyer" | "seller">(
    canSeller ? "seller" : "buyer"
  );
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(
    user?.primaryEmailAddress?.emailAddress || ""
  );
  const [country, setCountry] = useState("NG");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");

  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const words = useMemo(() => wordCount(message), [message]);

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [user]);

  // Resolve context labels
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (productId) {
          const res = await fetch(`${API}/products/${productId}`);
          if (res.ok) {
            const json = await res.json();
            const p = json?.data || json;
            if (alive) {
              setProductName(p?.name || null);
              setStoreName(p?.seller?.storeName || p?.seller?.name || null);
            }
          }
        } else if (storeId) {
          const res = await fetch(`${API}/users/${storeId}`);
          if (res.ok) {
            const json = await res.json();
            const s = json?.data || json;
            if (alive) setStoreName(s?.storeName || s?.name || null);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [productId, storeId]);

  useEffect(() => {
    if (isReport) {
      setContextLabel(
        isProductContext ? "Reporting product" : isStoreContext ? "Reporting store" : "Report to Plazore"
      );
    } else if (isStoreContext || isProductContext) {
      setContextLabel("Contact Store through Plazore");
    } else {
      setContextLabel("Talk to Plazore");
    }
  }, [isReport, isStoreContext, isProductContext]);

  const reasons = isProductContext ? PRODUCT_REPORT_REASONS : STORE_REPORT_REASONS;

  const onMessageChange = (val: string) => {
    if (wordCount(val) <= 300) setMessage(val);
  };

  const submit = async () => {
    setError("");
    if (!isSignedIn) {
      router.push("/sign-in?redirect_url=/contact");
      return;
    }
    if (words < 1) {
      setError("Please write a short message.");
      return;
    }
    if (words > 300) {
      setError("Message must be 300 words or fewer.");
      return;
    }
    if (!email.includes("@")) {
      setError("A valid email is required.");
      return;
    }
    if (!country || !state || !city) {
      setError("Country, state and city are required.");
      return;
    }
    if (isReport && !reason) {
      setError("Please choose a category.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired. Please sign in again.");

      if (isReport) {
        const body = {
          targetType: isProductContext ? "product" : "store",
          productId: productId || undefined,
          storeId: storeId || undefined,
          reason,
          description: message.trim(),
          email: email.trim(),
          country: country.trim(),
          state: state.trim(),
          city: city.trim(),
          street: street.trim(),
        };
        const res = await fetch(`${API}/contact/report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to submit report");
      } else {
        const body = {
          contactAs,
          contextType: isProductContext
            ? "product"
            : isStoreContext
              ? "store"
              : contextType || "general",
          category,
          message: message.trim(),
          email: email.trim(),
          country: country.trim(),
          state: state.trim(),
          city: city.trim(),
          street: street.trim(),
          productId: productId || undefined,
          storeId: storeId || undefined,
          orderId: orderId || undefined,
        };
        const res = await fetch(`${API}/contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to send message");
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-dvh bg-[#090B0F] text-[#F5F7FA]">
        <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#00E575]/30 bg-[#00E575]/10">
            <CheckCircle2 className="h-8 w-8 text-[#00E575]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isReport ? "Report received" : "Message sent"}
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#A7ADB8]">
            {isReport
              ? "We've received your report and will review it carefully."
              : "Plazore has your message. We'll get back to you soon."}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/notifications"
              className="flex h-12 items-center justify-center bg-[#00E575] px-6 text-sm font-extrabold text-[#041412]"
            >
              View notifications
            </Link>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-12 items-center justify-center border border-white/10 bg-[#11141A] px-6 text-sm font-semibold"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#090B0F] text-[#F5F7FA]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#090B0F]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Image
              src="/logo.png"
              alt="Plazore"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold tracking-tight">
                {contextLabel}
              </p>
              <p className="truncate text-[11px] text-[#737A86]">
                {isReport
                  ? "Structured · calm · private"
                  : "Calm support · no sales pressure"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Context chips */}
        {(storeName || productName) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {storeName && (
              <span className="inline-flex items-center gap-1.5 border border-white/[0.08] bg-[#11141A] px-3 py-1.5 text-[12px] font-semibold text-[#A7ADB8]">
                <Store className="h-3.5 w-3.5" />
                {storeName}
              </span>
            )}
            {productName && (
              <span className="inline-flex items-center gap-1.5 border border-white/[0.08] bg-[#11141A] px-3 py-1.5 text-[12px] font-semibold text-[#A7ADB8]">
                <Package className="h-3.5 w-3.5" />
                {productName}
              </span>
            )}
          </div>
        )}

        {/* Intro */}
        <div className="mb-8">
          <div className="mb-3 flex h-11 w-11 items-center justify-center border border-white/[0.08] bg-[#11141A]">
            {isReport ? (
              <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
            ) : (
              <MessageCircle className="h-5 w-5 text-[#00E575]" />
            )}
          </div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            {isReport
              ? "Tell us what doesn’t feel right"
              : isStoreContext || isProductContext
                ? "Reach the store through Plazore"
                : "We’re here with you"}
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#A7ADB8]">
            {isReport
              ? "Your report stays private. It goes straight into our moderation workflow."
              : "No bots. No hard sell. Just a clear line to the Plazore team."}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Contact as */}
          {!isReport && canSeller && (
            <Field label="Contacting Plazore as">
              <div className="grid grid-cols-2 gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setContactAs(r)}
                    className={`h-11 border text-sm font-semibold capitalize transition ${
                      contactAs === r
                        ? "border-[#00E575]/50 bg-[#00E575]/10 text-[#00E575]"
                        : "border-white/[0.08] bg-[#11141A] text-[#A7ADB8]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Category / Reason */}
          <Field label={isReport ? "What’s the issue?" : "What can we help with?"}>
            <select
              value={isReport ? reason : category}
              onChange={(e) =>
                isReport ? setReason(e.target.value) : setCategory(e.target.value)
              }
              className="h-12 w-full appearance-none border border-white/[0.08] bg-[#11141A] px-4 text-[14px] outline-none focus:border-[#00E575]/40"
            >
              <option value="">Select…</option>
              {(isReport ? reasons : CONTACT_CATEGORIES).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Message */}
          <Field
            label={isReport ? "Explain the issue" : "Your message"}
            hint={`${words} / 300 words`}
          >
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={6}
              placeholder={
                isReport
                  ? "What happened? Be as clear as you can…"
                  : "Tell us what’s on your mind…"
              }
              className="w-full resize-none border border-white/[0.08] bg-[#11141A] px-4 py-3 text-[14px] leading-relaxed outline-none placeholder:text-[#5C6370] focus:border-[#00E575]/40"
            />
          </Field>

          {/* Email */}
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full border border-white/[0.08] bg-[#11141A] px-4 text-[14px] outline-none focus:border-[#00E575]/40"
            />
          </Field>

          {/* Location */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Country *">
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-12 w-full border border-white/[0.08] bg-[#11141A] px-4 text-[14px] outline-none focus:border-[#00E575]/40"
              />
            </Field>
            <Field label="State / Region *">
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-12 w-full border border-white/[0.08] bg-[#11141A] px-4 text-[14px] outline-none focus:border-[#00E575]/40"
              />
            </Field>
            <Field label="City *">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12 w-full border border-white/[0.08] bg-[#11141A] px-4 text-[14px] outline-none focus:border-[#00E575]/40"
              />
            </Field>
          </div>

          <Field label="Street address (optional)">
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="h-12 w-full border border-white/[0.08] bg-[#11141A] px-4 text-[14px] outline-none focus:border-[#00E575]/40"
            />
          </Field>

          {error && (
            <p className="border border-[#ef6262]/30 bg-[#ef6262]/10 px-4 py-3 text-[13px] text-[#ef6262]">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="flex h-13 w-full items-center justify-center bg-[#00E575] text-[15px] font-extrabold text-[#041412] transition hover:brightness-110 disabled:opacity-60"
          >
            {submitting
              ? "Sending…"
              : isReport
                ? "Submit report"
                : "Send to Plazore"}
          </button>

          <p className="text-center text-[12px] text-[#5C6370]">
            We never share your message with other users.
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[11px] font-extrabold tracking-[0.12em] text-[#6B7280]">
        <span>{label.toUpperCase()}</span>
        {hint && <span className="font-semibold tracking-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}