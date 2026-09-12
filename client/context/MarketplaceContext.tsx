import api from "@/constants/api";
import {
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
  getRegion,
  REGIONS,
  REGION_ALIASES,
  type ClientRateMap,
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
const RATES_CACHE_KEY = "plazore_currency_rates_v1";

function isValidRegion(code?: string | null): code is string {
  if (!code) return false;
  const resolved = REGION_ALIASES[code] || code;
  return Object.prototype.hasOwnProperty.call(REGIONS, resolved);
}

function normalizeRegion(code?: string | null): string {
  if (!code) return DEFAULT_REGION;
  const resolved = REGION_ALIASES[code] || code;
  return isValidRegion(resolved) ? resolved : DEFAULT_REGION;
}

type MarketplaceContextType = {
  region: string;
  currencySymbol: string;
  currencyCode: string;
  loading: boolean;
  ratesToNgn: ClientRateMap | null;
  ratesLoaded: boolean;
  refreshRegion: () => Promise<void>;
  refreshRates: () => Promise<void>;
  setRegionLocal: (code: string) => void;
  format: (amount: number) => string;
  /**
   * Display helper only. Uses active NGN rates when available.
   * If rates are missing, shows the product's canonical currency — never invents FX.
   * Never use for rewriting stored order/payment amounts.
   */
  formatProduct: (amount: number, productRegion?: string | null) => string;
};

const MarketplaceContext = createContext<MarketplaceContextType>({
  region: DEFAULT_REGION,
  currencySymbol: getRegion(DEFAULT_REGION).currency.symbol,
  currencyCode: getRegion(DEFAULT_REGION).currency.code,
  loading: true,
  ratesToNgn: null,
  ratesLoaded: false,
  refreshRegion: async () => {},
  refreshRates: async () => {},
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
  const [ratesToNgn, setRatesToNgn] = useState<ClientRateMap | null>(null);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  const localOverrideUntil = useRef(0);
  const bootstrapped = useRef(false);

  const applyRegion = useCallback(
    (code: string, opts?: { sticky?: boolean }) => {
      const next = normalizeRegion(code);
      setRegionState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      if (opts?.sticky) {
        localOverrideUntil.current = Date.now() + 8000;
      }
    },
    []
  );

  const setRegionLocal = useCallback(
    (code: string) => {
      applyRegion(code, { sticky: true });
    },
    [applyRegion]
  );

  const refreshRates = useCallback(async () => {
    try {
      const res = await api.get("/currency/config");
      const list = res.data?.data?.currencies || res.data?.currencies || [];
      const map: ClientRateMap = {};
      for (const c of list) {
        const code = String(c.code || "").toUpperCase();
        const rate = Number(c.rateToNgn);
        if (code && Number.isFinite(rate) && rate > 0) {
          map[code] = rate;
        }
      }
      if (Object.keys(map).length) {
        map.NGN = map.NGN ?? 1;
        setRatesToNgn(map);
        setRatesLoaded(true);
        AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(map)).catch(
          () => {}
        );
      }
    } catch {
      try {
        const cached = await AsyncStorage.getItem(RATES_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as ClientRateMap;
          if (parsed && typeof parsed === "object") {
            setRatesToNgn(parsed);
            setRatesLoaded(true);
          }
        }
      } catch {
        /* keep previous */
      }
    }
  }, []);

  const refreshRegion = useCallback(async () => {
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
        if (Date.now() >= localOverrideUntil.current) {
          applyRegion(serverRegion || DEFAULT_REGION);
        }
      }
    } catch {
      /* retain current region */
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn, applyRegion]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isValidRegion(cached)) {
          setRegionState(normalizeRegion(cached));
        }
        const ratesCached = await AsyncStorage.getItem(RATES_CACHE_KEY);
        if (!cancelled && ratesCached) {
          const parsed = JSON.parse(ratesCached) as ClientRateMap;
          if (parsed && typeof parsed === "object") {
            setRatesToNgn(parsed);
            setRatesLoaded(true);
          }
        }
      } catch {
        /* ignore */
      }

      if (!cancelled) {
        await Promise.all([refreshRegion(), refreshRates()]);
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

  // Quiet refresh of rates (does not touch region / showroom)
  useEffect(() => {
    const id = setInterval(() => {
      refreshRates();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshRates]);

  const regionConfig = useMemo(() => getRegion(region), [region]);

  const format = useCallback(
    (amount: number) => formatMoney(Number(amount) || 0, region),
    [region]
  );

  const formatProduct = useCallback(
    (amount: number, productRegion?: string | null) =>
      formatProductPrice(
        Number(amount) || 0,
        productRegion,
        region,
        ratesToNgn || undefined
      ),
    [region, ratesToNgn]
  );

  const value = useMemo<MarketplaceContextType>(
    () => ({
      region,
      currencySymbol: regionConfig.currency.symbol,
      currencyCode: regionConfig.currency.code,
      loading,
      ratesToNgn,
      ratesLoaded,
      refreshRegion,
      refreshRates,
      setRegionLocal,
      format,
      formatProduct,
    }),
    [
      region,
      regionConfig,
      loading,
      ratesToNgn,
      ratesLoaded,
      refreshRegion,
      refreshRates,
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