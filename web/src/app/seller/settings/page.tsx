"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Globe2,
  Info,
  LayoutGrid,
  MessageCircle,
  Package,
  Palette,
  Receipt,
  Sparkles,
  Store,
  User,
} from "lucide-react";

type Row = {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
};

function SettingsRow({
  href,
  title,
  subtitle,
  icon: Icon,
  accent,
  last,
}: Row & { last?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3.5 py-3.5 transition hover:bg-white/[0.02] ${
        last ? "" : "border-b border-white/[0.07]"
      }`}
    >
      <span
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center border ${
          accent
            ? "border-[#00E575]/22 bg-[#00E575]/10"
            : "border-white/[0.07] bg-[#171B22]"
        }`}
      >
        <Icon
          className={`h-[18px] w-[18px] ${accent ? "text-[#00E575]" : "text-[#F5F7FA]"}`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[#F5F7FA]">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-[17px] text-[#A7ADB8]">
          {subtitle}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#737A86]" />
    </Link>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <p className="mb-2 ml-0.5 text-[11px] font-bold uppercase tracking-[1.3px] text-[#737A86]">
        {title}
      </p>
      <div className="overflow-hidden border border-white/[0.07] bg-[#11141A]">
        {children}
      </div>
    </section>
  );
}

export default function SellerSettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#090B0F]/95 px-2 py-3 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/seller");
              }
            }}
            className="flex h-[42px] w-[42px] items-center justify-center text-[#F5F7FA]"
            aria-label="Back"
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-[17px] font-extrabold tracking-tight">Settings</h1>
            <p className="mt-0.5 text-[11px] text-[#737A86]">Seller Lounge</p>
          </div>
          <div className="w-[42px]" />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-[18px] pb-12 sm:px-6">
        {/* Intro */}
        <div className="mb-[22px] flex items-center gap-3 border border-white/[0.07] bg-[#11141A] p-3.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,229,117,0.12), rgba(59,130,246,0.08))",
            }}
          >
            <LayoutGrid className="h-[18px] w-[18px] text-[#00E575]" />
          </div>
          <p className="text-[13px] leading-[19px] text-[#A7ADB8]">
            Manage your storefront, products, orders, and growth — one calm place
            for sellers.
          </p>
        </div>

        <Section title="Store">
          <SettingsRow
            href="/seller/store"
            icon={Palette}
            title="Storefront"
            subtitle="Logo, banner, name, and public store page"
            accent
          />
        </Section>

        <Section title="Growth">
          <SettingsRow
            href="/seller/subscription"
            icon={Sparkles}
            title="Seller plans"
            subtitle="Fees, image limits, and visibility tiers"
            accent
          />
        </Section>

        <Section title="Account">
          <SettingsRow
            href="/seller/settings/payout"
            icon={Store}
            title="Payout setup"
            subtitle="Bank details live with store settings for now"
          />
          <SettingsRow
  href="/seller/settings/profile"
  icon={User} // or CreditCard → prefer User
  title="Seller identity"
  subtitle="Name, phone, marketplace region"
/>
<SettingsRow
            href="/seller/settings/region"
            icon={Globe2}
            title="Marketplace region"
            subtitle="Currency and marketplace you sell in"
            last
          />
        </Section>

        <Section title="About">
          <SettingsRow
            href="/settings/about"
            icon={Info}
            title="About Plazore"
            subtitle="Version and application information"
            last
          />
        </Section>

        <p className="mt-2 text-center text-[11px] tracking-wide text-[#737A86]">
          Plazore · Seller Lounge
        </p>
      </div>
    </div>
  );
}