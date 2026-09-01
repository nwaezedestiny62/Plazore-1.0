"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV = [
  { section: "Core", items: [{ href: "/overview", label: "Overview" }] },
  {
    section: "Marketplace",
    items: [
      { href: "/users", label: "Users & Sellers" },
      { href: "/products", label: "Products" },
      { href: "/orders", label: "Orders" },
    ],
  },
  {
    section: "Support",
    items: [
      { href: "/contact", label: "Contact Inbox" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/showroom", label: "Showroom" },
      { href: "/intelligence", label: "Product Intelligence" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    section: "Platform",
    items: [
      { href: "/content", label: "Content" },
      { href: "/experience", label: "Music" },
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
            className="flex h-9 w-9 items-center justify-center border border-[#252A33] bg-[#11141A] md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          {/* Put logo in admin/public/plazore-logo.png */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/plazore-logo.png" alt="Plazore" className="h-8 w-8 object-contain" />
          <div>
            <p className="text-[13px] font-semibold tracking-wide">Plazore Admin</p>
            <p className="hidden text-[10px] uppercase tracking-[0.16em] text-[#737A86] sm:block">
              Operational control
            </p>
          </div>
        </div>
        <UserButton afterSignOutUrl="/sign-in" />
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside
          className={`${
            open ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-30 w-56 border-r border-[#252A33] bg-[#11141A] pt-14 transition-transform md:static md:translate-x-0 md:pt-0`}
        >
          <nav className="flex h-[calc(100dvh-3.5rem)] flex-col gap-5 overflow-y-auto p-3">
            {NAV.map((group) => (
              <div key={group.section}>
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#737A86]">
                  {group.section}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`block border px-3 py-2 text-[13px] transition ${
                          active
                            ? "border-[#00E575]/30 bg-[#00E575]/10 text-white"
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
        </aside>
        {open && (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
        <main className="min-h-[calc(100dvh-3.5rem)] min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}