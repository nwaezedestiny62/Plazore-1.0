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

const MUTED = "rgba(242,244,248,0.45)";
const ACTIVE = "#FFFFFF";
const WISH = "#F472B6";
const CART_C = "#00E575";
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
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

  // Smooth entrance
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(1, Math.max(0, visibleProgress)),
      duration: 320,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [visibleProgress]);

  // Soft breathing glow
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Cart feedback
  useEffect(() => {
    if (itemCount > prev.current) {
      bounce.setValue(1);
      pulse.setValue(0);
      badgePop.setValue(0.5);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounce, {
            toValue: 1.22,
            duration: 110,
            easing: Easing.out(Easing.back(1.8)),
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
    inputRange: [0, 0.1, 1],
    outputRange: [0, 0, 1],
  });
  const ty = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [48, 0],
  });
  const scaleIn = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });
  const pulseOp = pulse.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.4, 0],
  });
  const glowOp = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.48],
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
  const floor = Math.max(insets.bottom, 10);
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
      <View style={styles.bar}>
        {/* 1. Mall */}
        <Nav
          icon={isHome ? "storefront" : "storefront-outline"}
          label="Mall"
          active={!!isHome}
          onPress={() => go("/(tabs)")}
        />

        {/* 2. Browse */}
        <Nav
          icon={isSearch ? "search" : "search-outline"}
          label="Browse"
          active={!!isSearch}
          onPress={() => go("/(tabs)/search")}
        />

        {/* 3. Lounge — aligned, sharp, stands out */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Plazore Lounge"
          onPress={onMenuPress}
          style={({ pressed }) => [
            styles.center,
            pressed && { opacity: 0.88 },
          ]}
        >
          <Animated.View style={[styles.glow, { opacity: glowOp }]} />

          <LinearGradient
            colors={["#00E8D8", "#00C4B8", "#3B5BFF", "#5B5FFF"]}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.centerBtn}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.28)", "transparent"]}
              style={styles.sheen}
              pointerEvents="none"
            />
            <Ionicons name="grid" size={22} color="#fff" />
          </LinearGradient>

          <Text style={styles.cl}>Lounge</Text>
        </Pressable>

        {/* 4. Wishlist */}
        <Nav
          icon={isWish ? "heart" : "heart-outline"}
          label="Wishlist"
          active={!!isWish}
          color={WISH}
          onPress={() => go("/(tabs)/favorites")}
        />

        {/* 5. Cart */}
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
                  isCart || itemCount > 0 ? "bag-handle" : "bag-handle-outline"
                }
                size={23}
                color={itemCount > 0 || isCart ? CART_C : MUTED}
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
                  style={[styles.badge, { transform: [{ scale: badgePop }] }]}
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
                        right: i * 11,
                        zIndex: 3 - i,
                        opacity: 1 - i * 0.15,
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
                        style={[styles.chipImg, { backgroundColor: "#1a1a1a" }]}
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
              (itemCount > 0 || isCart) && styles.labelCart,
            ]}
          >
            Cart
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Nav({
  icon,
  label,
  active,
  onPress,
  color = ACTIVE,
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
      duration: 220,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [active]);

  const pressIn = () => {
    Animated.timing(scale, {
      toValue: 0.9,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 180,
      easing: SPRING,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
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
          <Ionicons name={icon} size={22} color={active ? color : MUTED} />
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
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <Text style={[styles.label, active && { color }]}>{label}</Text>
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
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "rgba(8,10,16,0.96)",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: { elevation: 18 },
    }),
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingVertical: 2,
    minHeight: 52,
  },
  iconSlot: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  label: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 0.2,
  },
  labelCart: {
    color: CART_C,
  },

  // ── Lounge ──
  center: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: -18,          // subtle lift so it stands out
    minWidth: 68,
    paddingHorizontal: 4,
  },
  glow: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,212,200,0.18)",
    top: -6,
  },
  centerBtn: {
    width: 52,
    height: 52,
    // no borderRadius — sharp as requested
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#00D4C8",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "48%",
  },
  cl: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    color: ACTIVE,
    letterSpacing: 0.3,
  },

  // ── Cart ──
  cartWrap: {
    width: 40,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: CART_C,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -9,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: CART_C,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#080A10",
  },
  badgeT: {
    color: "#041412",
    fontSize: 9.5,
    fontWeight: "800",
  },
  chips: {
    position: "absolute",
    bottom: -12,
    right: -4,
    height: 16,
    width: 40,
  },
  chip: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
    backgroundColor: "#141414",
  },
  chipImg: {
    width: "100%",
    height: "100%",
  },
});