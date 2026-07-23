import axios from "axios";
import { Platform } from "react-native";
import { useAuth } from '@clerk/clerk-expo';

const LOCAL_API_URL = Platform.select({
  android: "http://192.168.100.82:3000/api",
  ios: "http://192.168.100.82:3000/api",
  default: "http://localhost:3000/api"
});

const api = axios.create({ baseURL: LOCAL_API_URL });

// ← This is the important part
api.interceptors.request.use(async (config) => {
  try {
    const { getToken } = useAuth();
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.log("Token fetch error:", err);
  }
  return config;
});

export default api;