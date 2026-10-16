import { setupNotificationListeners } from "@/services/pushNotifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

/** Mount once inside the root layout, under the router. */
export default function PushTapBridge() {
  const router = useRouter();

  useEffect(() => {
    return setupNotificationListeners({
      onTap: (href) => {
        try {
          router.push(href as never);
        } catch (e) {
          console.warn("[push] navigation failed", href, e);
        }
      },
    });
  }, [router]);

  return null;
}