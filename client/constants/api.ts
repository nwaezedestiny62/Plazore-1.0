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
  timeout: 15000 
});

export default api;