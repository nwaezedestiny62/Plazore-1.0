// client/components/ProductCard.tsx
import { ProductCardProps } from "@/constants/types";
import { useMarketplace } from "@/context/MarketplaceContext";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Link } from "expo-router";
import React, { useMemo } from "react";
import { Text, TouchableOpacity, View, useWindowDimensions } from "react-native";

const BG_CARD = "#11141A";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#F5F7FA";
const MUTED = "#737A86";
const GREEN = "#00E575";

function resolveShipLocation(product: any): string {
  const fl = product?.fulfillmentLocation;
  if (fl) {
    if (fl.displayLabel) return String(fl.displayLabel);
    const parts = [fl.city, fl.state, fl.country].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  const addr = product?.seller?.shippingDefaults?.address;
  if (addr) {
    const parts = [addr.city, addr.state, addr.country].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return product?.brand || product?.subCategory || "";
}

interface Props extends ProductCardProps {
  cardWidth?: number;
}

export default function ProductCard({ product, cardWidth }: Props) {
  const { formatProduct } = useMarketplace();
  const { width: winW } = useWindowDimensions();

  const w = cardWidth ?? (winW - 16 * 2 - 12) / 2;
  const imgH = w * 1.22;

  const location = useMemo(() => resolveShipLocation(product), [product]);
  const price = useMemo(
    () => formatProduct(Number(product.price) || 0, (product as any).region),
    [product, formatProduct]
  );
  const inStock = Number(product.stock ?? 0) > 0;
  const img = product.images?.[0];

  return (
    <Link href={`/product/${product._id}` as any} asChild>
      <TouchableOpacity
        activeOpacity={0.9}
        style={{
          width: w,
          marginBottom: 14,
          backgroundColor: BG_CARD,
          borderWidth: 1,
          borderColor: LINE,
          overflow: "hidden",
        }}
      >
        <View style={{ width: "100%", height: imgH, backgroundColor: "#171B22" }}>
          {img ? (
            <ExpoImage
              source={{ uri: img }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="image-outline" size={28} color="#3A3F4A" />
            </View>
          )}

          {product.isFeatured ? (
            <View
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                backgroundColor: "rgba(0,229,117,0.92)",
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: "#041412",
                  fontSize: 9,
                  fontWeight: "800",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Featured
              </Text>
            </View>
          ) : null}

          {!inStock ? (
            <View
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                backgroundColor: "rgba(239,68,68,0.9)",
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                Sold out
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ padding: 10 }}>
          <Text
            style={{
              color: TEXT,
              fontSize: 13,
              fontWeight: "600",
              lineHeight: 17,
            }}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          <Text
            style={{
              color: GREEN,
              fontSize: 14,
              fontWeight: "700",
              marginTop: 6,
            }}
            numberOfLines={1}
          >
            {price}
          </Text>

          {!!location && (
            <Text
              style={{
                color: MUTED,
                fontSize: 11,
                marginTop: 4,
              }}
              numberOfLines={1}
            >
              {location}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Link>
  );
}