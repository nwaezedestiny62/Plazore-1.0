/**
 * client/services/pushNotifications.ts
 * Register token + turn a notification tap into an in-app route.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import api from "@/constants/api";

type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");

let Notifications: NotificationsModule | null = null;
let Device: DeviceModule | null = null;
let loadAttempted = false;

function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

async function loadNativeModules(): Promise<boolean> {
  if (loadAttempted) return !!Notifications;
  loadAttempted = true;
  if (isExpoGo() && Platform.OS === "android") return false;
  try {
    Notifications = await import("expo-notifications");
    Device = await import("expo-device");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return true;
  } catch (e) {
    console.warn("[push] native modules unavailable", e);
    Notifications = null;
    return false;
  }
}

async function ensureChannels() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("plazore_critical", {
    name: "Plazore Critical",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#00E575",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync("plazore_default", {
    name: "Plazore",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: "#22D3EE",
    enableVibrate: true,
    showBadge: true,
  });
}

export async function registerForPushNotifications(
  getToken?: () => Promise<string | null>
): Promise<string | null> {
  try {
    const ok = await loadNativeModules();
    if (!ok || !Notifications || !Device?.isDevice) return null;

    await ensureChannels();

    let settings = await Notifications.getPermissionsAsync();
    if (settings.status !== "granted") {
      settings = await Notifications.requestPermissionsAsync();
    }
    if (settings.status !== "granted") {
      console.warn("[push] permission", settings.status);
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any).easConfig?.projectId;
    if (!projectId) return null;

    const tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId: String(projectId),
    });
    const token = tokenRes?.data;
    if (!token) return null;

    const authToken = getToken ? await getToken() : null;
    await api.post(
      "/users/push-token",
      { token, platform: Platform.OS },
      authToken
        ? { headers: { Authorization: `Bearer ${authToken}` } }
        : undefined
    );
    console.log("[push] registered: yes");
    return token;
  } catch (e) {
    console.warn("[push] register failed", e);
    return null;
  }
}

/** Where a tap should go. Prefers the link saved with the indoor notification. */
export function hrefFromPushData(data: Record<string, unknown> | undefined): string {
  const link = String(data?.link || "");
  if (link.startsWith("/") && !link.startsWith("//")) return link;

  const type = String(data?.type || "");
  const orderId = String(data?.orderId || "");
  const conversationId = String(data?.conversationId || "");

  if (type === "chat_message" && conversationId) return `/chat/${conversationId}`;
  if (type === "showroom_refresh") return "/showroom";
  if (
    (type === "ship_required" || type === "new_order") &&
    orderId
  ) {
    return `/seller/orders/${orderId}`;
  }
  if (orderId) return `/orders/${orderId}`;
  if (type === "announcement") return "/notifications";
  return "/notifications";
}

export function setupNotificationListeners(opts: {
  onTap: (href: string) => void;
}): () => void {
  let sub: { remove: () => void } | null = null;
  let cancelled = false;

  loadNativeModules().then(async (ok) => {
    if (!ok || !Notifications || cancelled) return;

    const open = (response: any) => {
      const data = response?.notification?.request?.content?.data || {};
      const href = hrefFromPushData(data);
      if (href) opts.onTap(href);
    };

    sub = Notifications.addNotificationResponseReceivedListener(open);

    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!cancelled && last) open(last);
    } catch {
      /* ignore */
    }
  });

  return () => {
    cancelled = true;
    sub?.remove();
  };
}