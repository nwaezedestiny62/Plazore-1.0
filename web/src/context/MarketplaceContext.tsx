"use client";

import { useAuth } from "@clerk/nextjs";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
  getRegion,
  REGIONS,
} from "@/lib/regions";

const STORAGE_KEY = "plazore_marketplace_region";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

function isValidRegion(code?: string | null): code is string {
  return !!code && Object.prototype.hasOwnProperty.call(REGIONS, code);
}

function normalizeRegion(code?: string | null): string {
  return isValidRegion(code) ? code : DEFAULT_REGION;
}

type MarketplaceContextType = {
  region: string;
  currencySymbol: string;
  currencyCode: string;
  loading: boolean;
  refreshRegion: () => Promise<void>;
  setRegionLocal: (code: string) => void;
  /** Local + server (when signed in) */
  setRegion: (code: string) => Promise<void>;
  format: (amount: number) => string;
  formatProduct: (amount: number, productRegion?: string | null) => string;
};

const MarketplaceContext = createContext<MarketplaceContextType>({
  region: DEFAULT_REGION,
  currencySymbol: getRegion(DEFAULT_REGION).currency.symbol,
  currencyCode: getRegion(DEFAULT_REGION).currency.code,
  loading: true,
  refreshRegion: async () => {},
  setRegionLocal: () => {},
  setRegion: async () => {},
  format: (a) => formatMoney(a, DEFAULT_REGION),
  formatProduct: (a, pr) => formatProductPrice(a, pr, DEFAULT_REGION),
});

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [region, setRegionState] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const localOverrideUntil = useRef(0);
  const bootstrapped = useRef(false);

  const applyRegion = useCallback((code: string, opts?: { sticky?: boolean }) => {
    const next = normalizeRegion(code);
    setRegionState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    if (opts?.sticky) localOverrideUntil.current = Date.now() + 8000;
  }, []);

  const setRegionLocal = useCallback(
    (code: string) => applyRegion(code, { sticky: true }),
    [applyRegion],
  );

  const setRegion = useCallback(
    async (code: string) => {
      const next = normalizeRegion(code);
      applyRegion(next, { sticky: true });
      if (!isSignedIn) return;
      try {
        const token = await getToken();
        if (!token) return;
        await fetch(`${API}/users/me`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ marketplaceRegion: next }),
        });
      } catch {
        /* keep local choice */
      }
    },
    [applyRegion, getToken, isSignedIn],
  );

  const refreshRegion = useCallback(async () => {
    if (Date.now() < localOverrideUntil.current) {
      setLoading(false);
      return;
    }

    if (!isSignedIn) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        setRegionState(normalizeRegion(cached));
      } catch {
        setRegionState(DEFAULT_REGION);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success && Date.now() >= localOverrideUntil.current) {
        applyRegion(json.data?.marketplaceRegion || DEFAULT_REGION);
      }
    } catch {
      /* keep current */
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, applyRegion]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (!cancelled && isValidRegion(cached)) setRegionState(cached);
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        await refreshRegion();
        bootstrapped.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!bootstrapped.current || !isLoaded) return;
    refreshRegion();
  }, [isSignedIn, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const regionConfig = useMemo(() => getRegion(region), [region]);

  const format = useCallback(
    (amount: number) => formatMoney(Number(amount) || 0, region),
    [region],
  );

  const formatProduct = useCallback(
    (amount: number, productRegion?: string | null) =>
      formatProductPrice(Number(amount) || 0, productRegion, region),
    [region],
  );

  const value = useMemo<MarketplaceContextType>(
    () => ({
      region,
      currencySymbol: regionConfig.currency.symbol,
      currencyCode: regionConfig.currency.code,
      loading,
      refreshRegion,
      setRegionLocal,
      setRegion,
      format,
      formatProduct,
    }),
    [
      region,
      regionConfig,
      loading,
      refreshRegion,
      setRegionLocal,
      setRegion,
      format,
      formatProduct,
    ],
  );

  return (
    <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  return useContext(MarketplaceContext);
}