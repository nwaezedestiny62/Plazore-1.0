export type NetworkKind = "online" | "offline" | "slow";

export function getConnectionInfo(): {
  online: boolean;
  slow: boolean;
  downlink?: number;
  effectiveType?: string;
} {
  if (typeof navigator === "undefined") {
    return { online: true, slow: false };
  }
  const online = navigator.onLine;
  const conn =
    (navigator as Navigator & {
      connection?: {
        downlink?: number;
        effectiveType?: string;
        saveData?: boolean;
      };
    }).connection;

  const effectiveType = conn?.effectiveType;
  const downlink = conn?.downlink;
  const slow =
    online &&
    (!!conn?.saveData ||
      effectiveType === "slow-2g" ||
      effectiveType === "2g" ||
      (typeof downlink === "number" && downlink > 0 && downlink < 0.5));

  return { online, slow, downlink, effectiveType };
}