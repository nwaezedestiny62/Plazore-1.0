"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe,
  MapPin,
  Music,
  Package,
  User,
} from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { getRegion } from "@/lib/regions";

const LINKS = [
  {
    href: "/profile/edit",
    title: "Profile",
    subtitle: "Name, photo, account",
    icon: User,
  },
  {
    href: "/settings/region",
    title: "Marketplace region",
    subtitle: "Currency & catalog",
    icon: Globe,
  },
  
  {
    href: "/addresses",
    title: "Addresses",
    subtitle: "Shipping locations",
    icon: MapPin,
  },
  {
    href: "/payment-methods",
    title: "Payment methods",
    subtitle: "Saved cards",
    icon: CreditCard,
  },
  {
    href: "/orders",
    title: "Orders",
    subtitle: "Purchases & delivery",
    icon: Package,
  },
  {
    href: "/settings/music",
    title: "Music",
    subtitle: "Ambient soundtrack",
    icon: Music,
  },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { region, currencyCode, loading } = useMarketplace();
  const r = getRegion(region);

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-2.5 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Settings</h1>
          <p className="text-[11px] text-[#6B7280]">Account & marketplace</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
        <Link
          href="/settings/region"
          className="mb-6 flex items-center gap-3 border border-white/[0.08] bg-[#11141A] p-4"
        >
          <span className="text-2xl leading-none">{r.flag}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold tracking-[0.12em] text-[#6B7280]">
              ACTIVE MARKETPLACE
            </span>
            <span className="mt-1 block text-[15px] font-bold">
              {loading ? "…" : r.name}
            </span>
            <span className="mt-0.5 block text-[12px] text-[#A7ADB8]">
              {currencyCode} · {r.currency.symbol}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#737A86]" />
        </Link>

        <p className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-[#6B7280]">
          PREFERENCES
        </p>
        <ul className="overflow-hidden border border-white/[0.08] bg-[#11141A]">
          {LINKS.map((item, i) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  i > 0 ? "border-t border-white/[0.07]" : ""
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.08] bg-[#171B22]">
                  <item.icon className="h-4 w-4 text-[#A7ADB8]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-[12px] text-[#737A86]">{item.subtitle}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#737A86]" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}