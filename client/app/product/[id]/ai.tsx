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
  Platform,
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

const CASCADE_STAGGER_MS = 110;
const CASCADE_DURATION_MS = 850;

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

function CascadeItem({
  index,
  active,
  children,
  style,
}: {
  index: number;
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<any>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(22)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    const delay = index * CASCADE_STAGGER_MS;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: CASCADE_DURATION_MS,
        delay,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: CASCADE_DURATION_MS,
        delay,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, index, opacity, lift]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY: lift }],
        },
      ]}
    >
      {children}
    </Animated.View>
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
    }, 2200);

    return () => {
      clearTimeout(revealTimer);
      loop.stop();
    };
  }, [orbRotation]);

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

  let cascadeIndex = 0;
  const nextIndex = () => cascadeIndex++;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/*
        COLUMN LAYOUT
        1) Titlebar (fixed — never scrolls)
        2) Body (flex:1 — only this area scrolls)
      */}
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        {/* ── FIXED TITLEBAR ── */}
        <View style={styles.titlebar} collapsable={false}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.75}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={TEXT} />
          </TouchableOpacity>

          <View style={styles.titlebarCenter} pointerEvents="none">
            <View style={styles.titleRow}>
              <Image
                source={require("@/assets/images/plazore-ai-logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle} numberOfLines={1}>
                Plazore AI
              </Text>
            </View>
            <GradientText style={styles.headerSub}>
              Product Intelligence
            </GradientText>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* ── SCROLLABLE BODY (everything below titlebar) ── */}
        <View style={styles.body}>
          {!revealed ? (
            <View style={styles.loaderContainer}>
              <View style={styles.loaderCard}>
                <LinearGradient
                  colors={[
                    "rgba(16,185,129,0.07)",
                    "rgba(59,130,246,0.05)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.absoluteFill}
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
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
              alwaysBounceVertical={false}
              decelerationRate="normal"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <CascadeItem index={nextIndex()} active={revealed}>
                <ProductImageStack
                  images={productImages}
                  name={productName}
                />
              </CascadeItem>

              {data?.summary ? (
                <CascadeItem index={nextIndex()} active={revealed}>
                  <InsightSection
                    eyebrow="Summary"
                    title="Quick interpretation"
                  >
                    <Text style={styles.bodyText}>{data.summary}</Text>
                  </InsightSection>
                </CascadeItem>
              ) : null}

              <CascadeItem index={nextIndex()} active={revealed}>
                <InsightSection
                  eyebrow="Understand"
                  title="The product in context"
                >
                  <Text style={styles.bodyText}>
                    {data?.overview ||
                      "Plazore AI is still preparing the full interpretation for this listing."}
                  </Text>
                </InsightSection>
              </CascadeItem>

              {!!data?.highlights?.length && (
                <CascadeItem index={nextIndex()} active={revealed}>
                  <InsightSection eyebrow="Evaluate" title="What stands out">
                    {data.highlights.map((item: string, index: number) => (
                      <Bullet key={index} text={item} />
                    ))}
                  </InsightSection>
                </CascadeItem>
              )}

              {!!data?.bestFor?.length && (
                <CascadeItem index={nextIndex()} active={revealed}>
                  <InsightSection
                    eyebrow="Consider"
                    title="What may matter to you"
                  >
                    {data.bestFor.map((item: string, index: number) => (
                      <Bullet key={index} text={item} />
                    ))}
                  </InsightSection>
                </CascadeItem>
              )}

              {!!data?.thingsToConsider?.length && (
                <CascadeItem index={nextIndex()} active={revealed}>
                  <InsightSection
                    eyebrow="Clarity"
                    title="Things worth noting"
                  >
                    {data.thingsToConsider.map(
                      (item: string, index: number) => (
                        <Bullet key={index} text={item} />
                      ),
                    )}
                  </InsightSection>
                </CascadeItem>
              )}

              {data?.shippingSummary ? (
                <CascadeItem index={nextIndex()} active={revealed}>
                  <InsightSection eyebrow="Delivery" title="Shipping details">
                    <Text style={styles.bodyText}>
                      {data.shippingSummary}
                    </Text>
                  </InsightSection>
                </CascadeItem>
              ) : null}

              {data?.buyerConfidence ? (
                <CascadeItem index={nextIndex()} active={revealed}>
                  <InsightSection
                    eyebrow="Confidence"
                    title="Buyer confidence"
                  >
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
                    {data.confidenceExplanation ? (
                      <Text style={[styles.bodyText, { marginTop: 10 }]}>
                        {data.confidenceExplanation}
                      </Text>
                    ) : null}
                  </InsightSection>
                </CascadeItem>
              ) : null}

              <CascadeItem index={nextIndex()} active={revealed}>
                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    Plazore AI interprets the information shared by the
                    merchant. It helps you understand the listing — it does not
                    decide for you.
                  </Text>
                </View>
              </CascadeItem>
            </Animated.ScrollView>
          )}
        </View>
      </SafeAreaView>
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
        style={styles.absoluteFill}
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
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  absoluteFill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  /* Fixed titlebar — sibling of body, NOT inside ScrollView */
  titlebar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.07)",
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  titlebarCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 20,
    height: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: FONT.space600,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontFamily: FONT.space500,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },

  /* Body fills remaining height; only this region scrolls */
  body: {
    flex: 1,
    minHeight: 0,
  },

  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loaderCard: {
    width: "100%",
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

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
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
    marginTop: 4,
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