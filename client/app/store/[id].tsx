import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Easing,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import api from "@/constants/api";
import { useMarketplace } from "@/context/MarketplaceContext";

const { width, height } = Dimensions.get("window");
const H_PAD = 20;
const GAP = 14;
const CARD_W = (width - H_PAD * 2 - GAP) / 2;
const ENTRANCE_H = Math.min(height * 0.34, 280);
const FEATURED_H = width * 0.78;
const FEATURED_INTERVAL_MS = 7000;

const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "#252A33";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const AI_GREEN = "#10B981";
const AI_BLUE = "#3B82F6";

type StorePublic = {
  id: string;
  storeName: string;
  storeDescription: string;
  businessGoal: string;
  storeLogo: string;
  storeBanner: string;
  isVerified?: boolean;
  location?: {
    state?: string;
    country?: string;
  };
};

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

  const [descExpanded, setDescExpanded] = useState(false);
const [goalExpanded, setGoalExpanded] = useState(false);

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

export default function PublicStorefront() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { formatProduct } = useMarketplace();

  const [store, setStore] = useState<StorePublic | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
const [goalExpanded, setGoalExpanded] = useState(false);

  const door = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const identityLift = useRef(new Animated.Value(24)).current;
  const featuredRef = useRef<ScrollView>(null);
  const featuredIndexRef = useRef(0);
  const userTouching = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get(`/seller/store/${id}`);
        if (res.data.success) {
          setStore(res.data.data.store);
          setProducts(res.data.data.products || []);
        } else {
          setStore(null);
        }
      } catch (e) {
        console.log("Storefront load error:", e);
        setStore(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (loading || !store) return;

    Animated.sequence([
      Animated.timing(door, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(content, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(identityLift, {
          toValue: 0,
          duration: 720,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [loading, store]);

  // Auto-carousel
  useEffect(() => {
    if (products.length <= 1) return;

    const timer = setInterval(() => {
      if (userTouching.current) return;
      const next = (featuredIndexRef.current + 1) % products.length;
      featuredIndexRef.current = next;
      setFeaturedIndex(next);
      featuredRef.current?.scrollTo({
        x: next * (width - H_PAD * 2),
        animated: true,
      });
    }, FEATURED_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [products.length]);

  const onFeaturedScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const slideW = width - H_PAD * 2;
      const idx = Math.round(x / slideW);
      const safe = Math.max(0, Math.min(idx, products.length - 1));
      featuredIndexRef.current = safe;
      setFeaturedIndex(safe);
    },
    [products.length],
  );

  const locationLabel = [store?.location?.state, store?.location?.country]
    .filter(Boolean)
    .join(", ");

  if (loading) {
    return <StorePreloader />;
  }

  if (!store) {
    return (
      <SafeAreaView style={styles.emptyRoot}>
        <View style={styles.emptyIcon}>
          <Ionicons name="storefront-outline" size={28} color={MUTED} />
        </View>
        <Text style={styles.emptyTitle}>Store not found</Text>
        <Text style={styles.emptySub}>
          This aisle may have moved, or the doors are still closed.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.emptyBtn}
          activeOpacity={0.88}
        >
          <Text style={styles.emptyBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const slideW = width - H_PAD * 2;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        decelerationRate={0.998}
        contentContainerStyle={{ paddingBottom: 70 }}
      >
        {/* ========== ENTRANCE ========== */}
        <Animated.View style={{ opacity: door }}>
          <View style={{ height: ENTRANCE_H, backgroundColor: "#07080C" }}>
            {store.storeBanner ? (
              <Image
                source={{ uri: store.storeBanner }}
                style={{ width, height: ENTRANCE_H }}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#0F172A", "#090B0F", "#111827"]}
                style={{ width, height: ENTRANCE_H }}
              />
            )}

            <LinearGradient
              colors={[
                "rgba(9,11,15,0.15)",
                "transparent",
                "rgba(9,11,15,0.85)",
              ]}
              style={StyleSheet.absoluteFillObject}
            />

            <SafeAreaView
              edges={["top"]}
              style={styles.topBar}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.85}
                style={styles.backBtn}
              >
                <BlurView
                  intensity={40}
                  tint="dark"
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name="chevron-back" size={20} color={TEXT} />
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </Animated.View>

        {/* ========== STORE IDENTITY ========== */}
        <Animated.View
          style={{
            opacity: content,
            transform: [{ translateY: identityLift }],
            marginTop: -36,
            paddingHorizontal: H_PAD,
          }}
        >
          <View style={styles.identityCard}>
            <LinearGradient
              colors={["rgba(17,20,26,0.98)", "rgba(17,20,26,0.92)"]}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.identityTop}>
              <View style={styles.logoWrap}>
                {store.storeLogo ? (
                  <Image
                    source={{ uri: store.storeLogo }}
                    style={styles.logoImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="storefront" size={32} color={MUTED} />
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.storeName} numberOfLines={2}>
                    {store.storeName}
                  </Text>
                  {store.isVerified ? (
                    <View style={styles.verifiedBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={AI_GREEN}
                      />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.openLabel}>Open · Walk the aisles</Text>

                {!!locationLabel && (
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={MUTED}
                    />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {locationLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {!!store.storeDescription && (
  <View style={{ marginTop: 16 }}>
    <Text
      style={styles.desc}
      numberOfLines={descExpanded ? undefined : 3}
    >
      {store.storeDescription}
    </Text>
    {store.storeDescription.length > 110 && (
      <TouchableOpacity
        onPress={() => setDescExpanded((v) => !v)}
        activeOpacity={0.7}
        style={{ marginTop: 6 }}
      >
        <Text style={styles.seeMore}>
          {descExpanded ? "See less" : "See more"}
        </Text>
      </TouchableOpacity>
    )}
  </View>
)}

{!!store.businessGoal && (
  <View style={styles.goalBox}>
    <Text style={styles.goalLabel}>Our goal</Text>
    <Text
      style={styles.goalText}
      numberOfLines={goalExpanded ? undefined : 2}
    >
      {store.businessGoal}
    </Text>
    {store.businessGoal.length > 80 && (
      <TouchableOpacity
        onPress={() => setGoalExpanded((v) => !v)}
        activeOpacity={0.7}
        style={{ marginTop: 6 }}
      >
        <Text style={styles.seeMore}>
          {goalExpanded ? "See less" : "See more"}
        </Text>
      </TouchableOpacity>
    )}
  </View>
)}

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setSaved((s) => !s)}
                activeOpacity={0.88}
                style={[
                  styles.saveBtn,
                  saved && styles.saveBtnActive,
                ]}
              >
                <Ionicons
                  name={saved ? "bookmark" : "bookmark-outline"}
                  size={16}
                  color={saved ? BG : TEXT}
                  style={{ marginRight: 7 }}
                />
                <Text
                  style={[
                    styles.saveBtnText,
                    saved && { color: BG },
                  ]}
                >
                  {saved ? "Saved" : "Save store"}
                </Text>
              </TouchableOpacity>

              <View style={styles.countPill}>
                <Text style={styles.countText}>
                  {products.length} on floor
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ========== FEATURED CAROUSEL ========== */}
        {products.length > 0 && (
          <Animated.View style={{ opacity: content, marginTop: 36 }}>
            <View style={{ paddingHorizontal: H_PAD, marginBottom: 16 }}>
              <Text style={styles.sectionEyebrow}>Front display</Text>
              <Text style={styles.sectionTitle}>Featured on the floor</Text>
            </View>

            <ScrollView
              ref={featuredRef}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              snapToInterval={slideW}
              snapToAlignment="start"
              disableIntervalMomentum
              contentContainerStyle={{ paddingHorizontal: H_PAD }}
              onScrollBeginDrag={() => {
                userTouching.current = true;
              }}
              onScrollEndDrag={() => {
                userTouching.current = false;
              }}
              onMomentumScrollEnd={onFeaturedScrollEnd}
            >
              {products.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  activeOpacity={0.92}
                  onPress={() => router.push(`/product/${p._id}` as any)}
                  style={{ width: slideW }}
                >
                  <View style={styles.featuredCard}>
                    <View style={{ height: FEATURED_H, backgroundColor: SURFACE_2 }}>
                      {p.images?.[0] ? (
                        <Image
                          source={{ uri: p.images[0] }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.noImg}>
                          <Ionicons
                            name="image-outline"
                            size={40}
                            color="#3A3F4A"
                          />
                        </View>
                      )}

                      <LinearGradient
                        colors={[
                          "transparent",
                          "rgba(9,11,15,0.55)",
                          "rgba(9,11,15,0.92)",
                        ]}
                        style={styles.featuredFade}
                      />

                      <View style={styles.featuredInfo}>
                        <Text style={styles.featuredName} numberOfLines={2}>
                          {p.name}
                        </Text>
                        <Text style={styles.featuredPrice}>
                          {formatProduct(
                            Number(p.price),
                            p.region || store?.location?.country || "NG",
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {products.length > 1 && (
              <View style={styles.dotsRow}>
                {products.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === featuredIndex ? 18 : 6,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor:
                        i === featuredIndex ? AI_GREEN : "rgba(255,255,255,0.2)",
                      marginHorizontal: 3,
                    }}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ========== AISLES ========== */}
        <Animated.View
          style={{
            opacity: content,
            paddingHorizontal: H_PAD,
            marginTop: 40,
          }}
        >
          <Text style={styles.sectionEyebrow}>Aisles</Text>
          <Text style={styles.sectionTitle}>Walk the collection</Text>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Open floor</Text>
            <View style={styles.dividerLine} />
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyFloor}>
              <View style={styles.emptyFloorIcon}>
                <Ionicons name="cube-outline" size={26} color={MUTED} />
              </View>
              <Text style={styles.emptyFloorText}>
                This store is still setting up the shelves.{"\n"}Check back soon.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {products.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/product/${p._id}` as any)}
                  style={{ width: CARD_W, marginBottom: 16 }}
                >
                  <View style={styles.gridCard}>
                    <View
                      style={{
                        height: CARD_W * 1.15,
                        backgroundColor: SURFACE_2,
                      }}
                    >
                      {p.images?.[0] ? (
                        <Image
                          source={{ uri: p.images[0] }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.noImg}>
                          <Ionicons
                            name="image-outline"
                            size={24}
                            color="#3A3F4A"
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.gridInfo}>
                      <Text style={styles.gridName} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text style={styles.gridPrice}>
                        {formatProduct(
                          Number(p.price),
                          p.region || store?.location?.country || "NG",
                        )}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>Plazore · Premium Digital Mall</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Preloader
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
  orbLogo: {
    width: 32,
    height: 32,
  },

  // Empty
  emptyRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 17,
    marginTop: 18,
  },
  emptySub: {
    color: SECONDARY,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
  emptyBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: TEXT,
  },
  emptyBtnText: {
    color: BG,
    fontWeight: "700",
    fontSize: 13,
  },

  // Top
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9,11,15,0.45)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },

  // Identity
  identityCard: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
    overflow: "hidden",
  },
  identityTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: "100%",
    height: "100%",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  storeName: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 20,
    letterSpacing: -0.4,
    maxWidth: "78%",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  verifiedText: {
    color: AI_GREEN,
    fontSize: 10,
    fontWeight: "700",
  },
  openLabel: {
    color: MUTED,
    fontSize: 12,
    marginTop: 5,
    letterSpacing: 0.3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 5,
  },
  locationText: {
    color: SECONDARY,
    fontSize: 12.5,
    fontWeight: "500",
    flex: 1,
  },
  desc: {
    color: SECONDARY,
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: 16,
  },
  goalBox: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  goalLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  goalText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 18,
    gap: 10,
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  saveBtnActive: {
    backgroundColor: TEXT,
    borderColor: TEXT,
  },
  saveBtnText: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 14,
  },
  countPill: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.07)",
  },
  countText: {
    color: SECONDARY,
    fontWeight: "600",
    fontSize: 13,
  },

  // Sections
  sectionEyebrow: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 20,
    letterSpacing: -0.3,
  },

  // Featured
  featuredCard: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: SURFACE,
  },
  featuredFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  featuredInfo: {
    position: "absolute",
    bottom: 18,
    left: 18,
    right: 18,
  },
  featuredName: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 23,
  },
  featuredPrice: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 20,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },

  // Grid
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
  },
  dividerText: {
    color: MUTED,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginHorizontal: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  gridInfo: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  gridName: {
    color: TEXT,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
  },
  gridPrice: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 14.5,
    marginTop: 6,
  },
  noImg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyFloor: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyFloorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFloorText: {
    color: SECONDARY,
    textAlign: "center",
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
  },

  footer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 8,
  },
  footerLine: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: LINE,
    marginBottom: 14,
  },
  footerText: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 1,
  },
  seeMore: {
  color: AI_GREEN,
  fontSize: 13,
  fontWeight: "600",
},
});

