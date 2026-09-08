// client/constants/api.ts
import axios from "axios";
import { Platform } from "react-native";

const getBaseURL = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (__DEV__) {
    if (Platform.OS === "android") {
      // Emulator: return "http://10.0.2.2:3000/api";
      return "http://10.196.138.77:3000/api";
    }

    if (Platform.OS === "ios") {
      return "http://localhost:3000/api";
    }
  }

  return "http://10.196.138.77:3000/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

if (__DEV__) {
  console.log("API Base URL →", api.defaults.baseURL);
}

/** Public announcements (no auth required on server) */
export async function fetchPublicAnnouncements(params?: {
  limit?: number;
  audience?: "all" | "buyers" | "sellers";
}) {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.audience) q.set("audience", params.audience);
  const path = q.toString() ? `/announcements?${q}` : "/announcements";
  const res = await api.get(path);
  return res.data;
}

export default api;