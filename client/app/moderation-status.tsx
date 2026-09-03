import { useAuth } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  clearLastOutcome,
  fetchMyModeration,
  ModContext,
  ModSide,
  resolveScreenKind,
} from "@/services/moderationApi";

const BG = "#090B0F";
const TEXT = "#F5F7FA";
const MUTED = "#A7ADB8";
const GREEN = "#00E575";
const LINE = "rgba(255,255,255,0.08)";

const ART = {
  review: require("@/assets/moderation/moderation-review.png"),
  pardoned: require("@/assets/moderation/moderation-pardoned.png"),
  suspended: require("@/assets/moderation/moderation-suspended.png"),
  blocked: require("@/assets/moderation/moderation-blocked.png"),
  restored: require("@/assets/moderation/moderation-restored.png"),
} as const;

function titleFor(
  kind: string,
  context: ModContext
): { title: string; body: string; cta: string } {
  const seller = context === "seller";
  switch (kind) {
    case "review":
      return {
        title: seller ? "Seller World under review" : "Account under review",
        body: "We're reviewing activity on this side of Plazore. Access is paused until the check is complete.",
        cta: "Understood",
      };
    case "suspended":
      return {
        title: seller
          ? "Seller World is suspended"
          : "Plazore access is suspended",
        body: seller
          ? "You can't manage products, orders, or store settings right now. Buyer shopping may still work."
          : "Marketplace access is temporarily limited. You can come back when the restriction ends or is lifted.",
        cta: "Got it",
      };
    case "blocked":
      return {
        title: seller
          ? "Seller World is blocked"
          : "Plazore account is blocked",
        body: seller
          ? "Seller tools are locked. This does not automatically block you as a buyer."
          : "Access to this side of Plazore is blocked until further notice.",
        cta: "Close",
      };
    case "pardoned":
      return {
        title: "You're clear",
        body: "Review is complete. No further action is required on your account.",
        cta: "Proceed",
      };
    case "restored":
      return {
        title: "Access restored",
        body: seller
          ? "Seller World is available again. You can continue managing your store."
          : "Your Plazore access is available again.",
        cta: "Proceed",
      };
    default:
      return {
        title: "All clear",
        body: "No moderation restriction on this side.",
        cta: "Continue",
      };
  }
}

function formatEnds(endsAt?: string | null) {
  if (!endsAt) return null;
  try {
    const d = new Date(endsAt);
    if (d.getTime() <= Date.now()) return "Ending soon / expired";
    return `Until ${d.toLocaleString()}`;
  } catch {
    return null;
  }
}

export default function ModerationStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{
    context?: string;
    status?: string;
    publicReason?: string;
    endsAt?: string;
  }>();

  const context: ModContext =
    params.context === "seller" ? "seller" : "buyer";

  // Seed from route params so UI paints immediately — no spinner flash
  const seedSide: ModSide | null = params.status
    ? {
        status: String(params.status),
        publicReason: params.publicReason
          ? String(params.publicReason)
          : "",
        endsAt: params.endsAt ? String(params.endsAt) : null,
      }
    : null;

  const [side, setSide] = useState<ModSide | null>(seedSide);
  // Only show spinner if we arrived with NO params at all
  const [booting, setBooting] = useState(!seedSide);
  const [busy, setBusy] = useState(false);
  const fetchedOnce = useRef(false);
  const navigating = useRef(false);

  // Fetch once on mount — never re-run when getToken identity changes
  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;

    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) {
          if (!cancelled) setBooting(false);
          return;
        }
        const m = await fetchMyModeration(token);
        if (cancelled) return;
        if (m?.[context]) {
          setSide(m[context]);
        }
      } catch {
        // keep seed from params
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kind = useMemo(() => {
    if (side) return resolveScreenKind(side, context);
    return "clear";
  }, [side, context]);

  const copy = titleFor(kind, context);
  const publicReason = side?.publicReason || "";
  const endsLabel = formatEnds(side?.endsAt);

  const leaveLocked = () => {
    if (navigating.current) return;
    navigating.current = true;
    router.replace("/(tabs)" as any);
  };

  const onProceed = async () => {
    if (busy || navigating.current) return;
    setBusy(true);
    try {
      const token = await getToken();

      // Clear outcome BEFORE navigating back into seller — prevents redirect loop
      if (token && (kind === "pardoned" || kind === "restored")) {
        await clearLastOutcome(token, context);
      }

      navigating.current = true;

      if (kind === "review" || kind === "suspended" || kind === "blocked") {
        router.replace("/(tabs)" as any);
        return;
      }

      if (context === "seller") {
        router.replace("/seller" as any);
      } else {
        router.replace("/(tabs)" as any);
      }
    } catch {
      navigating.current = false;
    } finally {
      setBusy(false);
    }
  };

  const art =
    kind === "review"
      ? ART.review
      : kind === "suspended"
        ? ART.suspended
        : kind === "blocked"
          ? ART.blocked
          : kind === "pardoned"
            ? ART.pardoned
            : kind === "restored"
              ? ART.restored
              : ART.pardoned;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>
          {context === "seller" ? "SELLER WORLD" : "PLAZORE"}
        </Text>
        <Text style={styles.modLabel}>Moderation</Text>
      </View>

      {booting ? (
        <View style={styles.center}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      ) : (
        <View style={styles.body}>
          <Image source={art} style={styles.art} resizeMode="contain" />

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.bodyText}>{copy.body}</Text>

          {!!publicReason && (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Message</Text>
              <Text style={styles.reasonText}>{publicReason}</Text>
            </View>
          )}

          {endsLabel && (kind === "suspended" || kind === "blocked") && (
            <Text style={styles.ends}>{endsLabel}</Text>
          )}

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onProceed}
            disabled={busy}
            style={styles.cta}
          >
            {busy ? (
              <ActivityIndicator color="#041412" />
            ) : (
              <Text style={styles.ctaText}>{copy.cta}</Text>
            )}
          </TouchableOpacity>

          {(kind === "review" ||
            kind === "suspended" ||
            kind === "blocked") &&
            context === "seller" && (
              <TouchableOpacity
                onPress={leaveLocked}
                style={styles.secondary}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryText}>Continue as buyer</Text>
              </TouchableOpacity>
            )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 8,
  },
  kicker: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  modLabel: {
    marginTop: 4,
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  art: {
    width: 220,
    height: 220,
    marginBottom: 28,
  },
  title: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  bodyText: {
    marginTop: 12,
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  reasonBox: {
    marginTop: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#11141A",
    padding: 14,
  },
  reasonLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  reasonText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  ends: {
    marginTop: 12,
    color: MUTED,
    fontSize: 13,
  },
  cta: {
    marginTop: 28,
    width: "100%",
    height: 52,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#041412",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  secondary: {
    marginTop: 14,
    paddingVertical: 12,
  },
  secondaryText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
  },
});