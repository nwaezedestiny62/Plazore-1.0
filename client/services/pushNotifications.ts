/**
 * client/services/pushNotifications.ts
 * Channel id MUST be new. Android will not upgrade an old channel.
 * Server must send channelId: "plazore_popup".
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import api from "@/constants/api";

export const POPUP_CHANNEL = "plazore_popup";

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
        shouldShowAlert: true,
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

async function ensurePopupChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(POPUP_CHANNEL, {
    name: "Plazore alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#22C55E",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
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

    await ensurePopupChannel();

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