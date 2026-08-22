"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFeaturePrompt, type AppOnlyFeature } from "@/components/app/AppFeaturePrompt";
import { bagCount, subscribeBag } from "@/lib/cart";

const LINKS = [
  { href: "/", label: "Mall", id: "mall" },
  { href: "/browse", label: "Browse", id: "browse" },
  { href: "/lounge", label: "Lounge", id: "lounge" },
  { href: "__wishlist__", label: "Wishlist", id: "wishlist" },
  { href: "/cart", label: "Bag", id: "cart" },
];

export function PlazoreNav({ active }: { active?: string }) {
  const [feature, setFeature] = useState<AppOnlyFeature | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(bagCount());
    return subscribeBag(() => setCount(bagCount()));
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-bg/80 px-6 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Plazore" className="h-7 w-7 object-contain" />
          <span className="text-sm tracking-[0.2em] uppercase">Plazore</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((item) =>
            item.id === "wishlist" ? (
              <button
                key={item.id}
                onClick={() => setFeature("wishlist")}
                className="text-xs tracking-[0.18em] uppercase text-secondary hover:text-text"
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                className={`text-xs tracking-[0.18em] uppercase ${
                  active === item.id ? "text-text" : "text-secondary hover:text-text"
                }`}
              >
                {item.label}
                {item.id === "cart" && count > 0 ? ` (${count})` : ""}
              </Link>
            )
          )}
        </nav>
      </header>
      <AppFeaturePrompt feature={feature} onClose={() => setFeature(null)} />
    </>
  );
}