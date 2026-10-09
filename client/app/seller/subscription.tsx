/**
 * Seller plans — mobile
 * Business location currency (not browse region).
 * Paystack hosted URL via WebBrowser — no native Payment Sheet.
 */

import api from "@/constants/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#090B0F";
const SURFACE = "#0E1116";
const SURFACE_2 = "#14181F";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#F5F7FA";
const SECONDARY = "rgba(255,255,255,0.55)";
const MUTED = "rgba(255,255,255,0.38)";
const GREEN = "#00E575";
const AMBER = "#F59E0B";
const GRAD = [GREEN, "#14B8A6", "#2563EB"] as const;

type PlanId = "free" | "dominant" | "business_plus" | "global_reach";

type PlanRow = {
  id: PlanId;
  name: string;
  benefits: {
    maxImagesPerProduct: number;
    showroomVisibility: string;
    transactionFeeRate: number;
    bannerEligible?: boolean;
    priorityDiscovery?: boolean;
  };
  price: { amount: number; currency: string };
};

type PlansData = {
  country: string;
  currency: string;
  active: {
    planId: PlanId;
    status: string;
    isPromotional?: boolean;
    promoExpiresAt?: string | null;
    transactionFeeRate: number;
    maxImagesPerProduct: number;
  };
  plans: PlanRow[];
  promo: {
    eligible: boolean;
    claimed: boolean;
    durationMonths: number;
  };
};

function feePct(rate?: number) {
  if (rate == null) return "—";
  const p = rate * 100;
  return `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)}%`;
}

