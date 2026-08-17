import { Ionicons } from "@expo/vector-icons";
import { useCart } from "@/context/CartContext";
import { useShowroomFlyCart } from "@/components/showroom/ShowroomFlyCart";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ── Plazore Lounge palette (aligned with hub) ── */
const BG = "rgba(8,10,16,0.97)";
const LINE = "rgba(255,255,255,0.08)";
const MUTED = "rgba(245,247,250,0.38)";
const TEXT = "#F5F7FA";
const GREEN = "#00E575";
const WISH = "#F472B6";
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const SPRING = Easing.bezier(0.34, 1.3, 0.64, 1);

type Props = { visibleProgress: number; onMenuPress: () => void };

export default function PlazoreFloatingNav({
  visibleProgress,
  onMenuPress,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const fly = useShowroomFlyCart();

  const cartCtx = useCart() as any;
  const itemCount = cartCtx?.itemCount ?? 0;
  const cartItems = cartCtx?.cart ?? cartCtx?.items ?? [];

  const anim = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const badgePop = useRef(new Animated.Value(1)).current;
  const prev = useRef(itemCount);
  const bagRef = useRef<View>(null);

  const chips = (Array.isArray(cartItems) ? cartItems : []).slice(-3).reverse();

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(1, Math.max(0, visibleProgress)),
      duration: 380,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [visibleProgress]);

  // Soft breathing glow on Lounge
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Cart add feedback
  useEffect(() => {
    if (itemCount > prev.current) {
      bounce.setValue(1);
      pulse.setValue(0);
      badgePop.setValue(0.5);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounce, {
            toValue: 1.18,
            duration: 110,
            easing: Easing.out(Easing.back(1.6)),
            useNativeDriver: true,
          }),
          Animated.timing(bounce, {
            toValue: 1,
            duration: 200,
            easing: EASE,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(badgePop, {
          toValue: 1,
          friction: 4,
          tension: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prev.current = itemCount;
  }, [itemCount]);

  const measureBag = () => {
    bagRef.current?.measureInWindow((x, y, w, h) => {
      fly?.registerTarget?.(x + w / 2, y + h / 2);
    });
  };

  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0, 1],
  });
  const ty = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [56, 0],
  });
  const scaleIn = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.85],
  });
  const pulseOp = pulse.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.35, 0],
  });
  const glowOp = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.38],
  });

  const go = (h: string) => {
    requestAnimationFrame(() => {
      try {
        router.navigate(h as any);
      } catch {}
    });
  };

  const isHome =
    pathname === "/" || pathname?.endsWith("/index") || pathname === "/(tabs)";
  const isSearch = pathname?.includes("search");
  const isWish =
    pathname?.includes("favorites") || pathname?.includes("wishlist");
  const isCart = pathname?.includes("cart");
  const floor = Math.max(insets.bottom, 12);
  const hidden = visibleProgress < 0.08;

  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "box-none"}
      style={[
        styles.wrap,
        {
          paddingBottom: floor,
          opacity,
          transform: [{ translateY: ty }, { scale: scaleIn }],
        },
      ]}
    >
      <View style={styles.shell}>
        {/* Top hairline accent */}
        <LinearGradient
          colors={[
            "transparent",
            "rgba(255,255,255,0.14)",
            "rgba(0,229,117,0.22)",
            "rgba(255,255,255,0.14)",
            "transparent",
          ]}
          locations={[0, 0.2, 0.5, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topLine}
          pointerEvents="none"
        />

        <View style={styles.bar}>
          <Nav
            icon={isHome ? "storefront" : "storefront-outline"}
            label="Mall"
            active={!!isHome}
            onPress={() => go("/(tabs)")}
          />

          <Nav
            icon={isSearch ? "search" : "search-outline"}
            label="Browse"
            active={!!isSearch}
            onPress={() => go("/(tabs)/search")}
          />

          {/* ── Lounge center ── */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Plazore Lounge"
            onPress={onMenuPress}
            style={({ pressed }) => [
              styles.loungeSlot,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.loungeGlow, { opacity: glowOp }]}
            />

            <View style={styles.loungeBtn}>
              <LinearGradient
                colors={["#00E575", "#00C9A0", "#3B82F6"]}
                locations={[0, 0.45, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <LinearGradient
                colors={["rgba(255,255,255,0.32)", "transparent"]}
                style={styles.loungeSheen}
                pointerEvents="none"
              />
              <Ionicons name="grid" size={20} color="#FFFFFF" />
            </View>

            <Text style={styles.loungeLabel}>Lounge</Text>
          </Pressable>

          <Nav
            icon={isWish ? "heart" : "heart-outline"}
            label="Wishlist"
            active={!!isWish}
            color={WISH}
            onPress={() => go("/(tabs)/favorites")}
          />

          {/* ── Cart ── */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cart"
            accessibilityState={{ selected: !!isCart }}
            onPress={() => go("/(tabs)/cart")}
            style={styles.item}
          >
            <View
              ref={bagRef}
              collapsable={false}
              onLayout={measureBag}
              style={styles.cartWrap}
            >
              <Animated.View style={{ transform: [{ scale: bounce }] }}>
                <Ionicons
                  name={
                    isCart || itemCount > 0
                      ? "bag-handle"
                      : "bag-handle-outline"
                  }
                  size={22}
                  color={itemCount > 0 || isCart ? GREEN : MUTED}
                />
              </Animated.View>

              {itemCount > 0 && (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.ring,
                      {
                        opacity: pulseOp,
                        transform: [{ scale: pulseScale }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.badge,
                      { transform: [{ scale: badgePop }] },
                    ]}
                  >
                    <Text style={styles.badgeT}>
                      {itemCount > 99 ? "99+" : itemCount}
                    </Text>
                  </Animated.View>
                </>
              )}

              {chips.length > 0 && (
                <View style={styles.chips}>
                  {chips.map((c: any, i: number) => (
                    <View
                      key={c._id || i}
                      style={[
                        styles.chip,
                        {
                          right: i * 10,
                          zIndex: 3 - i,
                          opacity: 1 - i * 0.18,
                        },
                      ]}
                    >
                      {c.images?.[0] || c.image ? (
                        <Image
                          source={{ uri: c.images?.[0] || c.image }}
                          style={styles.chipImg}
                          contentFit="cover"
                          transition={0}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View
                          style={[
                            styles.chipImg,
                            { backgroundColor: "#161826" },
                          ]}
                        />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Text
              style={[
                styles.label,
                (itemCount > 0 || isCart) && styles.labelActive,
              ]}
            >
              Cart
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function Nav({
  icon,
  label,
  active,
  onPress,
  color = TEXT,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const indicator = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(indicator, {
      toValue: active ? 1 : 0,
      duration: 240,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [active]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 80,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          easing: SPRING,
          useNativeDriver: true,
        }).start()
      }
      hitSlop={12}
      style={styles.item}
    >
      <Animated.View
        style={{
          alignItems: "center",
          transform: [{ scale }],
        }}
      >
        <View style={styles.iconSlot}>
          <Ionicons name={icon} size={21} color={active ? color : MUTED} />
          <Animated.View
            style={[
              styles.dot,
              {
                backgroundColor: color,
                opacity: indicator,
                transform: [
                  {
                    scale: indicator.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.25, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.label,
            active && { color, fontWeight: "700" },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    paddingHorizontal: 14,
  },
  shell: {
    backgroundColor: BG,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
      },
      android: { elevation: 20 },
    }),
  },
  topLine: {
    height: StyleSheet.hairlineWidth * 2,
    width: "100%",
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 11,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingVertical: 2,
    minHeight: 50,
  },
  iconSlot: {
    width: 34,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    bottom: -3,
    width: 3.5,
    height: 3.5,
    borderRadius: 0,
  },
  label: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 0.4,
  },
  labelActive: {
    color: GREEN,
    fontWeight: "700",
  },

  /* ── Lounge ── */
  loungeSlot: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: -16,
    minWidth: 64,
    paddingHorizontal: 2,
  },
  loungeGlow: {
    position: "absolute",
    width: 58,
    height: 58,
    top: -4,
    backgroundColor: "rgba(0,229,117,0.2)",
  },
  loungeBtn: {
    width: 48,
    height: 48,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
      },
      android: { elevation: 12 },
    }),
  },
  loungeSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
  },
  loungeLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: 0.6,
  },

  /* ── Cart ── */
  cartWrap: {
    width: 38,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 0,
    borderWidth: 1.5,
    borderColor: GREEN,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 0,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#080A10",
  },
  badgeT: {
    color: "#041412",
    fontSize: 9,
    fontWeight: "800",
  },
  chips: {
    position: "absolute",
    bottom: -11,
    right: -2,
    height: 14,
    width: 36,
  },
  chip: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    backgroundColor: "#161826",
  },
  chipImg: {
    width: "100%",
    height: "100%",
  },
});