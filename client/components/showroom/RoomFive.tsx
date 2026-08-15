/**
 * RoomFive — THE ATELIER
 * Curated Masterpieces / Editorial Gallery Room.
 *
 * Product display structure:
 *   1. Hero display: 3 full-width product rows (using cyclic repetition).
 *   2. Dual display: 5 rows with two products per row (using cyclic repetition).
 *   3. Highlight display: 7 editorial product rows (using cyclic repetition).
 */

import { Product } from "@/constants/types";
import { useMarketplace } from "@/context/MarketplaceContext";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import ScrollFadeUp from "./ScrollFadeUp";
import ShowroomProductCard from "./ShowroomProductCard";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_GAP = 14;
const HERO_ROW_LIMIT = 3;
const DUAL_ROW_LIMIT = 5;
const HIGHLIGHT_ROW_LIMIT = 7;

interface RoomFiveProps {
  products: Product[];
  title?: string;
  subtitle?: string;
}

export default function RoomFive({
  products = [],
  title = "THE ATELIER",
  subtitle = "Curated Masterpieces",
}: RoomFiveProps) {
  const { formatProduct } = useMarketplace();

  // Fallback array if products is empty
const fallbackProducts = [
  {
    _id: "fallback-1",
    name: "Atelier Silk Overcoat",
    price: 1250,
    images: [
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80",
    ],
    brand: "plazore atelier",
  },
  {
    _id: "fallback-2",
    name: "Obsidian Cashmere Knit",
    price: 680,
    images: [
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop&q=80",
    ],
    brand: "plazore atelier",
  },
  {
    _id: "fallback-3",
    name: "Structured Leather Tote",
    price: 920,
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80",
    ],
    brand: "plazore atelier",
  },
  {
    _id: "fallback-4",
    name: "Minimalist Gold Cuff",
    price: 450,
    images: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80",
    ],
    brand: "plazore atelier",
  },
] as unknown as Product[];


  const sourceProducts = products && products.length > 0 ? products : fallbackProducts;

  // Helper for cyclic product retrieval so sections never run out or fail
  const getCyclicProduct = (index: number): Product => {
    const base = sourceProducts[index % sourceProducts.length];
    return {
      ...base,
      _id: `${base._id || 'item'}-cyclic-${index}`,
    };
  };

  // 1. Hero Lead Product Stage — Exactly 3 rows
  const heroProducts = Array.from({ length: HERO_ROW_LIMIT }, (_, i) => getCyclicProduct(i));

  // 2. Side-by-Side Dual Stage — Exactly 5 rows (10 products total)
  const dualRows: Product[][] = [];
  for (let r = 0; r < DUAL_ROW_LIMIT; r++) {
    dualRows.push([
      getCyclicProduct(HERO_ROW_LIMIT + r * 2),
      getCyclicProduct(HERO_ROW_LIMIT + r * 2 + 1),
    ]);
  }

  // 3. Showcase Collector Rows — Exactly 7 rows
  const highlightProducts = Array.from({ length: HIGHLIGHT_ROW_LIMIT }, (_, i) => 
    getCyclicProduct(HERO_ROW_LIMIT + DUAL_ROW_LIMIT * 2 + i)
  );

  return (
    <View style={styles.room}>
      <View style={styles.header}>
        <ScrollFadeUp delay={40} duration={550} distance={14}>
          <Text style={styles.kicker}>{title}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={100} duration={600} distance={16}>
          <Text style={styles.title}>{subtitle}</Text>
        </ScrollFadeUp>
        <ScrollFadeUp delay={150} duration={500} distance={10}>
          <View style={styles.accentLine} />
        </ScrollFadeUp>
      </View>

      {/* 1. Hero Lead Product Stage — 3 rows */}
      {heroProducts.map((product, rowIndex) => (
        <ScrollFadeUp
          key={`atelier-hero-${rowIndex}`}
          delay={200 + rowIndex * 120}
          duration={700}
          distance={28}
          style={styles.heroWrap}
        >
          <Link href={`/product/${product._id.split('-cyclic-')[0]}` as any} asChild>
            <Pressable style={styles.heroCard}>
              <View style={styles.heroImageWrap}>
                {product.images?.[0] ? (
                  <Image
                    source={{ uri: product.images[0] }}
                    style={styles.heroImage}
                    contentFit="cover"
                    transition={400}
                  />
                ) : (
                  <View style={[styles.heroImage, styles.placeholder]} />
                )}
                <View style={styles.heroTag}>
                  <Text style={styles.heroTagText}>
                    {rowIndex === 0 ? "ATELIER EXCLUSIVE" : rowIndex === 1 ? "SIGNATURE EDIT" : "CURATED PICK"}
                  </Text>
                </View>
                <View style={styles.rowMarker}>
                  <Text style={styles.rowMarkerText}>{`0${rowIndex + 1}`}</Text>
                </View>
              </View>

              <View style={styles.heroInfo}>
                <View style={styles.heroMainMeta}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.heroBrand}>
                    {(product.brand || "plazore atelier").toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.heroPrice}>
                  {formatProduct(product.price, product.region)}
                </Text>
              </View>
            </Pressable>
          </Link>
        </ScrollFadeUp>
      ))}

      {/* 2. Side-by-Side Dual Stage — 5 rows */}
      {dualRows.map((row, rowIndex) => (
        <View key={`atelier-dual-row-${rowIndex}`} style={styles.dualRow}>
          {row.map((product, columnIndex) => (
            <ScrollFadeUp
              key={`atelier-dual-${rowIndex}-${columnIndex}`}
              delay={520 + rowIndex * 90 + columnIndex * 45}
              duration={650}
              distance={24}
              style={styles.dualItem}
            >
              <ShowroomProductCard product={product} dark />
            </ScrollFadeUp>
          ))}
        </View>
      ))}

      {/* 3. Showcase Collector Rows — 7 rows */}
      {highlightProducts.map((product, rowIndex) => (
        <ScrollFadeUp
          key={`atelier-highlight-${rowIndex}`}
          delay={900 + rowIndex * 85}
          duration={650}
          distance={20}
          style={styles.highlightWrap}
        >
          <Link href={`/product/${product._id.split('-cyclic-')[0]}` as any} asChild>
            <Pressable style={styles.highlightCard}>
              <View style={styles.highlightThumbWrap}>
                {product.images?.[0] ? (
                  <Image
                    source={{ uri: product.images[0] }}
                    style={styles.highlightThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.highlightThumb, styles.placeholder]} />
                )}
              </View>

              <View style={styles.highlightContent}>
                <Text style={styles.highlightLabel}>
                  {`EDITORIAL FIND 0${rowIndex + 1}`}
                </Text>
                <Text style={styles.highlightName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.highlightPrice}>
                  {formatProduct(product.price, product.region)}
                </Text>
              </View>

              <View style={styles.arrowWrap}>
                <Ionicons name="arrow-forward" size={18} color="#C5A880" />
              </View>
            </Pressable>
          </Link>
        </ScrollFadeUp>
      ))}

      <ScrollFadeUp delay={1100} duration={600} distance={12}>
        <View style={styles.finaleBadge}>
          <View style={styles.finaleLine} />
          <Text style={styles.finaleText}>✦ PLAZORE SHOWROOM COLLECTION ✦</Text>
          <View style={styles.finaleLine} />
        </View>
      </ScrollFadeUp>
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    backgroundColor: "#0D0F14",
    paddingTop: 56,
    paddingBottom: 68,
    width: SCREEN_W,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  kicker: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    letterSpacing: 4,
    textTransform: "uppercase",
    color: "#C5A880",
    marginBottom: 6,
  },
  title: {
    fontFamily: "Manrope_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
    color: "#FFFFFF",
    marginBottom: 14,
  },
  accentLine: {
    height: 1.5,
    width: 48,
    backgroundColor: "#C5A880",
    opacity: 0.8,
  },
  heroWrap: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroCard: {
    backgroundColor: "#13161F",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.22)",
    overflow: "hidden",
  },
  heroImageWrap: {
    width: "100%",
    height: 240,
    position: "relative",
    backgroundColor: "#090A0D",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    backgroundColor: "#1A1D26",
  },
  heroTag: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(13, 15, 20, 0.82)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
  },
  heroTagText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 9.5,
    letterSpacing: 2,
    color: "#C5A880",
    textTransform: "uppercase",
  },
  rowMarker: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,15,20,0.72)",
    borderWidth: 1,
    borderColor: "rgba(197,168,128,0.3)",
  },
  rowMarkerText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 10,
    color: "#C5A880",
    letterSpacing: 1,
  },
  heroInfo: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  heroMainMeta: {
    flex: 1,
    marginRight: 12,
  },
  heroName: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  heroBrand: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#94A3B8",
  },
  heroPrice: {
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
    color: "#C5A880",
  },
  dualRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  dualItem: {
    width: (SCREEN_W - 40 - CARD_GAP) / 2,
  },
  highlightWrap: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  highlightCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    padding: 12,
  },
  highlightThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "#13161F",
    marginRight: 14,
  },
  highlightThumb: {
    width: "100%",
    height: "100%",
  },
  highlightContent: {
    flex: 1,
  },
  highlightLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: "#C5A880",
    marginBottom: 3,
  },
  highlightName: {
    fontFamily: "Manrope_500Medium",
    fontSize: 14,
    color: "#FFFFFF",
    marginBottom: 3,
  },
  highlightPrice: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    color: "#94A3B8",
  },
  arrowWrap: {
    paddingLeft: 12,
  },
  finaleBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 24,
  },
  finaleLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  finaleText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 10,
    letterSpacing: 3.5,
    color: "rgba(255,255,255,0.32)",
    marginHorizontal: 14,
  },
});
