/**
 * client/services/pushNotifications.ts
 *
 * Uses default axios `api` from @/constants/api (there is NO apiPost export).
 * Pass getToken from Clerk useAuth() when registering.
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import api from "@/constants/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermissions(): Promise<{
  granted: boolean;
  status: string;
}> {
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
  let status = settings.status; // granted | denied | undetermined

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
 * Call AFTER user is signed in, e.g.:
 *
 *   const { getToken, isSignedIn } = useAuth();
 *   useEffect(() => {
 *     if (!isSignedIn) return;
 *     registerForPushNotifications(getToken);
 *   }, [isSignedIn, getToken]);
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

    // Save to backend (auth required)
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
  onReceive?: (n: Notifications.Notification) => void;
  onResponse?: (r: Notifications.NotificationResponse) => void;
}) {
  const subReceive = Notifications.addNotificationReceivedListener((n) => {
    opts?.onReceive?.(n);
  });
  const subResponse =
    Notifications.addNotificationResponseReceivedListener((r) => {
      opts?.onResponse?.(r);
    });

  return () => {
    subReceive.remove();
    subResponse.remove();
  };
}
