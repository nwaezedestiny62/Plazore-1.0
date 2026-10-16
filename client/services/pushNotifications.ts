/**
 * client/services/pushNotifications.ts
 *
 * Expo Go (Android, SDK 53+) does NOT support remote push.
 * Top-level `import * as Notifications` crashes with:
 *   Cannot find native module 'ExpoTopicSubscriptionModule'
 *
 * This file loads expo-notifications only when available and never
 * throws at import time so the rest of the app still boots.
 *
 * Real device popups require a development build:
 *   npx expo install expo-dev-client
 *   npx eas build --profile development --platform android
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
  // appOwnership === 'expo' means Expo Go
  return Constants.appOwnership === "expo";
}

async function loadNativeModules(): Promise<boolean> {
  if (loadAttempted) return !!(Notifications && Device);
  loadAttempted = true;

  // Remote push is unavailable in Expo Go on Android SDK 53+
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
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("plazore_critical", {
      name: "Plazore Critical",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: "#22C55E",
      sound: "default",
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

/**
 * Register for Expo push + save token to server.
 * Safe to call in Expo Go — returns null without crashing.
 */
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
      console.warn(
        "[push] missing EAS projectId — set extra.eas.projectId in app.json"
      );
      return null;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId: String(projectId),
    });
    const token = tokenRes?.data;
    if (!token) return null;

    try {
      const authToken = getToken ? await getToken() : null;
      const headers = authToken
        ? { Authorization: `Bearer ${authToken}` }
        : undefined;

      await api.post(
        "/users/push-token",
        { token, platform: Platform.OS },
        headers ? { headers } : undefined
      );
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
  // Sync API for callers; loads modules in background
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
