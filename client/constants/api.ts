// client/constants/api.ts
import axios from "axios";
import { Platform } from "react-native";

const getBaseURL = () => {
  const ip = "192.168.18.5"; 
  return Platform.select({
    android: `http://${ip}:3000/api`,
    ios: `http://${ip}:3000/api`,
    default: "http://localhost:3000/api"
  });
};

const api = axios.create({ 
  baseURL: getBaseURL(),
  timeout: 15000,
});

// Create a function to get authenticated axios instance
export const getAuthApi = () => {
  const { getToken } = require('@clerk/clerk-expo').useAuth(); // Avoid direct import issue

  const authApi = axios.create({ 
    baseURL: getBaseURL(),
    timeout: 15000,
  });

  authApi.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log("✅ Clerk Token Attached");
      }
    } catch (err) {
      console.log("Token error:", err);
    }
    return config;
  });

  return authApi;
};

export default api; // Default for public calls