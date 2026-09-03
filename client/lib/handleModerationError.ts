// client/lib/handleModerationError.ts
import { router } from "expo-router";

export function handleModerationError(err: any) {
  const data = err?.response?.data;
  if (data?.code === "SELLER_MODERATION" || data?.code === "BUYER_MODERATION") {
    const m = data.moderation || {};
    router.replace({
      pathname: "/moderation-status",
      params: {
        context: m.context || (data.code === "SELLER_MODERATION" ? "seller" : "buyer"),
        status: m.status || "",
        publicReason: m.publicReason || "",
        endsAt: m.endsAt ? String(m.endsAt) : "",
      },
    } as any);
    return true;
  }
  return false;
}