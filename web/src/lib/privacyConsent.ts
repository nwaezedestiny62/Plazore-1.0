/** Plazore privacy / non-essential technology consent */

export const CONSENT_VERSION = "1";
export const CONSENT_STORAGE_KEY = "plazore_privacy_consent_v1";

/**
 * Flip these only when real optional tech is installed in the web app.
 * Currently: none detected in package.json / layout.
 */
export const HAS_OPTIONAL_ANALYTICS = false;
export const HAS_OPTIONAL_MARKETING = false;

export type ConsentDecision = "accepted" | "essential_only" | "custom";

export type PrivacyConsentState = {
  consentVersion: string;
  decision: ConsentDecision;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

export function defaultConsentState(
  partial?: Partial<PrivacyConsentState>,
): PrivacyConsentState {
  return {
    consentVersion: CONSENT_VERSION,
    decision: "essential_only",
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

export function readConsent(): PrivacyConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrivacyConsentState;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.consentVersion !== CONSENT_VERSION) return null;
    return {
      ...defaultConsentState(),
      ...parsed,
      essential: true,
      analytics: HAS_OPTIONAL_ANALYTICS ? !!parsed.analytics : false,
      marketing: HAS_OPTIONAL_MARKETING ? !!parsed.marketing : false,
    };
  } catch {
    return null;
  }
}

export function writeConsent(state: PrivacyConsentState): void {
  if (typeof window === "undefined") return;
  const next = {
    ...state,
    essential: true as const,
    analytics: HAS_OPTIONAL_ANALYTICS ? !!state.analytics : false,
    marketing: HAS_OPTIONAL_MARKETING ? !!state.marketing : false,
    consentVersion: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent("plazore:privacy-consent", { detail: next }),
  );
}

export function acceptAll(): PrivacyConsentState {
  const state = defaultConsentState({
    decision: "accepted",
    analytics: HAS_OPTIONAL_ANALYTICS,
    marketing: HAS_OPTIONAL_MARKETING,
  });
  writeConsent(state);
  return state;
}

export function essentialOnly(): PrivacyConsentState {
  const state = defaultConsentState({
    decision: "essential_only",
    analytics: false,
    marketing: false,
  });
  writeConsent(state);
  return state;
}

export function saveCustom(prefs: {
  analytics: boolean;
  marketing: boolean;
}): PrivacyConsentState {
  const analytics = HAS_OPTIONAL_ANALYTICS ? !!prefs.analytics : false;
  const marketing = HAS_OPTIONAL_MARKETING ? !!prefs.marketing : false;
  const allOn =
    (!HAS_OPTIONAL_ANALYTICS || analytics) &&
    (!HAS_OPTIONAL_MARKETING || marketing);
  const allOff = !analytics && !marketing;
  const state = defaultConsentState({
    decision: allOn ? "accepted" : allOff ? "essential_only" : "custom",
    analytics,
    marketing,
  });
  writeConsent(state);
  return state;
}

/** Call before initializing any optional SDK */
export function canUseAnalytics(): boolean {
  if (!HAS_OPTIONAL_ANALYTICS) return false;
  return !!readConsent()?.analytics;
}

export function canUseMarketing(): boolean {
  if (!HAS_OPTIONAL_MARKETING) return false;
  return !!readConsent()?.marketing;
}