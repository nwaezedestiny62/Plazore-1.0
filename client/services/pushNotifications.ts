/**
 * client/services/pushNotifications.ts
 * Do NOT set channel sound to "default" — Expo treats it as a missing custom file.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import api from "@/constants/api";

type NotificationsModule = typeof import("expo-notifications");
type DeviceModule = typeof import("expo-device");

let Notifications: NotificationsModule | null = null;
let Device: DeviceModule | null = null;
let loadAttempted = false;
let loadError: string | null = null;

function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

async function loadNativeModules(): Promise<boolean> {
  if (loadAttempted) return !!(Notifications && Device);
  loadAttempted = true;

  if (isExpoGo() && Platform.OS === "android") {
    loadError =
      "Push unavailable in Expo Go on Android (SDK 53+). Use a development build.";
    console.warn("[push]", loadError);
    return false;
  }

  try {
    Notifications = await import("expo-notifications");
    Device = await import("expo-device");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return true;
  } catch (e: any) {
    loadError = e?.message || String(e);
    console.warn("[push] native modules unavailable:", loadError);
    Notifications = null;
    Device = null;
    return false;
  }
}

export async function ensureNotificationPermissions(): Promise<{
  granted: boolean;
  status: string;
}> {
  const ok = await loadNativeModules();
  if (!ok || !Notifications || !Device) {
    return { granted: false, status: loadError || "unavailable" };
  }

  if (!Device.isDevice) {
    return { granted: false, status: "simulator" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("plazore_default", {
      name: "Plazore",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22D3EE",
    });
    await Notifications.setNotificationChannelAsync("plazore_critical", {
      name: "Plazore Critical",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: "#22C55E",
    });
  }

  let settings = await Notifications.getPermissionsAsync();
  let status = settings.status;

  if (status !== "granted") {
    const canAsk =
      settings.canAskAgain !== false || status === "undetermined";
    if (canAsk) {
      settings = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
          allowCriticalAlerts: false,
          provideAppNotificationSettings: true,
          allowProvisional: false,
        },
      });
      status = settings.status;
    }
  }

  return { granted: status === "granted", status };
}

export async function registerForPushNotifications(
  getToken?: () => Promise<string | null>
): Promise<string | null> {
  try {
    const { granted, status } = await ensureNotificationPermissions();
    if (!granted) {
      console.warn("[push] permission not granted:", status);
      return null;
    }

    if (!Notifications) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any).easConfig?.projectId ||
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

    if (!projectId) {
      console.warn("[push] missing EAS projectId");
      return null;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId: String(projectId),
    });
    const token = tokenRes?.data;
    if (!token) return null;

    console.log("[push] token prefix:", String(token).slice(0, 28));

    try {
      const authToken = getToken ? await getToken() : null;
      const headers = authToken
        ? { Authorization: `Bearer ${authToken}` }
        : undefined;

      const res = await api.post(
        "/users/push-token",
        { token, platform: Platform.OS },
        headers ? { headers } : undefined
      );
      console.log("[push] token saved to server:", res?.data?.success !== false);
    } catch (e) {
      console.warn("[push] save token failed", e);
    }

    return token;
  } catch (e) {
    console.warn("[push] register failed", e);
    return null;
  }
}

export function setupNotificationListeners(opts?: {
  onReceive?: (n: any) => void;
  onResponse?: (r: any) => void;
}): () => void {
  let subReceive: { remove: () => void } | null = null;
  let subResponse: { remove: () => void } | null = null;
  let cancelled = false;

  loadNativeModules().then((ok) => {
    if (!ok || !Notifications || cancelled) return;

    subReceive = Notifications.addNotificationReceivedListener((n) => {
      opts?.onReceive?.(n);
    });
    subResponse = Notifications.addNotificationResponseReceivedListener(
      (r) => {
        opts?.onResponse?.(r);
      }
    );
  });

  return () => {
    cancelled = true;
    subReceive?.remove();
    subResponse?.remove();
  };
}
