import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import api from "@/constants/api";
import type { Product } from "@/constants/types";
import type { PlazoreAIData } from "@/constants/plazoreAI";
import { useCart } from "@/context/CartContext";
import { useMarketplace } from "@/context/MarketplaceContext";

const BG = "#FFFFFF";
const SURFACE = "#F8FAFC";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const DIM = "#94A3B8";
const LINE = "#E2E8F0";
const BLACK = "#050505";
const AI_BLUE = "#4285F4";

function productImage(product: Product) {
  return product.images?.[0] || "";
}

function productCategory(product: Product) {
  return typeof product.category === "string"
    ? product.category
    : product.category?.name || product.subCategory || "Product";
}

function Hotspot({ onPress }: { onPress: () => void }) {
  const beam = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beam, {
          toValue: 1,
          duration: 1250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(beam, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beam]);

  const beamScale = beam.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.25],
  });
  const beamOpacity = beam.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0.34, 0.7, 0],
  });

  return (
    <View style={styles.hotspotAnchor}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.hotspotBeam,
          { opacity: beamOpacity, transform: [{ scale: beamScale }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.hotspotBeamInner, { opacity: beamOpacity }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Plazore AI product insight"
        onPress={onPress}
        style={({ pressed }) => [styles.hotspot, pressed && styles.hotspotPressed]}
      >
        <View style={styles.hotspotWhiteCircle}>
          <Ionicons name="add" size={15} color={BLACK} />
        </View>
      </Pressable>
    </View>
  );
}

function SparkleLoading() {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motion]);

  const bigScale = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.06],
  });
  const smallScale = motion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.08],
  });
  const sparkleOpacity = motion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.68, 1, 0.68],
  });

  return (
    <View style={styles.aiLoading}>
      <View style={styles.sparkleStage}>
        <Animated.Text
          style={[
            styles.sparkleSmallLeft,
            {
              opacity: sparkleOpacity,
              transform: [{ scale: smallScale }, { rotate: "-12deg" }],
            },
          ]}
        >
          ✦
        </Animated.Text>
        <Animated.Text
          style={[
            styles.sparkleBig,
            {
              opacity: sparkleOpacity,
              transform: [{ scale: bigScale }, { rotate: "8deg" }],
            },
          ]}
        >
          ✦
        </Animated.Text>
        <Animated.Text
          style={[
            styles.sparkleSmallRight,
            {
              opacity: sparkleOpacity,
              transform: [{ scale: smallScale }, { rotate: "-8deg" }],
            },
          ]}
        >
          ✦
        </Animated.Text>
      </View>
      <Text style={styles.aiGeneratingText}>Generating suggestions…</Text>
    </View>
  );
}

