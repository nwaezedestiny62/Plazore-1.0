import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "@/constants/api";
import { PlazoreAIData } from "@/constants/plazoreAI";

const BG = "#090B0F";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const AI_GREEN = "#10B981";
const AI_BLUE = "#3B82F6";

export default function PlazoreAIScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<PlazoreAIData | null>(null);
  const [revealed, setRevealed] = useState(false);

  const orbRotation = useRef(new Animated.Value(0)).current;
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealLift = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(orbRotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();

    const revealTimer = setTimeout(() => {
      setRevealed(true);
      Animated.parallel([
        Animated.timing(revealOpacity, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(revealLift, {
          toValue: 0,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 2600);

    return () => {
      clearTimeout(revealTimer);
      loop.stop();
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchAI = async () => {
      try {
        const res = await api.get(`/ai/product/${id}`);
        if (res.data.success) setData(res.data.data);
      } catch {
        setData(null);
      }
    };
    fetchAI();
  }, [id]);

  const rotate = orbRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color={TEXT} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Image
              source={require("@/assets/images/plazore-ai-logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Plazore AI</Text>
            <Text style={styles.headerSub}>Product Intelligence</Text>
          </View>

          <View style={{ width: 42 }} />
        </View>
      </SafeAreaView>

      {!revealed ? (
        /* ── PRELOADER ── */
        <View style={styles.loaderContainer}>
          <View style={styles.loaderCard}>
            <LinearGradient
              colors={["rgba(16,185,129,0.07)", "rgba(59,130,246,0.05)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Logo + ring around it */}
            <View style={styles.orbWrapper}>
              {/* Rotating ring */}
              <Animated.View
                style={[styles.orbRing, { transform: [{ rotate }] }]}
              >
                <View style={styles.orbRingInner} />
              </Animated.View>

              {/* Logo in the center */}
              <View style={styles.orbLogoWrap}>
                <Image
                  source={require("@/assets/images/plazore-ai-logo.png")}
                  style={styles.orbLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* ── CONTENT ── */
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 70 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          decelerationRate="normal"
        >
          <Animated.View
            style={{
              opacity: revealOpacity,
              transform: [{ translateY: revealLift }],
            }}
          >
            {/* Simple title only — no extra logo */}
            <View style={styles.heroBlock}>
              <Text style={styles.heroTitle}>Product Interpretation</Text>
              <Text style={styles.heroSub}>
                A structured reading of this listing
              </Text>
            </View>

            {data?.summary ? (
              <InsightSection eyebrow="Summary" title="Quick interpretation">
                <Text style={styles.bodyText}>{data.summary}</Text>
              </InsightSection>
            ) : null}

            <InsightSection eyebrow="Understand" title="The product in context">
              <Text style={styles.bodyText}>
                {data?.overview ||
                  "Plazore AI is still preparing the full interpretation for this listing."}
              </Text>
            </InsightSection>

            {!!data?.highlights?.length && (
              <InsightSection eyebrow="Evaluate" title="What stands out">
                {data.highlights.map((item: string, index: number) => (
                  <Bullet key={index} text={item} />
                ))}
              </InsightSection>
            )}

            {!!data?.bestFor?.length && (
              <InsightSection eyebrow="Consider" title="What may matter to you">
                {data.bestFor.map((item: string, index: number) => (
                  <Bullet key={index} text={item} />
                ))}
              </InsightSection>
            )}

            {!!data?.thingsToConsider?.length && (
              <InsightSection eyebrow="Clarity" title="Things worth noting">
                {data.thingsToConsider.map((item: string, index: number) => (
                  <Bullet key={index} text={item} />
                ))}
              </InsightSection>
            )}

            {data?.shippingSummary ? (
              <InsightSection eyebrow="Delivery" title="Shipping details">
                <Text style={styles.bodyText}>{data.shippingSummary}</Text>
              </InsightSection>
            ) : null}

            {data?.buyerConfidence ? (
              <InsightSection eyebrow="Confidence" title="Buyer confidence">
                <View style={styles.confidenceBadge}>
                  <Ionicons name="shield-checkmark" size={15} color={AI_GREEN} />
                  <Text style={styles.confidenceLevel}>
                    {data.buyerConfidence.level}
                  </Text>
                </View>
                <Text style={[styles.bodyText, { marginTop: 10 }]}>
                  {data.confidenceExplanation}
                </Text>
              </InsightSection>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Plazore AI interprets the information shared by the merchant. It
                helps you understand the listing — it does not decide for you.
              </Text>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

function InsightSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <LinearGradient
        colors={["rgba(16,185,129,0.05)", "rgba(59,130,246,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bullet} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  headerSafe: {
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerLogo: {
    width: 20,
    height: 20,
    marginBottom: 3,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSub: {
    color: AI_GREEN,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 2,
  },

  // Preloader
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loaderCard: {
    width: "100%",
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.2)",
    backgroundColor: "rgba(17,20,26,0.7)",
    paddingVertical: 60,
    alignItems: "center",
    overflow: "hidden",
  },
  orbWrapper: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  orbRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2.5,
    borderColor: "transparent",
    borderTopColor: AI_GREEN,
    borderRightColor: AI_BLUE,
    borderBottomColor: "transparent",
    borderLeftColor: AI_GREEN,
  },
  orbRingInner: {
    // keeps the border visible
  },
  orbLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  orbLogo: {
    width: 34,
    height: 34,
  },
  loaderText: {
    marginTop: 28,
    color: MUTED,
    fontSize: 13,
    letterSpacing: 0.8,
  },

  // Hero (no logo)
  heroBlock: {
    marginBottom: 26,
    marginTop: 6,
  },
  heroTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  heroSub: {
    color: SECONDARY,
    fontSize: 14.5,
    marginTop: 6,
    lineHeight: 21,
  },

  // Sections
  section: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.18)",
    backgroundColor: "rgba(17,20,26,0.65)",
    padding: 18,
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionEyebrow: {
    color: AI_GREEN,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  bodyText: {
    color: SECONDARY,
    fontSize: 15,
    lineHeight: 24,
  },

  // Bullets
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: AI_GREEN,
    marginTop: 8,
    marginRight: 11,
  },
  bulletText: {
    flex: 1,
    color: SECONDARY,
    fontSize: 14.5,
    lineHeight: 22,
  },

  // Confidence
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.25)",
  },
  confidenceLevel: {
    color: TEXT,
    fontSize: 14.5,
    fontWeight: "600",
  },

  // Footer
  footer: {
    marginTop: 12,
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  footerText: {
    textAlign: "center",
    color: MUTED,
    fontSize: 12.5,
    lineHeight: 19,
  },
});