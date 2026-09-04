"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe,
  Info,
  MapPin,
  MessageCircle,
  Music,
  Package,
  User,
} from "lucide-react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { getRegion } from "@/lib/regions";

const ACCOUNT_LINKS = [
  {
    href: "/profile/edit",
    title: "Profile",
    subtitle: "Name, photo, account details",
    icon: User,
  },
  {
    href: "/settings/region",
    title: "Marketplace region",
    subtitle: "Currency & catalog for your market",
    icon: Globe,
  },
  {
    href: "/addresses",
    title: "Addresses",
    subtitle: "Delivery locations for orders",
    icon: MapPin,
  },
  {
    href: "/payment-methods",
    title: "Payment methods",
    subtitle: "Saved cards for checkout",
    icon: CreditCard,
  },
  {
    href: "/orders",
    title: "Orders",
    subtitle: "Purchases & delivery",
    icon: Package,
  },
] as const;

const PREFERENCE_LINKS = [
  {
    href: "/settings/music",
    title: "Ambient soundtrack",
    subtitle: "Immerse yourself in the Plazore atmosphere",
    icon: Music,
  },
] as const;

const PLAZORE_LINKS = [
  {
    href: "/contact",
    title: "Contact Plazore",
    subtitle: "Support, feedback, and help",
    icon: MessageCircle,
  },
  {
    href: "/about",
    title: "About Plazore",
    subtitle: "What Plazore is",
    icon: Info,
  },
] as const;

function LinkList({
  items,
}: {
  items: readonly {
    href: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}) {
  return (
    <ul className="overflow-hidden border border-white/[0.08] bg-[#11141A]">
      {items.map((item, i) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.02] ${
              i > 0 ? "border-t border-white/[0.07]" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/[0.08] bg-[#171B22]">
              <item.icon className="h-4 w-4 text-[#A7ADB8]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{item.title}</span>
              <span className="mt-0.5 block text-[12px] text-[#737A86]">
                {item.subtitle}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#737A86]" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
        {/* Active marketplace card */}
        <Link
          href="/settings/region"
          className="mb-6 flex items-center gap-3 border border-white/[0.08] bg-[#11141A] p-4 transition hover:border-white/[0.12]"
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

        {/* Account */}
        <p className="mb-3 text-[11px] font-extrabold tracking-[0.14em] text-[#6B7280]">
          ACCOUNT
        </p>
        <LinkList items={ACCOUNT_LINKS} />

        {/* Preferences */}
        <p className="mb-3 mt-8 text-[11px] font-extrabold tracking-[0.14em] text-[#6B7280]">
          PREFERENCES
        </p>
        <LinkList items={PREFERENCE_LINKS} />

        {/* Plazore */}
        <p className="mb-3 mt-8 text-[11px] font-extrabold tracking-[0.14em] text-[#6B7280]">
          PLAZORE
        </p>
        <LinkList items={PLAZORE_LINKS} />

        <p className="mt-10 text-center text-[11px] tracking-[0.06em] text-[#6B7280]">
          Plazore · Premium Digital Mall
        </p>
      </main>
    </div>
  );
}