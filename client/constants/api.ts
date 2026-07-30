// client/constants/api.ts
import axios from "axios";
import { Platform } from "react-native";

const getBaseURL = () => {
  // 1. Environment variable (highest priority)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Development
  if (__DEV__) {
    // Android Emulator → special IP that points to your computer
    if (Platform.OS === "android") {
      // Uncomment the line below if you are using Android Emulator
      // return "http://10.0.2.2:3000/api";

      // For physical Android phone (your current setup)
      return "http://192.168.43.108:3000/api";
    }

    // iOS Simulator
    if (Platform.OS === "ios") {
      return "http://localhost:3000/api";
    }
  }

  // 3. Fallback for physical devices
  return "http://192.168.43.108:3000/api";
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

export default api;