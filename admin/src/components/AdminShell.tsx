"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { PerformanceFloat } from "@/components/PerformanceFloat";

const NAV = [
  {
    section: "Operations",
    items: [{ href: "/overview", label: "Overview" }],
  },
  {
    section: "Marketplace",
    items: [
      { href: "/users", label: "Users & sellers" },
      { href: "/products", label: "Products" },
      { href: "/orders", label: "Orders" },
    ],
  },
  {
    section: "Commerce controls",
    items: [
      { href: "/currency", label: "Currency & exchange rates" },
    ],
  },
  {
    section: "Trust & safety",
    items: [
      { href: "/moderation", label: "Moderation" },
      { href: "/reports", label: "Reports" },
      { href: "/contact", label: "Contact inbox" },
    ],
  },
  {
    section: "Observability",
    items: [
      { href: "/performance", label: "Data & performance" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/showroom", label: "Showroom" },
      { href: "/intelligence", label: "Product intelligence" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    section: "Platform",
    items: [
      { href: "/content", label: "Content" },
      { href: "/announcements", label: "Announcements" },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#090B0F] text-[#F5F7FA]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[#252A33] bg-[#090B0F]/95 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#11141A] text-[#A7ADB8] transition hover:text-white md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plazore-logo.png"
            alt="Plazore"
            className="h-8 w-8 object-contain"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-wide text-[#F5F7FA]">
              Plazore Admin
            </p>
            <p className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-[#737A86] sm:block">
              Control centre
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside
          className={`${
            open ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-30 flex w-[15.5rem] flex-col border-r border-[#252A33] bg-[#11141A] pt-14 transition-transform duration-200 ease-out md:static md:translate-x-0 md:pt-0`}
        >
          <div className="border-b border-[#252A33] px-4 py-3 md:py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
              Navigation
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[#A7ADB8]">
              Authorised operational surfaces only.
            </p>
          </div>

          <nav className="flex h-[calc(100dvh-3.5rem-4.5rem)] flex-col gap-5 overflow-y-auto p-3 pb-6">
            {NAV.map((group) => (
              <div key={group.section}>
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
                  {group.section}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`block border px-3 py-2 text-[13px] transition ${
                          active
                            ? "border-[#00E575]/35 bg-[#00E575]/10 font-medium text-white"
                            : "border-transparent text-[#A7ADB8] hover:border-[#252A33] hover:bg-[#171B22] hover:text-white"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-[#252A33] px-4 py-3">
            <p className="text-[10px] leading-relaxed text-[#737A86]">
              Rate and region changes apply to future activity. Completed
              financial records are not recalculated.
            </p>
          </div>
        </aside>

        {open && (
          <button
            type="button"
            aria-label="Dismiss navigation overlay"
            className="fixed inset-0 z-20 bg-black/55 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        <main className="min-h-[calc(100dvh-3.5rem)] min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          {children}
          <PerformanceFloat />
        </main>
      </div>
    </div>
  );
}