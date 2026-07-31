import api from "@/constants/api";
import {
  DEFAULT_REGION,
  formatMoney,
  formatProductPrice,
  getRegion,
} from "@/constants/regions";
import { useAuth } from "@clerk/clerk-expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type MarketplaceContextType = {
  region: string;
  currencySymbol: string;
  loading: boolean;
  refreshRegion: () => Promise<void>;
  format: (amount: number) => string;
  formatProduct: (amount: number, productRegion?: string | null) => string;
};

const MarketplaceContext = createContext<MarketplaceContextType>({
  region: DEFAULT_REGION,
  currencySymbol: "₦",
  loading: true,
  refreshRegion: async () => {},
  format: (a) => formatMoney(a, DEFAULT_REGION),
  formatProduct: (a, pr) => formatProductPrice(a, pr, DEFAULT_REGION),
});

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);

  const refreshRegion = useCallback(async () => {
    if (!isSignedIn) {
      setRegion(DEFAULT_REGION);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const res = await api.get("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setRegion(res.data.data.marketplaceRegion || DEFAULT_REGION);
      }
    } catch {
      setRegion(DEFAULT_REGION);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    refreshRegion();
  }, [refreshRegion]);

  const value: MarketplaceContextType = {
    region,
    currencySymbol: getRegion(region).currency.symbol,
    loading,
    refreshRegion,
    format: (amount) => formatMoney(amount, region),
    formatProduct: (amount, productRegion) =>
      formatProductPrice(amount, productRegion, region),
  };

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  return useContext(MarketplaceContext);
}