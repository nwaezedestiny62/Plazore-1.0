/**
 * Single config for Plazore Android APK.
 * When ready: place file at public/downloads/plazore.apk and set AVAILABLE true.
 */

export const APP_DOWNLOAD_AVAILABLE = false;
export const APP_APK_PATH = "/downloads/plazore.apk";

export function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "http://localhost:3001";
}

export function getDownloadPageUrl(): string {
  return `${getAppBaseUrl()}/download`;
}

export function getApkDownloadUrl(): string | null {
  if (!APP_DOWNLOAD_AVAILABLE) return null;
  return `${getAppBaseUrl()}${APP_APK_PATH}`;
}