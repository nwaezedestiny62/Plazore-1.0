import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@clerk/clerk-expo";
import api from "@/constants/api";
import PlazoreNavigationHub from "@/components/PlazoreNavigationHub";

const { width } = Dimensions.get("window");
const H_PAD = 20;
const GAP = 14;
const CARD_W = (width - H_PAD * 2 - GAP) / 2;

const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "#252A33";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const AI_GREEN = "#10B981";
const AI_BLUE = "#3B82F6";

type SavedStore = {
  _id: string;
  storeName?: string;
  storeDescription?: string;
  storeLogo?: string;
  storeBanner?: string;
  isSellerVerified?: boolean;
  shippingDefaults?: {
    address?: {
      state?: string;
      country?: string;
    };
  };
};

type SortKey = "newest" | "oldest" | "name_az" | "name_za" | "verified";

const SORT_OPTIONS: { key: SortKey; label: string; hint: string }[] = [
  { key: "newest", label: "Latest saved", hint: "Most recently bookmarked" },
  { key: "oldest", label: "Oldest saved", hint: "First bookmarked" },
  { key: "name_az", label: "Name A → Z", hint: "Alphabetical" },
  { key: "name_za", label: "Name Z → A", hint: "Reverse alpha" },
  { key: "verified", label: "Verified first", hint: "Trusted sellers on top" },
];

function MenuToggle({ onPress }: { onPress?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 90,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }).start()
      }
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel="Open navigation"
      style={styles.menuHit}
    >
      <Animated.View style={[styles.menuLines, { transform: [{ scale }] }]}>
        <View style={[styles.menuLine, { width: 22 }]} />
        <View style={[styles.menuLine, { width: 15 }]} />
        <View style={[styles.menuLine, { width: 22 }]} />
      </Animated.View>
    </Pressable>
  );
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
      <Text style={styles.loaderText}>Gathering your collection…</Text>
    </View>
  );
}

