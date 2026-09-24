"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./SiteFooter";

const FOOTER_MATCH = [
  /^\/$/, // home / showroom
  /^\/browse/,
  /^\/product\//,
  /^\/store\//, // storefront if you use /store/[id]
  /^\/profile/,
  /^\/lounge/,
  /^\/about/,
  /^\/help/,
  /^\/download/,
];

function showFooter(pathname: string | null) {
  if (!pathname) return false;
  return FOOTER_MATCH.some((re) => re.test(pathname));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const footer = showFooter(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      {footer ? <SiteFooter /> : null}
    </div>
  );
}