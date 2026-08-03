import api from "@/constants/api";
import {
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
  getRegion,
  REGIONS,
} from "@/constants/regions";
import { useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "plazore_marketplace_region";

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
  format: (a) => formatMoney(a, DEFAULT_REGION),
  formatProduct: (a, pr) => formatProductPrice(a, pr, DEFAULT_REGION),
});

export function MarketplaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [region, setRegionState] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);

  // Blocks a late / stale GET from overwriting a fresh local choice
  const localOverrideUntil = useRef(0);
  const bootstrapped = useRef(false);

  const applyRegion = useCallback((code: string, opts?: { sticky?: boolean }) => {
    const next = normalizeRegion(code);
    setRegionState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    if (opts?.sticky) {
      // Ignore server refresh for 8s so UI doesn't snap back
      localOverrideUntil.current = Date.now() + 8000;
    }
  }, []);

  const setRegionLocal = useCallback(
    (code: string) => {
      applyRegion(code, { sticky: true });
    },
    [applyRegion]
  );

  const refreshRegion = useCallback(async () => {
    // Respect recent local choice
    if (Date.now() < localOverrideUntil.current) {
      setLoading(false);
      return;
    }

    if (!isSignedIn) {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
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

      const res = await api.get("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        const serverRegion = res.data.data?.marketplaceRegion;
        // Only apply if still outside sticky window
        if (Date.now() >= localOverrideUntil.current) {
          applyRegion(serverRegion || DEFAULT_REGION);
        }
      }
    } catch {
      // Keep current region on network errors
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, applyRegion]);

  // Boot: disk first, then server
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isValidRegion(cached)) {
          setRegionState(cached);
        }
      } catch {}

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
    [region]
  );

  const formatProduct = useCallback(
    (amount: number, productRegion?: string | null) =>
      formatProductPrice(Number(amount) || 0, productRegion, region),
    [region]
  );

  const value = useMemo<MarketplaceContextType>(
    () => ({
      region,
      currencySymbol: regionConfig.currency.symbol,
      currencyCode: regionConfig.currency.code,
      loading,
      refreshRegion,
      setRegionLocal,
      format,
      formatProduct,
    }),
    [
      region,
      regionConfig,
      loading,
      refreshRegion,
      setRegionLocal,
      format,
      formatProduct,
    ]
  );

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  return useContext(MarketplaceContext);
}