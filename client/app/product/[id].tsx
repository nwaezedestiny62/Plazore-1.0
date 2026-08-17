import { useCart } from "@/context/CartContext";
import { useMarketplace } from "@/context/MarketplaceContext";
import { useWishlist } from "@/context/WishlistContext";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { useAuth } from "@clerk/clerk-expo";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "@/constants/api";
import { PlazoreAIData } from "@/constants/plazoreAI";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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

const { width, height: SCREEN_H } = Dimensions.get("window");
const GALLERY_H = Math.min(Math.max(SCREEN_H * 0.58, width * 0.95), 440);

const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "#252A33";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const AI_GREEN = "#10B981";
const AI_BLUE = "#3B82F6";
const ERROR = "#EF6262";

const GRADIENT_COLORS = [AI_GREEN, "#14B8A6", AI_BLUE] as const;

const FONT = {
  space500: "SpaceGrotesk_500Medium",
  space600: "SpaceGrotesk_600SemiBold",
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

/** Clamps long text; shows Read more when needed */
function ExpandableText({
  text,
  style,
  numberOfLines = 3,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needsMore, setNeedsMore] = useState(false);

  if (!text?.trim()) return null;

  return (
    <View style={{ width: "100%" }}>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={(e) => {
          if (!expanded && e.nativeEvent.lines.length >= numberOfLines) {
            setNeedsMore(true);
          }
        }}
      >
        {text}
      </Text>
      {needsMore && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
          hitSlop={10}
          style={{ marginTop: 6, alignSelf: "flex-start" }}
        >
          <Text style={styles.readMore}>
            {expanded ? "Show less" : "Read more"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function formatSpecKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StorePreloader() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.loaderRoot}>
      <View style={styles.orbWrapper}>
        <Animated.View style={[styles.orbRing, { transform: [{ rotate }] }]} />
        <View style={styles.orbLogoWrap}>
          <Image
            source={require("@/assets/logo-1.png")}
            style={styles.orbLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

function normalizeSpecs(raw: any): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && String(v).trim()) out[String(k)] = String(v);
    }
    return out;
  }
  return {};
}

function PlazoreAIOrb({ size = 64 }: { size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.2,
          borderColor: "transparent",
          borderTopColor: AI_GREEN,
          borderRightColor: AI_BLUE,
          borderBottomColor: "transparent",
          borderLeftColor: AI_GREEN,
          transform: [{ rotate }],
        }}
      />
      <View
        style={{
          width: size * 0.52,
          height: size * 0.52,
          borderRadius: (size * 0.52) / 2,
          backgroundColor: "rgba(16,185,129,0.1)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={require("@/assets/images/plazore-ai-logo.png")}
          style={{ width: size * 0.32, height: size * 0.32 }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

export default function ProductDetails() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });

  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [isOwnProduct, setIsOwnProduct] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [aiData, setAiData] = useState<PlazoreAIData | null>(null);
  const [aiReady, setAiReady] = useState(false);

  const aiReveal = useRef(new Animated.Value(0)).current;
  const aiLift = useRef(new Animated.Value(12)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const topBarOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAiReady(true);
      Animated.parallel([
        Animated.timing(aiReveal, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(aiLift, {
          toValue: 0,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const wishlistApi = useWishlist() as any;
  const { isInWishlist, toggleWishlist, addToWishlist, mutateWishlist } =
    wishlistApi;
  const { addToCart, itemCount } = useCart();
  const { formatProduct } = useMarketplace();

  useEffect(() => {
    const loadCurrentUser = async () => {
      if (!isSignedIn) {
        setCurrentUserId(null);
        setIsOwnProduct(false);
        return;
      }
      try {
        const token = await getToken();
        if (!token) return;
        const endpoints = ["/users/me", "/users/profile", "/user/me"];
        let myId: string | null = null;
        for (const endpoint of endpoints) {
          try {
            const res = await api.get(endpoint, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data?.success && res.data?.data?._id) {
              myId = String(res.data.data._id);
              break;
            }
            if (res.data?._id) {
              myId = String(res.data._id);
              break;
            }
          } catch {}
        }
        setCurrentUserId(myId);
      } catch {
        setCurrentUserId(null);
      }
    };
    loadCurrentUser();
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!product || !currentUserId) {
      setIsOwnProduct(false);
      return;
    }
    const sellerId =
      typeof product.seller === "object" && product.seller?._id
        ? String(product.seller._id)
        : typeof product.seller === "string"
          ? String(product.seller)
          : null;
    setIsOwnProduct(!!sellerId && sellerId === currentUserId);
  }, [product, currentUserId]);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get(`/products/${id}`);
        if (res.data.success) {
          const data = res.data.data;
          setProduct(data);
          setWishlistCount(Number(data.wishlistCount) || 0);
          setLiked(!!isInWishlist?.(data._id));

          topBarOpacity.setValue(0);
          Animated.parallel([
            Animated.timing(fadeIn, {
              toValue: 1,
              duration: 380,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(lift, {
              toValue: 0,
              duration: 420,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(topBarOpacity, {
              toValue: 1,
              duration: 520,
              delay: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start();
        } else setProduct(null);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const loadAI = async () => {
      try {
        const res = await api.get(`/ai/product/${id}`);
        if (res.data.success) setAiData(res.data.data);
      } catch {
        setAiData(null);
      }
    };
    loadAI();
  }, [id]);

  useEffect(() => {
    if (!product?._id) return;
    setLiked(!!isInWishlist?.(product._id));
  }, [product?._id, wishlistApi.wishlist]);

  const pulseHeart = () => {
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.16,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const runWishlist = useCallback(
    async (mode: "toggle" | "add") => {
      if (!product || busy) return;
      if (mode === "add" && liked) return;

      setBusy(true);
      pulseHeart();
      const wasLiked = liked;
      try {
        let result: { ok: boolean; inWishlist: boolean; changed: boolean };
        if (typeof mutateWishlist === "function") {
          result = await mutateWishlist(product, mode);
        } else if (mode === "add" && typeof addToWishlist === "function") {
          if (wasLiked)
            result = { ok: true, inWishlist: true, changed: false };
          else {
            await addToWishlist(product);
            result = { ok: true, inWishlist: true, changed: true };
          }
        } else {
          if (mode === "add" && wasLiked)
            result = { ok: true, inWishlist: true, changed: false };
          else {
            await toggleWishlist(product);
            result = {
              ok: true,
              inWishlist: mode === "add" ? true : !wasLiked,
              changed: true,
            };
          }
        }
        setLiked(result.inWishlist);
        if (result.changed)
          setWishlistCount((c) =>
            result.inWishlist ? c + 1 : Math.max(0, c - 1),
          );
      } catch {
        setLiked(wasLiked);
      } finally {
        setTimeout(() => setBusy(false), 200);
      }
    },
    [product, busy, liked, mutateWishlist, addToWishlist, toggleWishlist],
  );

  const handleHeartPress = () => runWishlist("toggle");

  const openDocument = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {}
  };

  const handleMessageSeller = async () => {
    if (!product?._id || messaging || isOwnProduct || !isSignedIn) return;
    try {
      setMessaging(true);
      const token = await getToken();
      if (!token) return;
      const res = await api.post(
        "/chat/start",
        { productId: product._id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.success) router.push(`/chat/${res.data.data._id}` as any);
    } catch (error: any) {
      if (
        (error?.response?.data?.message || "")
          .toLowerCase()
          .includes("yourself")
      )
        setIsOwnProduct(true);
    } finally {
      setMessaging(false);
    }
  };

  const onCarouselScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
      useNativeDriver: false,
    }),
  ).current;

  const specifications = useMemo(
    () => normalizeSpecs(product?.specifications),
    [product?.specifications],
  );
  const hasSpecs = Object.keys(specifications).length > 0;
  const verificationDocuments = Array.isArray(product?.verificationDocuments)
    ? product.verificationDocuments
    : [];
  const hasDocs = verificationDocuments.length > 0;

  const heroDarkOpacity = scrollY.interpolate({
    inputRange: [0, GALLERY_H * 0.45, GALLERY_H * 0.9],
    outputRange: [0, 0.4, 0.78],
    extrapolate: "clamp",
  });

  if (loading || !fontsLoaded) {
    return <StorePreloader />;
  }

  if (!product) {
    return (
      <SafeAreaView style={[styles.center, { paddingHorizontal: 32 }]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cube-outline" size={26} color={AI_GREEN} />
        </View>
        <Text style={styles.emptyTitle}>Piece not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.emptyBtn}
          activeOpacity={0.88}
        >
          <Text style={styles.emptyBtnText}>Return</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const images: string[] = product.images?.length > 0 ? product.images : [];
  const ship = product.shipping || {};
  const deliveryFee = Number(ship.deliveryFee) || 0;
  const seller = product.seller || {};
  const sellerId =
    typeof seller === "object" && seller?._id
      ? String(seller._id)
      : typeof seller === "string"
        ? seller
        : null;

  const isSelf = ship.method === "self";
  const courierName =
    ship.courier ||
    ship.courierName ||
    ship.courierCompany ||
    ship.company ||
    null;
  const deliveryMethodLabel = isSelf
    ? "Direct Merchant Delivery"
    : courierName
      ? courierName
      : "Courier Delivery";

  const categoryLabel =
    typeof product.category === "string"
      ? product.category
      : product.category?.name;
  const productRegion = product.region;
  const shipsFrom =
    product.fulfillmentLocation?.displayLabel ||
    [product.fulfillmentLocation?.city, product.fulfillmentLocation?.country]
      .filter(Boolean)
      .join(", ") ||
    [
      seller?.shippingDefaults?.address?.state,
      seller?.shippingDefaults?.address?.country,
    ]
      .filter(Boolean)
      .join(", ") ||
    null;

  const showProductCommunication = isSignedIn && !isOwnProduct;
  const inStock = Number(product.stock) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeIn,
          transform: [{ translateY: lift }],
        }}
      >
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          nestedScrollEnabled
          scrollEventThrottle={16}
          overScrollMode="never"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
        >
          <View style={styles.galleryRoot} collapsable={false}>
            {images.length > 0 ? (
              <Animated.ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                decelerationRate="fast"
                disableIntervalMomentum
                scrollEventThrottle={16}
                onScroll={onCarouselScroll}
                style={styles.galleryScroll}
                removeClippedSubviews={false}
                overScrollMode="never"
              >
                {images.map((img, index) => (
                  <View
                    key={`g-${index}`}
                    style={styles.gallerySlide}
                    collapsable={false}
                  >
                    <Image
                      source={{ uri: img }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                      fadeDuration={Platform.OS === "android" ? 0 : undefined}
                    />
                  </View>
                ))}
              </Animated.ScrollView>
            ) : (
              <View style={styles.noImage}>
                <Ionicons name="image-outline" size={40} color="#3A3F4A" />
              </View>
            )}

            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: "#090B0F", opacity: heroDarkOpacity },
              ]}
            />

            <LinearGradient
              colors={[
                "transparent",
                "rgba(9,11,15,0.3)",
                "rgba(9,11,15,0.75)",
              ]}
              style={styles.galleryFade}
              pointerEvents="none"
            />

            {images.length > 1 && (
              <View style={styles.dots} pointerEvents="none">
                {images.map((_, index) => {
                  const inputRange = [
                    (index - 1) * width,
                    index * width,
                    (index + 1) * width,
                  ];
                  const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [5, 16, 5],
                    extrapolate: "clamp",
                  });
                  const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.28, 1, 0.28],
                    extrapolate: "clamp",
                  });
                  return (
                    <Animated.View
                      key={`d-${index}`}
                      style={{
                        width: dotWidth,
                        opacity,
                        height: 3.5,
                        borderRadius: 2,
                        backgroundColor: TEXT,
                        marginHorizontal: 3,
                      }}
                    />
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.contentSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.identityBlock}>
              {(product.brand || categoryLabel) && (
                <Text style={styles.eyebrow} numberOfLines={1}>
                  {product.brand || categoryLabel}
                </Text>
              )}

              <ExpandableText
                text={String(product.name || "")}
                style={styles.productName}
                numberOfLines={2}
              />

              <View style={styles.priceRow}>
                <Text style={styles.price} numberOfLines={1}>
                  {formatProduct(Number(product.price), productRegion)}
                </Text>

                <View
                  style={[
                    styles.availableBadge,
                    inStock
                      ? styles.availableBadgeOn
                      : styles.availableBadgeOff,
                  ]}
                >
                  {inStock ? (
                    <LinearGradient
                      colors={[...GRADIENT_COLORS]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.availableDot}
                    />
                  ) : (
                    <View
                      style={[styles.availableDot, { backgroundColor: ERROR }]}
                    />
                  )}
                  {inStock ? (
                    <GradientText style={styles.availableText}>
                      {`Available · ${product.stock}`}
                    </GradientText>
                  ) : (
                    <Text style={[styles.availableText, { color: ERROR }]}>
                      Unavailable
                    </Text>
                  )}
                </View>
              </View>

              {(categoryLabel || product.subCategory) && (
                <View style={styles.chipRow}>
                  {!!categoryLabel && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText} numberOfLines={1}>
                        {categoryLabel}
                      </Text>
                    </View>
                  )}
                  {!!product.subCategory && (
                    <View style={styles.chip}>
                      <Text
                        style={[styles.chipText, { color: MUTED }]}
                        numberOfLines={1}
                      >
                        {product.subCategory}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ═══ Plazore AI — Space Grotesk only here ═══ */}
            <View style={styles.aiCard}>
              <LinearGradient
                colors={["rgba(20,24,32,0.85)", "rgba(17,20,26,0.9)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />

              {!aiReady ? (
                <View style={styles.aiLoader}>
                  <PlazoreAIOrb size={56} />
                </View>
              ) : (
                <Animated.View
                  style={{
                    opacity: aiReveal,
                    transform: [{ translateY: aiLift }],
                    paddingHorizontal: 18,
                    paddingTop: 16,
                    paddingBottom: 14,
                  }}
                >
                  <View style={styles.aiHeader}>
                    <Image
                      source={require("@/assets/images/plazore-ai-logo.png")}
                      style={styles.aiLogo}
                      resizeMode="contain"
                    />
                    <Text style={styles.aiLabel}>Plazore AI</Text>
                  </View>

                  <Text style={styles.aiQuickInsights}>Quick AI Insights</Text>

                  <ExpandableText
                    text={
                      aiData?.status === "ready"
                        ? String(aiData.summary || "")
                        : "Plazore AI is preparing a thoughtful reading of this listing."
                    }
                    style={styles.aiSummary}
                    numberOfLines={4}
                  />

                  {aiData?.status === "ready" &&
                    aiData.highlights?.length > 0 && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={styles.aiSectionTitle}>Key Points</Text>

                        <View style={styles.highlightRow}>
                          <LinearGradient
                            colors={[...GRADIENT_COLORS]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bullet}
                          />
                          <Text style={styles.highlightText} numberOfLines={2}>
                            {aiData.highlights[0]}
                          </Text>
                        </View>

                        {aiData.highlights.length > 1 && (
                          <View
                            style={[styles.highlightRow, { opacity: 0.28 }]}
                          >
                            <LinearGradient
                              colors={[...GRADIENT_COLORS]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.bullet}
                            />
                            <Text
                              style={styles.highlightText}
                              numberOfLines={1}
                            >
                              {aiData.highlights[1]}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                  <TouchableOpacity
                    onPress={() => router.push(`/product/${id}/ai` as any)}
                    activeOpacity={0.75}
                    style={styles.showMoreBtn}
                  >
                    <Text style={styles.showMoreText}>See more</Text>
                    <Ionicons
                      name="chevron-down"
                      size={13}
                      color={SECONDARY}
                      style={{ marginLeft: 5 }}
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            {/* ═══ Buyer Confidence ═══ */}
            <View style={styles.confidenceCard}>
              <LinearGradient
                colors={["rgba(16,185,129,0.08)", "rgba(59,130,246,0.06)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.confidenceHeader}>
                <LinearGradient
                  colors={[...GRADIENT_COLORS]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confidenceBadge}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={12}
                    color="#FFFFFF"
                  />
                </LinearGradient>
                <GradientText style={styles.confidenceEyebrow}>
                  Buyer Confidence
                </GradientText>
              </View>
              <Text style={styles.confidenceLevel} numberOfLines={2}>
                {aiData?.buyerConfidence?.level || "Verified Atelier Standard"}
              </Text>
              <ExpandableText
                text={
                  aiData?.confidenceExplanation ||
                  "Drawn from merchant verification history, transparent disclosures, and regional standards."
                }
                style={styles.confidenceBody}
                numberOfLines={3}
              />
            </View>

            {!!product.description && (
              <View style={{ marginBottom: 28 }}>
                <Text style={styles.sectionEyebrow}>Description</Text>
                <ExpandableText
                  text={String(product.description)}
                  style={styles.body}
                  numberOfLines={4}
                />
              </View>
            )}

            {hasSpecs && (
              <View style={[styles.card, { marginBottom: 28 }]}>
                <Text style={styles.cardTitle}>Specifications</Text>
                {Object.entries(specifications).map(
                  ([key, value], index, arr) => (
                    <View
                      key={key}
                      style={[
                        styles.specRow,
                        index < arr.length - 1 && styles.specBorder,
                      ]}
                    >
                      <Text style={styles.specKey} numberOfLines={2}>
                        {formatSpecKey(key)}
                      </Text>
                      <Text style={styles.specValue} numberOfLines={3}>
                        {value}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            )}

            {hasDocs && (
              <View style={[styles.card, { marginBottom: 28 }]}>
                <Text style={styles.cardTitle}>Verification Documents</Text>
                {verificationDocuments.map((doc: any, i: number) => (
                  <TouchableOpacity
                    key={`${doc.secureUrl}-${i}`}
                    onPress={() =>
                      doc.secureUrl && openDocument(doc.secureUrl)
                    }
                    activeOpacity={0.8}
                    style={[
                      styles.docRow,
                      i < verificationDocuments.length - 1 && styles.specBorder,
                    ]}
                  >
                    <View style={styles.docIcon}>
                      <Ionicons
                        name="document-text-outline"
                        size={16}
                        color={SECONDARY}
                      />
                    </View>
                    <View style={{ flex: 1, marginRight: 8, minWidth: 0 }}>
                      <Text style={styles.docName} numberOfLines={1}>
                        {doc.documentName || "Document"}
                      </Text>
                      <Text style={styles.docType} numberOfLines={1}>
                        {String(doc.documentType || "document").replace(
                          /_/g,
                          " ",
                        )}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={14} color={MUTED} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.sectionEyebrow}>Shipping Details</Text>
            <View style={[styles.card, { marginBottom: 10 }]}>
              <View style={styles.shipHeader}>
                <View style={styles.shipIcon}>
                  <Ionicons
                    name={isSelf ? "walk-outline" : "car-outline"}
                    size={16}
                    color={SECONDARY}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.shipLabel}>Delivery</Text>
                  <Text style={styles.shipMethod} numberOfLines={2}>
                    {deliveryMethodLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.shipFeeRow}>
                <Text style={styles.shipFeeLabel}>Delivery fee</Text>
                <Text style={styles.shipFeeValue} numberOfLines={1}>
                  {formatProduct(deliveryFee, productRegion)}
                </Text>
              </View>
            </View>

            {!!shipsFrom && (
              <View style={[styles.card, styles.shipsFromCard]}>
                <View style={styles.shipIcon}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={SECONDARY}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.shipLabel}>Ships from</Text>
                  <Text style={styles.shipMethod} numberOfLines={2}>
                    {shipsFrom}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionEyebrow}>Sold By</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!sellerId}
              onPress={() =>
                sellerId && router.push(`/store/${sellerId}` as any)
              }
              style={[styles.card, styles.storeCard]}
            >
              {seller.storeLogo ? (
                <Image
                  source={{ uri: seller.storeLogo }}
                  style={styles.storeLogo}
                />
              ) : (
                <View style={styles.storeLogoFallback}>
                  <Ionicons
                    name="storefront-outline"
                    size={18}
                    color={SECONDARY}
                  />
                </View>
              )}
              <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                <Text style={styles.storeLabel}>Visit storefront</Text>
                <Text style={styles.storeName} numberOfLines={1}>
                  {seller.storeName || seller.name || "Atelier Merchant"}
                </Text>
                <Text style={styles.storeDesc} numberOfLines={1}>
                  {seller.storeDescription || "Open this seller's showroom"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={MUTED} />
            </TouchableOpacity>

            {showProductCommunication && (
              <>
                <Text style={styles.sectionEyebrow}>Message Seller</Text>
                <TouchableOpacity
                  onPress={handleMessageSeller}
                  disabled={messaging}
                  activeOpacity={0.88}
                  style={styles.commCard}
                >
                  <LinearGradient
                    colors={["#13201A", "#111820"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />

                  {messaging ? (
                    <ActivityIndicator size="small" color={AI_GREEN} />
                  ) : (
                    <>
                      <View style={styles.commIcon}>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={18}
                          color={AI_GREEN}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.commTitle} numberOfLines={1}>
                          Ask about this product
                        </Text>
                        <Text style={styles.commSub} numberOfLines={1}>
                          Ask questions · Continues inside Plazore
                        </Text>
                      </View>
                      <View style={styles.commArrow}>
                        <Ionicons name="arrow-forward" size={16} color={TEXT} />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.ScrollView>

        <View style={styles.actionBar}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => addToCart(product, "")}
              style={styles.secondaryBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Add to Bag</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                addToCart(product, "");
                router.push("/(tabs)/checkout" as any);
              }}
              activeOpacity={0.9}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Buy Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(tabs)/cart" as any)}
              style={styles.cartBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="bag-handle-outline" size={18} color={TEXT} />
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <SafeAreaView
          edges={["top"]}
          style={styles.topBar}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.topRow, { opacity: topBarOpacity }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.85}
              style={styles.topBtn}
            >
              <Ionicons name="chevron-back" size={18} color={TEXT} />
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <TouchableOpacity
                onPress={handleHeartPress}
                activeOpacity={0.85}
                disabled={busy}
                style={[
                  styles.topBtn,
                  liked && {
                    borderColor: "rgba(239,98,98,0.4)",
                    backgroundColor: "rgba(9,11,15,0.75)",
                  },
                ]}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={17}
                    color={liked ? ERROR : TEXT}
                  />
                </Animated.View>
              </TouchableOpacity>
              {wishlistCount > 0 && (
                <Text style={styles.wishCount}>{wishlistCount}</Text>
              )}
            </View>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
  },
  loaderRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  orbWrapper: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  orbRing: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2.4,
    borderColor: "transparent",
    borderTopColor: AI_GREEN,
    borderRightColor: AI_BLUE,
    borderBottomColor: "transparent",
    borderLeftColor: AI_GREEN,
  },
  orbLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  orbLogo: { width: 32, height: 32 },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: LINE,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyBtn: {
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: TEXT,
  },
  emptyBtnText: {
    color: BG,
    fontWeight: "700",
    fontSize: 13,
  },

  galleryRoot: {
    width,
    height: GALLERY_H,
    backgroundColor: "#07080C",
    overflow: "hidden",
  },
  galleryScroll: { width, height: GALLERY_H },
  gallerySlide: { width, height: GALLERY_H },
  galleryImage: { width, height: GALLERY_H },
  noImage: {
    flex: 1,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
  },
  dots: {
    position: "absolute",
    bottom: 36,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },

  contentSheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 16,
    marginTop: -20,
    minHeight: SCREEN_H * 0.55,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 18,
  },

  identityBlock: { marginBottom: 22, width: "100%" },
  eyebrow: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  productName: {
    color: TEXT,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 31,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 2,
    gap: 12,
    flexWrap: "wrap",
    width: "100%",
  },
  price: {
    color: TEXT,
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.3,
    flexShrink: 1,
    maxWidth: "58%",
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    flexShrink: 0,
    maxWidth: "100%",
  },
  availableBadgeOn: {
    backgroundColor: "rgba(16,185,129,0.1)",
    borderColor: "rgba(59,130,246,0.28)",
  },
  availableBadgeOff: {
    backgroundColor: "rgba(239,98,98,0.1)",
    borderColor: "rgba(239,98,98,0.28)",
  },
  availableDot: { width: 6, height: 6, borderRadius: 3 },
  availableText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  chip: {
    backgroundColor: SURFACE_2,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    maxWidth: width - 60,
  },
  chipText: {
    color: SECONDARY,
    fontSize: 12.5,
    fontWeight: "500",
  },

  /* AI — Space Grotesk */
  aiCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.22)",
    marginBottom: 22,
    overflow: "hidden",
    backgroundColor: "rgba(17,20,26,0.65)",
  },
  aiLoader: {
    height: 118,
    alignItems: "center",
    justifyContent: "center",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  aiLogo: { width: 22, height: 22 },
  aiLabel: {
    color: "#FFFFFF",
    fontFamily: FONT.space600,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  aiQuickInsights: {
    color: "rgba(255,255,255,0.88)",
    fontFamily: FONT.space500,
    fontSize: 14,
    marginBottom: 12,
    marginTop: 2,
  },
  aiSummary: {
    color: TEXT,
    fontSize: 15.2,
    lineHeight: 23,
    letterSpacing: -0.15,
  },
  aiSectionTitle: {
    color: TEXT,
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 9,
    letterSpacing: -0.2,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 7,
  },
  bullet: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    marginTop: 8,
    marginRight: 10,
  },
  highlightText: {
    color: SECONDARY,
    fontSize: 14.5,
    lineHeight: 20.5,
    flex: 1,
  },
  showMoreBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.13)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  showMoreText: {
    color: TEXT,
    fontSize: 13.5,
    fontWeight: "500",
  },

  confidenceCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.22)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
    overflow: "hidden",
    backgroundColor: "rgba(17,20,26,0.7)",
  },
  confidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 7,
  },
  confidenceBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  confidenceEyebrow: {
    fontFamily: FONT.space500,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  confidenceLevel: {
    color: TEXT,
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  confidenceBody: {
    color: SECONDARY,
    fontSize: 13,
    lineHeight: 19,
  },

  sectionEyebrow: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 18,
  },
  body: {
    color: SECONDARY,
    fontSize: 15.5,
    lineHeight: 24.5,
  },
  cardTitle: {
    color: TEXT,
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 12,
  },
  readMore: {
    color: AI_GREEN,
    fontSize: 13,
    fontWeight: "600",
  },

  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 11,
    gap: 10,
  },
  specBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  specKey: {
    color: MUTED,
    fontSize: 13.5,
    flexShrink: 0,
    maxWidth: "40%",
  },
  specValue: {
    color: TEXT,
    fontSize: 13.5,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
  },

  docRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  docName: { color: TEXT, fontSize: 14.5, fontWeight: "500" },
  docType: {
    color: MUTED,
    fontSize: 11.5,
    marginTop: 2,
    textTransform: "capitalize",
  },

  shipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },
  shipIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  shipLabel: {
    color: MUTED,
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  shipMethod: {
    color: TEXT,
    fontWeight: "600",
    fontSize: 15.5,
    marginTop: 2,
  },
  shipFeeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    gap: 8,
  },
  shipFeeLabel: { color: SECONDARY, fontSize: 14.5 },
  shipFeeValue: {
    color: TEXT,
    fontWeight: "600",
    fontSize: 15.5,
    flexShrink: 1,
  },
  shipsFromCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  commCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.25)",
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  commIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(16,185,129,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.22)",
  },
  commTitle: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  commSub: {
    color: SECONDARY,
    fontSize: 13,
    marginTop: 3,
  },
  commArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },

  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  storeLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SURFACE_2,
  },
  storeLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  storeLabel: {
    color: MUTED,
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  storeName: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 15.5,
    marginTop: 2,
  },
  storeDesc: { color: MUTED, fontSize: 12.5, marginTop: 2 },

  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(9,11,15,0.97)",
  },
  actionRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  secondaryBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: SURFACE_2,
  },
  secondaryBtnText: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#090B0F",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  cartBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    backgroundColor: AI_GREEN,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { color: TEXT, fontSize: 9.5, fontWeight: "800" },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topRow: {
    paddingHorizontal: 14,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(9,11,15,0.58)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  wishCount: {
    color: TEXT,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 3,
  },
});