export default function SavedStoresScreen() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();

  // Stabilize Clerk getToken — it changes every render
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [stores, setStores] = useState<SavedStore[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const content = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(18)).current;
  const hasAnimated = useRef(false);
  const inFlight = useRef(false);
  const hasLoadedOnce = useRef(false);

  const fetchSaved = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    // Only block the whole screen on the first load
    if (!hasLoadedOnce.current) {
      setInitialLoading(true);
    }

    try {
      if (!isSignedIn) {
        setStores([]);
        return;
      }

      const token = await getTokenRef.current();
      if (!token) {
        setStores([]);
        return;
      }

      const res = await api.get("/saved-stores", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        setStores(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        setStores([]);
      }
    } catch (e) {
      console.log("Saved stores fetch error:", e);
      setStores([]);
    } finally {
      hasLoadedOnce.current = true;
      setInitialLoading(false);
      inFlight.current = false;
    }
  }, [isSignedIn]); // ← only isSignedIn, never getToken

  useFocusEffect(
    useCallback(() => {
      fetchSaved();
    }, [fetchSaved]),
  );

  // Entrance animation once, after first successful paint
  useEffect(() => {
    if (initialLoading || hasAnimated.current) return;
    hasAnimated.current = true;

    content.setValue(0);
    lift.setValue(18);
    Animated.parallel([
      Animated.timing(content, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [initialLoading]);

  const sorted = useMemo(() => {
    const list = [...stores];
    switch (sortKey) {
      case "oldest":
        return list.reverse();
      case "name_az":
        return list.sort((a, b) =>
          String(a.storeName || "").localeCompare(
            String(b.storeName || ""),
            undefined,
            { sensitivity: "base" },
          ),
        );
      case "name_za":
        return list.sort((a, b) =>
          String(b.storeName || "").localeCompare(
            String(a.storeName || ""),
            undefined,
            { sensitivity: "base" },
          ),
        );
      case "verified":
        return list.sort(
          (a, b) => Number(!!b.isSellerVerified) - Number(!!a.isSellerVerified),
        );
      case "newest":
      default:
        return list;
    }
  }, [stores, sortKey]);

  const handleUnsave = async (storeId: string) => {
    if (!isSignedIn || busyId) return;
    const previous = stores;
    setStores((prev) => prev.filter((s) => s._id !== storeId));
    setBusyId(storeId);

    try {
      const token = await getTokenRef.current();
      if (!token) {
        setStores(previous);
        return;
      }
      const res = await api.post(
        "/saved-stores/toggle",
        { storeId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data?.success && Array.isArray(res.data.data)) {
        setStores(res.data.data);
      }
    } catch (e) {
      console.log("Unsave store error:", e);
      setStores(previous);
    } finally {
      setBusyId(null);
    }
  };

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Latest saved";
  const count = stores.length;

  if (initialLoading) {
    return <StorePreloader />;
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <MenuToggle onPress={() => setHubOpen(true)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Saved Stores</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.count}>
              {count === 0
                ? "Nothing saved yet"
                : `${count} store${count === 1 ? "" : "s"} in your collection`}
            </Text>
            {count > 0 && (
              <TouchableOpacity
                onPress={() => setSortOpen(true)}
                style={styles.sortChip}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-vertical" size={13} color={TEXT} />
                <Text style={styles.sortChipText} numberOfLines={1}>
                  {activeSortLabel}
                </Text>
                <Ionicons name="chevron-down" size={12} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!isSignedIn ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bookmark-outline" size={28} color={AI_GREEN} />
            </View>
            <Text style={styles.emptyTitle}>Sign in to save stores</Text>
            <Text style={styles.emptyBody}>
              Keep the sellers you care about in one place. Your collection stays
              private and ready when you return.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/sign-in" as any)}
              style={styles.emptyCta}
              activeOpacity={0.9}
            >
              <Text style={styles.emptyCtaText}>Sign in</Text>
              <Ionicons name="arrow-forward" size={16} color={BG} />
            </TouchableOpacity>
          </View>
        ) : count === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="storefront-outline" size={28} color={AI_GREEN} />
            </View>
            <Text style={styles.emptyTitle}>No stores saved yet</Text>
            <Text style={styles.emptyBody}>
              When a store stands out, tap Save store. They’ll appear here —
              curated by you, arranged your way.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)" as any)}
              style={styles.emptyCta}
              activeOpacity={0.9}
            >
              <Text style={styles.emptyCtaText}>Explore the mall</Text>
              <Ionicons name="arrow-forward" size={16} color={BG} />
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={{
              opacity: content,
              transform: [{ translateY: lift }],
            }}
          >
            <View style={styles.kickerRow}>
              <View style={styles.kickerLine} />
              <Text style={styles.kicker}>COLLECTION</Text>
              <View style={styles.kickerLine} />
            </View>

            <View style={styles.grid}>
              {sorted.map((store) => {
                const loc = [
                  store.shippingDefaults?.address?.state,
                  store.shippingDefaults?.address?.country,
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <View key={store._id} style={styles.card}>
                    <TouchableOpacity
                      activeOpacity={0.92}
                      onPress={() =>
                        router.push(`/store/${store._id}` as any)
                      }
                    >
                      <View style={styles.banner}>
                        {store.storeBanner ? (
                          <Image
                            source={{ uri: store.storeBanner }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                          />
                        ) : (
                          <LinearGradient
                            colors={["#0F172A", "#090B0F", "#111827"]}
                            style={StyleSheet.absoluteFillObject}
                          />
                        )}
                        <LinearGradient
                          colors={[
                            "transparent",
                            "rgba(9,11,15,0.75)",
                            "rgba(9,11,15,0.95)",
                          ]}
                          style={styles.bannerFade}
                        />
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.logoRow}>
                          <View style={styles.logoWrap}>
                            {store.storeLogo ? (
                              <Image
                                source={{ uri: store.storeLogo }}
                                style={styles.logoImg}
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons
                                name="storefront"
                                size={22}
                                color={MUTED}
                              />
                            )}
                          </View>
                          {store.isSellerVerified ? (
                            <View style={styles.verifiedPill}>
                              <Ionicons
                                name="checkmark-circle"
                                size={11}
                                color={AI_GREEN}
                              />
                              <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.storeName} numberOfLines={2}>
                          {store.storeName || "Store"}
                        </Text>

                        {!!store.storeDescription && (
                          <Text style={styles.desc} numberOfLines={2}>
                            {store.storeDescription}
                          </Text>
                        )}

                        {!!loc && (
                          <View style={styles.locRow}>
                            <Ionicons
                              name="location-outline"
                              size={12}
                              color={MUTED}
                            />
                            <Text style={styles.locText} numberOfLines={1}>
                              {loc}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        onPress={() =>
                          router.push(`/store/${store._id}` as any)
                        }
                        style={styles.enterBtn}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.enterBtnText}>Visit store</Text>
                        <Ionicons name="arrow-forward" size={14} color={BG} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleUnsave(store._id)}
                        disabled={busyId === store._id}
                        style={styles.unsaveBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="bookmark" size={16} color={TEXT} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.footer}>
              <View style={styles.footerLine} />
              <Text style={styles.footerText}>
                Plazore · Your private collection
              </Text>
            </View>
          </Animated.ScrollView>
        )}
      </SafeAreaView>

      <PlazoreNavigationHub
        visible={hubOpen}
        onClose={() => setHubOpen(false)}
      />

      <Modal
        visible={sortOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setSortOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Arrange collection</Text>
          <Text style={styles.sheetSub}>
            Order stores the way you prefer to browse
          </Text>

          {SORT_OPTIONS.map((opt) => {
            const active = opt.key === sortKey;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSortKey(opt.key);
                  setSortOpen(false);
                }}
                style={[styles.sortRow, active && styles.sortRowActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.sortLabel,
                      active && styles.sortLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.sortHint}>{opt.hint}</Text>
                </View>
                {active ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color={BG} />
                  </View>
                ) : (
                  <View style={styles.checkEmpty} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Menu toggle (home-style)
  menuHit: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLines: {
    width: 22,
    gap: 5.5,
    alignItems: "flex-start",
  },
  menuLine: {
    height: 2.6,
    backgroundColor: TEXT,
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
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  orbLogo: {
    width: 32,
    height: 32,
  },
  loaderText: {
    marginTop: 28,
    color: MUTED,
    fontSize: 13,
    letterSpacing: 0.8,
  },

  // Header
  header: {
    paddingHorizontal: H_PAD,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: TEXT,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 12,
  },
  count: {
    flex: 1,
    color: SECONDARY,
    fontSize: 13,
    fontWeight: "500",
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    maxWidth: "52%",
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT,
    flexShrink: 1,
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,185,129,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.25)",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: SECONDARY,
    textAlign: "center",
    marginBottom: 28,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TEXT,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  emptyCtaText: {
    color: BG,
    fontSize: 14,
    fontWeight: "700",
  },

  // Grid
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 48,
    paddingTop: 18,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  kickerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: MUTED,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  // Card
  card: {
    width: CARD_W,
    marginBottom: 18,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  banner: {
    height: CARD_W * 0.62,
    backgroundColor: SURFACE_2,
  },
  bannerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  logoWrap: {
    width: 40,
    height: 40,
    backgroundColor: SURFACE_2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: {
    width: "100%",
    height: "100%",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  verifiedText: {
    color: AI_GREEN,
    fontSize: 9,
    fontWeight: "700",
  },
  storeName: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  desc: {
    color: SECONDARY,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  locText: {
    color: MUTED,
    fontSize: 11,
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  enterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: TEXT,
  },
  enterBtnText: {
    color: BG,
    fontWeight: "700",
    fontSize: 12,
  },
  unsaveBtn: {
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: LINE,
    backgroundColor: SURFACE_2,
  },

  footer: {
    alignItems: "center",
    marginTop: 28,
    marginBottom: 8,
  },
  footerLine: {
    width: 36,
    height: 3,
    backgroundColor: LINE,
    marginBottom: 14,
  },
  footerText: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 1,
  },

  // Sheet
  sheetScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 3,
    backgroundColor: LINE,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 13,
    color: SECONDARY,
    marginTop: 4,
    marginBottom: 18,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 12,
  },
  sortRowActive: {
    backgroundColor: SURFACE,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  sortLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT,
  },
  sortLabelActive: {
    color: AI_GREEN,
  },
  sortHint: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  check: {
    width: 22,
    height: 22,
    backgroundColor: AI_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  checkEmpty: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: LINE,
  },
});