export type NetworkKind = "online" | "offline" | "slow";

export function getConnectionInfo(): {
  online: boolean;
  hintSlow: boolean;
  downlink?: number;
  effectiveType?: string;
} {
  if (typeof navigator === "undefined") {
    return { online: true, hintSlow: false };
  }

  const online = navigator.onLine !== false;
  const conn = (
    navigator as Navigator & {
      connection?: {
        downlink?: number;
        effectiveType?: string;
        rtt?: number;
      };
    }
  ).connection;

  const effectiveType = conn?.effectiveType;
  const downlink = conn?.downlink;
  const rtt = conn?.rtt;

  // Hint only — never enough on its own to pin the banner forever.
  // saveData is a user preference, NOT a slow network.
  const hintSlow =
    online &&
    (effectiveType === "slow-2g" ||
      effectiveType === "2g" ||
      (typeof rtt === "number" && rtt >= 750) ||
      (typeof downlink === "number" && downlink > 0 && downlink < 0.4));

  return { online, hintSlow, downlink, effectiveType };
}