function money(amount: number, currency: string) {
  if (!(amount > 0)) return "Free";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

const ORDER: PlanId[] = [
  "free",
  "dominant",
  "business_plus",
  "global_reach",
];

export default function SellerSubscriptionScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [data, setData] = useState<PlansData | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await api.get("/seller/plans", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setData(res.data.data);
      else setError(res.data?.message || "Failed to load plans");
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to load plans"
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSelect = async (planId: PlanId) => {
    if (busy) return;
    setError("");
    setToast("");
    try {
      setBusy(planId);
      const token = await getToken();
      if (!token) throw new Error("Sign in required");

      if (planId === "free") {
        await api.post(
          "/seller/subscriptions/activate-free",
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setToast("Free Seller is now active.");
        await load();
        return;
      }

      const res = await api.post(
        "/seller/subscriptions/initiate",
        { planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body = res.data?.data || res.data || {};
      if (body.activated) {
        setToast(body.message || "Plan activated.");
        await load();
        return;
      }
      const url = body.authorizationUrl || body.authorization_url;
      const reference = body.reference;
      if (!url) throw new Error(body.message || "No payment URL");

      const browser = await WebBrowser.openAuthSessionAsync(url);
      if (browser.type === "success" && reference) {
        try {
          await api.post(
            "/seller/subscriptions/verify",
            { reference },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setToast("Payment verified. Plan is active.");
        } catch (ve: any) {
          setError(
            ve?.response?.data?.message ||
              "Could not verify payment. If you paid, wait a moment and refresh."
          );
        }
        await load();
      } else if (browser.type !== "success") {
        setError("Payment cancelled. Your current plan is unchanged.");
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Could not start plan change"
      );
    } finally {
      setBusy(null);
    }
  };

  const onPromo = async () => {
    if (busy) return;
    try {
      setBusy("promo");
      setError("");
      const token = await getToken();
      if (!token) throw new Error("Sign in required");
      const res = await api.post(
        "/seller/subscriptions/activate-promo",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setToast(
        res.data?.data?.message ||
          "Promotional Dominant Niche activated for 7 months."
      );
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Promo unavailable"
      );
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={GREEN} size="large" />
          <Text style={styles.muted}>Loading plans…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const active = data?.active;
  const plans = ORDER.map((id) =>
    data?.plans?.find((p) => p.id === id)
  ).filter(Boolean) as PlanRow[];
  const currency = data?.currency || "NGN";
  const country = data?.country || "NG";
  const promo = data?.promo;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Seller plans</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>GROWTH</Text>
        <Text style={styles.sub}>
          Pricing follows your business location ({country} · {currency}) — not
          browse region. Fees on product only.
        </Text>

        {!!error && (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        )}
        {!!toast && (
          <View style={styles.okBox}>
            <Text style={styles.okText}>{toast}</Text>
          </View>
        )}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>YOUR PLAN</Text>
          <Text style={styles.heroTitle}>
            {plans.find((p) => p.id === active?.planId)?.name ||
              active?.planId ||
              "Free Seller"}
            {active?.isPromotional ? " · Promo" : ""}
          </Text>
          <Text style={styles.heroFee}>
            {feePct(active?.transactionFeeRate)} fee
          </Text>
          {active?.isPromotional && active?.promoExpiresAt ? (
            <Text style={styles.heroNote}>
              Promo until{" "}
              {new Date(active.promoExpiresAt).toLocaleDateString()} — no silent
              charge after.
            </Text>
          ) : null}
        </View>

        {(promo?.eligible || promo?.claimed) && (
          <View style={styles.promoBox}>
            <Ionicons name="gift-outline" size={20} color={AMBER} />
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>
                Dominant Niche · promotional
              </Text>
              <Text style={styles.promoBody}>
                {promo.claimed
                  ? `${promo.durationMonths} months free Dominant benefits. Activate or stay on Free.`
                  : `First 200 sellers: Dominant free for ${promo.durationMonths} months.`}
              </Text>
              {(promo.eligible ||
                (promo.claimed && active?.planId !== "dominant")) && (
                <Pressable
                  onPress={() => void onPromo()}
                  disabled={!!busy}
                  style={styles.promoBtn}
                >
                  <LinearGradient colors={[...GRAD]} style={styles.promoGrad}>
                    {busy === "promo" ? (
                      <ActivityIndicator color="#041412" />
                    ) : (
                      <Text style={styles.promoBtnText}>
                        {promo.claimed ? "Activate promo" : "Claim promo slot"}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {plans.map((plan) => {
          const current = plan.id === active?.planId;
          const price = money(plan.price.amount, plan.price.currency);
          return (
            <View
              key={plan.id}
              style={[styles.card, current && styles.cardCurrent]}
            >
              {current && <View style={styles.cardAccent} />}
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>{price}</Text>
              <Text style={styles.planMeta}>
                {plan.price.amount > 0
                  ? `per month · ${country}`
                  : "No monthly charge"}
              </Text>
              <View style={styles.divider} />
              <Text style={styles.feat}>
                · Up to {plan.benefits.maxImagesPerProduct} images / product
              </Text>
              <Text style={styles.feat}>
                · {plan.benefits.showroomVisibility} visibility
              </Text>
              {plan.benefits.priorityDiscovery ? (
                <Text style={styles.feat}>· Priority discovery</Text>
              ) : null}
              {plan.benefits.bannerEligible ? (
                <Text style={styles.feat}>· Banner eligible</Text>
              ) : null}
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Transaction fee</Text>
                <Text style={styles.feeVal}>
                  {feePct(plan.benefits.transactionFeeRate)}
                </Text>
              </View>
              {!current && (
                <Pressable
                  onPress={() => void onSelect(plan.id)}
                  disabled={!!busy}
                  style={styles.cta}
                >
                  <LinearGradient colors={[...GRAD]} style={styles.ctaGrad}>
                    {busy === plan.id ? (
                      <ActivityIndicator color="#041412" />
                    ) : (
                      <Text style={styles.ctaText}>
                        {plan.id === "free"
                          ? "Switch to Free"
                          : `Subscribe · ${price}`}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          );
        })}

        <Text style={styles.footer}>
          Paid plans activate only after Paystack verifies payment. Cancel =
          current plan stays.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { color: MUTED, fontSize: 13 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: TEXT,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: MUTED,
    marginBottom: 6,
  },
  sub: { fontSize: 13, color: SECONDARY, lineHeight: 19, marginBottom: 16 },
  errBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,68,68,0.3)",
    padding: 12,
    marginBottom: 12,
  },
  errText: { color: "#FCA5A5", fontSize: 13 },
  okBox: {
    backgroundColor: "rgba(0,229,117,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,229,117,0.3)",
    padding: 12,
    marginBottom: 12,
  },
  okText: { color: GREEN, fontSize: 13 },
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,229,117,0.25)",
    backgroundColor: "rgba(0,229,117,0.08)",
    padding: 16,
    marginBottom: 14,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: MUTED,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: "800",
    color: TEXT,
  },
  heroFee: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: "800",
    color: GREEN,
  },
  heroNote: { marginTop: 8, fontSize: 12, color: SECONDARY, lineHeight: 17 },
  promoBox: {
    flexDirection: "row",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(245,158,11,0.35)",
    backgroundColor: "rgba(245,158,11,0.08)",
    padding: 14,
    marginBottom: 14,
  },
  promoTitle: { fontSize: 14, fontWeight: "800", color: "#FDE68A" },
  promoBody: {
    marginTop: 4,
    fontSize: 12.5,
    color: SECONDARY,
    lineHeight: 18,
  },
  promoBtn: { marginTop: 10, overflow: "hidden" },
  promoGrad: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  promoBtnText: { color: "#041412", fontWeight: "800", fontSize: 13 },
  card: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardCurrent: { borderColor: "rgba(0,229,117,0.4)" },
  cardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: GREEN,
  },
  planName: { fontSize: 16, fontWeight: "800", color: TEXT },
  planPrice: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
  },
  planMeta: { marginTop: 2, fontSize: 11, color: MUTED },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 12,
  },
  feat: { fontSize: 13, color: SECONDARY, marginBottom: 4, lineHeight: 18 },
  feeRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feeLabel: { fontSize: 12, color: MUTED },
  feeVal: { fontSize: 15, fontWeight: "800", color: TEXT },
  cta: { marginTop: 12, overflow: "hidden" },
  ctaGrad: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#041412", fontWeight: "800", fontSize: 14 },
  footer: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    color: MUTED,
    lineHeight: 16,
  },
});