function InsightPopup({
  product,
  loading,
  data,
  onClose,
  onQuickAdd,
  formatPrice,
}: {
  product: Product | null;
  loading: boolean;
  data: PlazoreAIData | null;
  onClose: () => void;
  onQuickAdd: (product: Product) => void;
  formatPrice: (product: Product) => string;
}) {
  // Keep hooks unconditional to avoid React's static-flag warning.
  const popupOpacity = useRef(new Animated.Value(0)).current;
  const popupTranslateY = useRef(new Animated.Value(24)).current;
  const quickAddScale = useRef(new Animated.Value(1)).current;
  const aiReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    popupOpacity.setValue(0);
    popupTranslateY.setValue(24);
    Animated.parallel([
      Animated.timing(popupOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(popupTranslateY, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [product, popupOpacity, popupTranslateY]);

  useEffect(() => {
    if (loading) {
      aiReveal.setValue(0);
      return;
    }

    Animated.timing(aiReveal, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [loading, aiReveal]);

  if (!product) return null;

  const failed = !loading && (!data || data.status === "failed");
  const pending = !loading && data?.status === "pending";
  const canAdd = product.stock > 0;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.modalBackdrop, { opacity: popupOpacity }]}
        />
        <Pressable onPress={onClose} style={styles.modalBackdropHit} />
        <Animated.View
          style={[
            styles.popup,
            {
              opacity: popupOpacity,
              transform: [{ translateY: popupTranslateY }],
            },
          ]}
        >
          <View style={styles.popupHandle} />
          <View style={styles.popupImageWrap}>
            {productImage(product) ? (
              <Image
                source={{ uri: productImage(product) }}
                style={styles.popupImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.popupImage, { backgroundColor: SURFACE }]} />
            )}
            <LinearGradient
              colors={["transparent", "rgba(15,23,42,0.72)"]}
              style={styles.popupImageShade}
            />
            <Pressable onPress={onClose} style={styles.popupClose}>
              <Ionicons name="close" size={21} color="#FFFFFF" />
            </Pressable>
            <View style={styles.popupImageCopy}>
              <Text style={styles.popupCategory}>
                {productCategory(product).toUpperCase()}
              </Text>
              <Text style={styles.popupName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.popupPrice}>{formatPrice(product)}</Text>
            </View>
          </View>

          <FlatList
            data={[]}
            renderItem={() => null}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.popupBody}
            ListHeaderComponent={
              <>
                <View style={styles.aiHeader}>
                  <View style={styles.aiMark}>
                    <Ionicons name="sparkles" size={17} color="#FFFFFF" />
                  </View>
                  <View style={styles.aiHeaderCopy}>
                    <Text style={styles.aiLabel}>PLAZORE AI</Text>
                    <Text style={styles.aiSubLabel}>Product intelligence</Text>
                  </View>
                  <View style={styles.aiLive}>
                    <View style={styles.aiLiveDot} />
                    <Text style={styles.aiLiveText}>LIVE</Text>
                  </View>
                </View>

                {loading && <SparkleLoading />}
                <Animated.View
                  style={[
                    styles.aiReveal,
                    {
                      opacity: aiReveal,
                      transform: [
                        {
                          translateY: aiReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [10, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {failed && (
                    <Text style={styles.aiError}>
                      Plazore AI is not available for this product yet.
                    </Text>
                  )}
                  {pending && (
                    <Text style={styles.aiError}>
                      This product insight is still being prepared. Please try
                      again shortly.
                    </Text>
                  )}
                  {!loading && !failed && !pending && data && (
                    <View style={styles.aiResult}>
                      {!!data.summary && (
                        <Text style={styles.summary}>{data.summary}</Text>
                      )}
                      {!!data.highlights?.length && (
                        <View style={styles.resultSection}>
                          <Text style={styles.resultHeading}>INSIGHT</Text>
                          {data.highlights.slice(0, 4).map((item, index) => (
                            <View
                              key={`${item}-${index}`}
                              style={styles.resultRow}
                            >
                              <View style={styles.resultBullet} />
                              <Text style={styles.resultText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {!!data.bestFor?.length && (
                        <View style={styles.resultSection}>
                          <Text style={styles.resultHeading}>BEST FOR</Text>
                          {data.bestFor.slice(0, 3).map((item) => (
                            <Text key={item} style={styles.bestFor}>
                              {item}
                            </Text>
                          ))}
                        </View>
                      )}
                      {!!data.buyerConfidence?.level && (
                        <View style={styles.confidence}>
                          <Text style={styles.resultHeading}>
                            BUYER CONFIDENCE
                          </Text>
                          <Text style={styles.confidenceValue}>
                            {data.buyerConfidence.level}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </Animated.View>

                <Animated.View
                  style={{ transform: [{ scale: quickAddScale }] }}
                >
                  <Pressable
                    disabled={!canAdd}
                    onPress={() => onQuickAdd(product)}
                    onPressIn={() => {
                      if (!canAdd) return;
                      Animated.timing(quickAddScale, {
                        toValue: 0.97,
                        duration: 45,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                      }).start();
                    }}
                    onPressOut={() => {
                      Animated.timing(quickAddScale, {
                        toValue: 1,
                        duration: 90,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                      }).start();
                    }}
                    style={[
                      styles.quickAddButton,
                      !canAdd && styles.quickAddDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickAddText,
                        !canAdd && styles.quickAddDisabledText,
                      ]}
                    >
                      {canAdd ? "QUICK ADD TO CART" : "UNAVAILABLE"}
                    </Text>
                  </Pressable>
                </Animated.View>
              </>
            }
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function ShowroomScreen() {
  const insets = useSafeAreaInsets();
  const { addToCart } = useCart();
  const { formatProduct } = useMarketplace();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<PlazoreAIData | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/products?limit=200");
      setProducts(
        res.data?.success && Array.isArray(res.data.data) ? res.data.data : [],
      );
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const formatPrice = useCallback(
    (product: Product) => {
      try {
        return formatProduct(Number(product.price) || 0, product.region);
      } catch {
        return String(product.price ?? "");
      }
    },
    [formatProduct],
  );

  const openInsight = useCallback(async (product: Product) => {
    const startedAt = Date.now();
    setSelected(product);
    setAiData(null);
    setAiLoading(true);

    let nextData: PlazoreAIData | null = null;
    try {
      const res = await api.get(`/ai/product/${product._id}`);
      nextData = res.data?.success ? res.data.data : null;
    } catch {
      nextData = null;
    }

    // Keep the reference-style startup animation visible for 3.7 seconds.
    const remaining = 3700 - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    setAiData(nextData);
    setAiLoading(false);
  }, []);

  const closeInsight = () => {
    setSelected(null);
    setAiData(null);
    setAiLoading(false);
  };

  const quickAdd = (product: Product) => {
    if (product.stock > 0) addToCart(product);
  };

  const renderBanner = ({ item }: { item: Product }) => (
    <View style={styles.bannerBlock}>
      <View style={styles.banner}>
        {productImage(item) ? (
          <Image
            source={{ uri: productImage(item) }}
            style={styles.bannerImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.bannerImage, { backgroundColor: SURFACE }]} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(15,23,42,0.78)"]}
          style={styles.bannerShade}
        />
        <Hotspot onPress={() => openInsight(item)} />
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerCategory}>
            {productCategory(item).toUpperCase()}
          </Text>
          <Text style={styles.bannerName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.bannerPrice}>{formatPrice(item)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Showroom</Text>
      </View>

      <View style={styles.body}>
        <FlatList
          data={products}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderBanner}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchProducts();
              }}
              tintColor={TEXT}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator color={TEXT} />
              ) : (
                <Text style={styles.emptyTitle}>No products yet</Text>
              )}
              <Text style={styles.emptyBody}>
                {loading
                  ? "Loading products…"
                  : "Products added to your database will appear here."}
              </Text>
            </View>
          }
        />
      </View>

      <InsightPopup
        product={selected}
        loading={aiLoading}
        data={aiData}
        onClose={closeInsight}
        onQuickAdd={quickAdd}
        formatPrice={formatPrice}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
    marginLeft: 5,
    fontSize: 28,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.6,
  },
  body: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 150 },
  bannerBlock: { marginBottom: 22 },
  banner: { height: 224, overflow: "hidden", backgroundColor: SURFACE },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  bannerShade: { ...StyleSheet.absoluteFillObject },
  bannerCopy: { position: "absolute", left: 16, right: 16, bottom: 16 },
  bannerCategory: {
    color: "#E2E8F0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  bannerName: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  bannerPrice: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  hotspotAnchor: {
    position: "absolute",
    left: "50%",
    top: "46%",
    width: 54,
    height: 54,
    marginLeft: -27,
    marginTop: -27,
    alignItems: "center",
    justifyContent: "center",
  },
  hotspotBeam: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.82)",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  hotspotBeamInner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.44)",
  },
  hotspot: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLACK,
    borderRadius: 22,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
  hotspotPressed: { transform: [{ scale: 0.93 }] },
  hotspotWhiteCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: "700" },
  emptyBody: { marginTop: 8, color: MUTED, fontSize: 13 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.42)",
  },
  modalBackdropHit: { ...StyleSheet.absoluteFillObject },
  popup: { maxHeight: "88%", backgroundColor: BG },
  popupHandle: {
    alignSelf: "center",
    width: 44,
    height: 3,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: DIM,
  },
  popupImageWrap: { height: 218, position: "relative", overflow: "hidden" },
  popupImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  popupImageShade: { ...StyleSheet.absoluteFillObject },
  popupClose: {
    position: "absolute",
    right: 16,
    top: 14,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  popupImageCopy: { position: "absolute", left: 18, right: 18, bottom: 16 },
  popupCategory: {
    color: "#E2E8F0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  popupName: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  popupPrice: {
    marginTop: 4,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  popupBody: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34 },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  aiMark: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TEXT,
  },
  aiHeaderCopy: { flex: 1, marginLeft: 10 },
  aiLabel: { color: TEXT, fontSize: 13, fontWeight: "800", letterSpacing: 1.2 },
  aiSubLabel: { marginTop: 3, color: MUTED, fontSize: 11 },
  aiLive: { flexDirection: "row", alignItems: "center", gap: 5 },
  aiLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34A853",
  },
  aiLiveText: {
    color: "#34A853",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  aiLoading: {
    alignItems: "center",
    paddingVertical: 28,
    minHeight: 188,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  sparkleStage: {
    width: 180,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
 sparkleSmallLeft: {
  // keep the same position
  fontSize: 12, // was 37
  lineHeight: 26,
},

sparkleBig: {
  // keep the same position
  fontSize: 34, // was 92
  lineHeight: 40,
},

sparkleSmallRight: {
  // keep the same position
  fontSize: 12, // was 42
  lineHeight: 30,
},

  aiGeneratingText: {
    marginTop: 5,
    color: "#5F6368",
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: -0.2,
  },
  aiReveal: { minHeight: 1 },
  aiLoaderRing: {
    width: 42,
    height: 42,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  aiLoaderGradient: { width: 42, height: 42 },
  aiLoadingTitle: {
    marginTop: 16,
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
  aiLoadingBody: {
    marginTop: 7,
    color: MUTED,
    fontSize: 12,
    textAlign: "center",
  },
  aiDots: { flexDirection: "row", gap: 6, marginTop: 14 },
  aiDot: { width: 6, height: 6, borderRadius: 3 },
  aiError: {
    paddingVertical: 28,
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  aiResult: { paddingTop: 18 },
  summary: { color: TEXT, fontSize: 16, lineHeight: 24, fontWeight: "600" },
  resultSection: { marginTop: 22 },
  resultHeading: {
    color: MUTED,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  resultRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 11 },
  resultBullet: {
    width: 5,
    height: 5,
    marginTop: 7,
    marginRight: 9,
    borderRadius: 3,
    backgroundColor: TEXT,
  },
  resultText: { flex: 1, color: TEXT, fontSize: 13, lineHeight: 20 },
  bestFor: {
    marginTop: 10,
    paddingBottom: 10,
    color: TEXT,
    fontSize: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  confidence: {
    marginTop: 22,
    paddingTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  confidenceValue: { color: "#34A853", fontSize: 12, fontWeight: "700" },
  quickAddButton: {
    minHeight: 50,
    marginTop: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TEXT,
  },
  quickAddText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.1,
    textAlign: "center",
  },
  quickAddDisabled: { backgroundColor: SURFACE },
  quickAddDisabledText: { color: DIM },
});
