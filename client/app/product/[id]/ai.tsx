import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { useFonts } from "expo-font";
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
  TextStyle,
  TouchableOpacity,
  View,
  StyleProp,
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
const SURFACE = "#11141A";
const LINE = "#252A33";

const GRADIENT_COLORS = [AI_GREEN, "#14B8A6", AI_BLUE] as const;

const FONT = {
  space500: "SpaceGrotesk_500Medium",
  space600: "SpaceGrotesk_600SemiBold",
  jakarta400: "PlusJakartaSans_400Regular",
  jakarta500: "PlusJakartaSans_500Medium",
  jakarta600: "PlusJakartaSans_600SemiBold",
  jakarta700: "PlusJakartaSans_700Bold",
};

function GradientText({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: "transparent" }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={[...GRADIENT_COLORS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

export default function PlazoreAIScreen() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<PlazoreAIData | null>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productName, setProductName] = useState<string>("");
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

    const fetchAll = async () => {
      try {
        const [aiRes, productRes] = await Promise.all([
          api.get(`/ai/product/${id}`).catch(() => null),
          api.get(`/products/${id}`).catch(() => null),
        ]);

        if (aiRes?.data?.success) setData(aiRes.data.data);

        const p = productRes?.data?.data || productRes?.data?.product;
        if (p) {
          const imgs = Array.isArray(p.images)
            ? p.images.filter((u: string) => !!u)
            : [];
          setProductImages(imgs);
          if (p.name) setProductName(String(p.name));
        }
      } catch {
        setData(null);
      }
    };

    fetchAll();
  }, [id]);

  const rotate = orbRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

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
            <View style={styles.titleRow}>
              <Image
                source={require("@/assets/images/plazore-ai-logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              {/* Space Grotesk 600 · white */}
              <Text style={styles.headerTitle}>Plazore AI</Text>
            </View>
            <GradientText style={styles.headerSub}>
              Product Intelligence
            </GradientText>
          </View>

          <View style={{ width: 42 }} />
        </View>
      </SafeAreaView>

      {!revealed ? (
        <View style={styles.loaderContainer}>
          <View style={styles.loaderCard}>
            <LinearGradient
              colors={["rgba(16,185,129,0.07)", "rgba(59,130,246,0.05)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.orbWrapper}>
              <Animated.View
                style={[styles.orbRing, { transform: [{ rotate }] }]}
              >
                <View style={styles.orbRingInner} />
              </Animated.View>
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
            <ProductImageStack images={productImages} name={productName} />

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
                  <LinearGradient
                    colors={[...GRADIENT_COLORS]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.confidenceIconBg}
                  >
                    <Ionicons
                      name="shield-checkmark"
                      size={14}
                      color="#FFFFFF"
                    />
                  </LinearGradient>
                  <GradientText style={styles.confidenceLevel}>
                    {data.buyerConfidence.level}
                  </GradientText>
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

function ProductImageStack({
  images,
  name,
}: {
  images: string[];
  name?: string;
}) {
  const stack = images.slice(0, 3);
  const hasImages = stack.length > 0;

  return (
    <View style={styles.stackBlock}>
      <View style={styles.stackStage}>
        {hasImages ? (
          stack.map((uri, i) => {
            const depth = stack.length - 1 - i;
            const rotate = depth === 2 ? -8 : depth === 1 ? 7 : 0;
            const offsetX = depth === 2 ? -14 : depth === 1 ? 14 : 0;
            const offsetY = depth > 0 ? 6 : 0;
            const scale = depth === 0 ? 1 : 0.92;
            const zIndex = 10 - depth;

            return (
              <View
                key={`${uri}-${i}`}
                style={[
                  styles.stackCard,
                  {
                    zIndex,
                    transform: [
                      { translateX: offsetX },
                      { translateY: offsetY },
                      { rotate: `${rotate}deg` },
                      { scale },
                    ],
                  },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.stackImg}
                  resizeMode="cover"
                />
              </View>
            );
          })
        ) : (
          <View style={[styles.stackCard, styles.stackPlaceholder]}>
            <Ionicons name="image-outline" size={28} color={MUTED} />
          </View>
        )}
      </View>

      {!!name && (
        <Text style={styles.stackName} numberOfLines={2}>
          {name}
        </Text>
      )}
      <GradientText style={styles.stackCaption}>
        Product interpretation
      </GradientText>
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
      <GradientText style={styles.sectionEyebrow}>{eyebrow}</GradientText>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <LinearGradient
        colors={[...GRADIENT_COLORS]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bullet}
      />
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 22,
    height: 22,
  },
  /* Space Grotesk 600 · white */
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: FONT.space600,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  /* Space Grotesk 500 via gradient mask */
  headerSub: {
    fontFamily: FONT.space500,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 3,
  },

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
  orbRingInner: {},
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

  stackBlock: {
    alignItems: "center",
    marginBottom: 28,
    marginTop: 4,
  },
  stackStage: {
    width: 132,
    height: 148,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  stackCard: {
    position: "absolute",
    width: 108,
    height: 128,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  stackImg: {
    width: "100%",
    height: "100%",
  },
  stackPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: LINE,
  },
  stackName: {
    color: TEXT,
    fontFamily: FONT.jakarta700,
    fontSize: 15,
    textAlign: "center",
    letterSpacing: -0.2,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  stackCaption: {
    fontFamily: FONT.space500,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 6,
  },

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
    fontFamily: FONT.space500,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionTitle: {
    color: TEXT,
    fontFamily: FONT.jakarta700,
    fontSize: 17,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  bodyText: {
    color: SECONDARY,
    fontFamily: FONT.jakarta400,
    fontSize: 15,
    lineHeight: 24,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
    marginRight: 11,
  },
  bulletText: {
    flex: 1,
    color: SECONDARY,
    fontFamily: FONT.jakarta400,
    fontSize: 14.5,
    lineHeight: 22,
  },

  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16,185,129,0.08)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(59,130,246,0.28)",
  },
  confidenceIconBg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  confidenceLevel: {
    fontFamily: FONT.jakarta600,
    fontSize: 14.5,
  },

  footer: {
    marginTop: 12,
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  footerText: {
    textAlign: "center",
    color: MUTED,
    fontFamily: FONT.jakarta400,
    fontSize: 12.5,
    lineHeight: 19,
  },
});