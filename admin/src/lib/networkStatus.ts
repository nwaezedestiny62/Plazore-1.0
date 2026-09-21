export type NetworkKind = "online" | "offline" | "slow";

/**
 * Browser Network Information API is a coarse *hint* only.
 * Never use it alone to pin a "slow" UI — values stick and mis-report often.
 */
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

  // Extremely conservative — UI must still confirm with a real probe.
  const hintSlow =
    online &&
    (effectiveType === "slow-2g" ||
      (typeof rtt === "number" && rtt >= 2000) ||
      (typeof downlink === "number" && downlink > 0 && downlink < 0.25));

  return { online, hintSlow, downlink, effectiveType };
}