import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  fetchMyModeration,
  isContextBlocked,
  MyModeration,
  ModContext,
  ModSide,
} from "@/services/moderationApi";

export function useModeration() {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<MyModeration | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setData(null);
      setLoading(false);
      return null;
    }
    try {
      const token = await getToken();
      if (!token) {
        setData(null);
        setLoading(false);
        return null;
      }
      const m = await fetchMyModeration(token);
      setData(m);
      return m;
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === "active") refresh();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [refresh]);

  const buyer = data?.buyer as ModSide | undefined;
  const seller = data?.seller as ModSide | undefined;

  return {
    loading,
    data,
    buyer,
    seller,
    buyerBlocked: isContextBlocked(buyer?.status),
    sellerBlocked: isContextBlocked(seller?.status),
    refresh,
    getSide: (ctx: ModContext) => (ctx === "seller" ? seller : buyer),
  };
}