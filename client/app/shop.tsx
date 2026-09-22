// client/app/shop.tsx
import ProductCard from "@/components/ProductCard";
import PlazoreNavigationHub from "@/components/PlazoreNavigationHub";
import api from "@/constants/api";
import { PRODUCT_CATEGORIES, CATEGORY_LIST } from "@/constants/productCatalog";
import { Product } from "@/constants/types";
import { useMarketplace } from "@/context/MarketplaceContext";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const GREEN = "#00E575";
const AI_GREEN = "#10B981";
const AI_BLUE = "#3B82F6";

const CATEGORY_IMAGES: Record<string, [string, string, string]> = {
  Electronics: [
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&q=80",
    "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80",
  ],
  "Phones & Accessories": [
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80",
    "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&q=80",
    "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&q=80",
  ],
  Computers: [
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80",
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80",
    "https://images.unsplash.com/photo-1525547719571-a2d4ac882e75?w=600&q=80",
  ],
  Fashion: [
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80",
  ],
  "Beauty & Personal Care": [
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80",
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80",
    "https://images.unsplash.com/photo-1571781926291-c77df8097c1f?w=600&q=80",
  ],
  "Home & Living": [
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&q=80",
    "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=600&q=80",
  ],
  Furniture: [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
    "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&q=80",
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80",
  ],
  "Kitchen & Dining": [
    "https://images.unsplash.com/photo-1556911220-bff31c812dce?w=600&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80",
    "https://images.unsplash.com/photo-1585515320310-4726b6f1f3d4?w=600&q=80",
  ],
  Groceries: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80",
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&q=80",
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80",
  ],
  Health: [
    "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80",
  ],
  "Sports & Outdoors": [
    "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=600&q=80",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
    "https://images.unsplash.com/photo-1517649763962-0c623066027b?w=600&q=80",
  ],
  Automotive: [
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80",
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&q=80",
  ],
  Books: [
    "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80",
    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80",
  ],
  "Office Supplies": [
    "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=600&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&q=80",
  ],
  "Toys & Games": [
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&q=80",
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80",
  ],
  "Baby Products": [
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80",
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80",
    "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&q=80",
  ],
  "Pet Supplies": [
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=80",
    "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&q=80",
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&q=80",
  ],
  "Jewelry & Watches": [
    "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80",
    "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80",
    "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80",
  ],
  "Musical Instruments": [
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80",
    "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=600&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  ],
  "Art & Crafts": [
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&q=80",
    "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80",
    "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=600&q=80",
  ],
  "Industrial Equipment": [
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80",
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=80",
    "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=600&q=80",
  ],
  Agriculture: [
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3855?w=600&q=80",
    "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&q=80",
    "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&q=80",
  ],
  "Building Materials": [
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80",
    "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&q=80",
    "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80",
  ],
  Collectibles: [
    "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=600&q=80",
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  ],
  "Luxury Goods": [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80",
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
  ],
  Others: [
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80",
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80",
    "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600&q=80",
  ],
};

type Mode = "categories" | "new" | "trending" | "stores" | "category";
type SortKey =
  | "relevance"
  | "newest"
  | "trending"
  | "price_asc"
  | "price_desc"
  | "name";

type StoreItem = {
  _id: string;
  storeName?: string;
  name?: string;
  storeLogo?: string;
  isSellerVerified?: boolean;
};

function str(v: any): string {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}

/** Same orb loader used on the product page */
function StorePreloader() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

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

function CategoryImage({ category }: { category: string }) {
  const urls = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Others;
  const [idx, setIdx] = useState(0);
  return (
    <ExpoImage
      source={{ uri: urls[idx] }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      transition={220}
      onError={() => {
        if (idx < 2) setIdx((i) => i + 1);
      }}
    />
  );
}

function MenuToggle({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={styles.menuBtn}
    >
      <View style={{ width: 20, gap: 5 }}>
        <View style={styles.menuLine} />
        <View style={[styles.menuLine, { width: "68%" }]} />
        <View style={styles.menuLine} />
      </View>
    </Pressable>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "newest", label: "Newest" },
  { key: "trending", label: "Trending" },
  { key: "price_asc", label: "Price · Low to high" },
  { key: "price_desc", label: "Price · High to low" },
  { key: "name", label: "Name A–Z" },
];

export default function Shop() {
  const { region } = useMarketplace();
  const router = useRouter();
  const raw = useLocalSearchParams();
  const { width: winW } = useWindowDimensions();
  const cardW = (winW - 16 * 2 - 12) / 2;
  const catW = (winW - 16 * 2 - 12) / 2;

  const mode = (str(raw.mode) as Mode) || "categories";
  const selectedCategory = str(raw.category);
  const selectedSub = str(raw.sub);

  const isCategories = mode === "categories" && !selectedCategory;
  const isStores = mode === "stores";

  const [hubOpen, setHubOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Applied filters (only change on Apply)
  const [sort, setSort] = useState<SortKey>(
    mode === "new" ? "newest" : mode === "trending" ? "trending" : "relevance"
  );
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Draft filters inside the sheet
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");
  const [draftStock, setDraftStock] = useState(false);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (minPrice.trim()) n++;
    if (maxPrice.trim()) n++;
    if (inStockOnly) n++;
    return n;
  }, [minPrice, maxPrice, inStockOnly]);

  const load = useCallback(async () => {
    if (isCategories) {
      setLoading(false);
      setProducts([]);
      setStores([]);
      return;
    }

    setLoading(true);
    try {
      if (isStores) {
        const res = await api.get(`/products?limit=120&region=${region || "NG"}`);
        const map = new Map<string, StoreItem>();
        (res.data?.data || []).forEach((p: any) => {
          const s = p.seller;
          if (!s?._id) return;
          const id = String(s._id);
          if (!map.has(id)) {
            map.set(id, {
              _id: id,
              storeName: s.storeName,
              name: s.name,
              storeLogo: s.storeLogo,
              isSellerVerified: s.isSellerVerified,
            });
          }
        });
        setStores(Array.from(map.values()));
        setProducts([]);
      } else {
        const qs = new URLSearchParams();
qs.set("page", "1");
qs.set("limit", "48");
qs.set("region", region || "NG");

// search
if (search.trim()) qs.set("q", search.trim());

// category
if (mode === "category" && selectedCategory) {
  qs.set("category", selectedCategory);
  if (selectedSub) qs.set("subCategory", selectedSub);
}

// sort → API
if (sort === "newest" || mode === "new") qs.set("sort", "newest");
else if (sort === "trending" || mode === "trending") qs.set("sort", "trending");
else if (sort === "price_asc") qs.set("sort", "price_asc");
else if (sort === "price_desc") qs.set("sort", "price_desc");
else if (sort === "name") qs.set("sort", "name");

// filters → API (applied state, not draft)
if (minPrice.trim()) qs.set("minPrice", minPrice.trim());
if (maxPrice.trim()) qs.set("maxPrice", maxPrice.trim());
if (inStockOnly) qs.set("inStock", "true");

const res = await api.get(`/products?${qs.toString()}`);
setProducts(Array.isArray(res.data?.data) ? res.data.data : []);
setStores([]);
      }
    } catch {
      setProducts([]);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [
    mode,
    selectedCategory,
    selectedSub,
    region,
    isCategories,
    isStores,
    search,
    sort,
  ]);

  // Reset local state when route mode/category changes
  useEffect(() => {
    setSearch("");
    setDraftSearch("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setDraftMin("");
    setDraftMax("");
    setDraftStock(false);
    setSort(
      mode === "new" ? "newest" : mode === "trending" ? "trending" : "relevance"
    );
  }, [mode, selectedCategory, selectedSub]);

  // Debounced search → applied search
  useEffect(() => {
    const t = setTimeout(() => setSearch(draftSearch.trim()), 320);
    return () => clearTimeout(t);
  }, [draftSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const displayedProducts = useMemo(() => {
    let list = [...products];
    const q = search.trim().toLowerCase();

    if (q) {
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          String((p as any).category || "").toLowerCase().includes(q)
      );
    }

    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (Number.isFinite(min) && min > 0)
      list = list.filter((p) => Number(p.price) >= min);
    if (Number.isFinite(max) && max > 0)
      list = list.filter((p) => Number(p.price) <= max);
    if (inStockOnly) list = list.filter((p) => Number(p.stock ?? 0) > 0);

    // Client sort fallback (always works even if API ignores sort)
    if (sort === "price_asc")
      list.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price_desc")
      list.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === "name")
      list.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    else if (sort === "newest")
      list.sort(
        (a, b) =>
          new Date((b as any).createdAt || 0).getTime() -
          new Date((a as any).createdAt || 0).getTime()
      );

    return list;
  }, [products, search, minPrice, maxPrice, inStockOnly, sort]);

  const displayedStores = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.toLowerCase();
    return stores.filter(
      (s) =>
        (s.storeName || "").toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q)
    );
  }, [stores, search]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORY_LIST;
    const q = search.toLowerCase();
    return CATEGORY_LIST.filter((c) => c.toLowerCase().includes(q));
  }, [search]);

  const title =
    mode === "new"
      ? "New Arrivals"
      : mode === "trending"
        ? "Trending"
        : mode === "stores"
          ? "Stores"
          : mode === "category" && selectedCategory
            ? selectedSub
              ? `${selectedCategory} · ${selectedSub}`
              : selectedCategory
            : "Categories";

  const openFilters = () => {
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
    setDraftStock(inStockOnly);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setMinPrice(draftMin);
    setMaxPrice(draftMax);
    setInStockOnly(draftStock);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftMin("");
    setDraftMax("");
    setDraftStock(false);
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setFilterOpen(false);
  };

  const header = (
    <View style={styles.header}>
      <MenuToggle onPress={() => setHubOpen(true)} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 40 }} />
    </View>
  );

  const searchBar = (placeholder: string, showTools?: boolean) => (
    <View style={styles.searchRow}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          value={draftSearch}
          onChangeText={setDraftSearch}
          returnKeyType="search"
          onSubmitEditing={() => {
            setSearch(draftSearch.trim());
            Keyboard.dismiss();
          }}
        />
        {draftSearch.length > 0 && (
          <Pressable
            onPress={() => {
              setDraftSearch("");
              setSearch("");
            }}
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={16} color={MUTED} />
          </Pressable>
        )}
      </View>

      {showTools ? (
        <>
          <Pressable onPress={() => setSortOpen(true)} style={styles.toolBtn}>
            <Ionicons name="swap-vertical" size={18} color={TEXT} />
          </Pressable>
          <Pressable
            onPress={openFilters}
            style={[
              styles.toolBtn,
              activeFilterCount > 0 && styles.toolBtnActive,
            ]}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilterCount > 0 ? "#041412" : TEXT}
            />
            {activeFilterCount > 0 && <View style={styles.filterDot} />}
          </Pressable>
        </>
      ) : null}
    </View>
  );

  // ── Categories ─────────────────────────────────────────
  if (isCategories) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        {header}
        {searchBar("Search categories…")}

        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item}
          numColumns={2}
          contentContainerStyle={styles.listPad}
          columnWrapperStyle={{ justifyContent: "space-between" }}
          renderItem={({ item }) => {
            const subCount = PRODUCT_CATEGORIES[item]?.length || 0;
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/shop",
                    params: { mode: "category", category: item },
                  } as any)
                }
                style={[styles.catCard, { width: catW }]}
              >
                <View style={styles.catImageWrap}>
                  <CategoryImage category={item} />
                  <View style={styles.catGradient} />
                  <View style={styles.catOverlay}>
                    <Text style={styles.catName} numberOfLines={2}>
                      {item}
                    </Text>
                    <Text style={styles.catMeta}>
                      {subCount} {subCount === 1 ? "sub-category" : "sub-categories"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="grid-outline" size={28} color={MUTED} />
              <Text style={styles.emptyText}>No categories match</Text>
            </View>
          }
        />

        <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
      </SafeAreaView>
    );
  }

  // ── Stores ─────────────────────────────────────────────
  if (isStores) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        {header}
        {searchBar("Search stores…")}

        {loading ? (
          <StorePreloader />
        ) : (
          <FlatList
            data={displayedStores}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listPad}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/store/${item._id}` as any)}
                style={styles.storeRow}
              >
                <View style={styles.storeLogo}>
                  {item.storeLogo ? (
                    <ExpoImage
                      source={{ uri: item.storeLogo }}
                      style={{ width: 52, height: 52 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="storefront-outline" size={20} color={MUTED} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeName} numberOfLines={1}>
                    {item.storeName || item.name || "Store"}
                  </Text>
                  <Text
                    style={[
                      styles.storeBadge,
                      item.isSellerVerified && { color: GREEN },
                    ]}
                  >
                    {item.isSellerVerified ? "Verified seller" : "Merchant"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="storefront-outline" size={28} color={MUTED} />
                <Text style={styles.emptyText}>
                  {stores.length === 0
                    ? "No stores found"
                    : "No stores match your search"}
                </Text>
              </View>
            }
          />
        )}

        <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
      </SafeAreaView>
    );
  }

  // ── Products ───────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {header}
      {searchBar("Search products…", true)}

      {mode === "category" && selectedCategory ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() =>
              router.setParams({
                mode: "category",
                category: selectedCategory,
                sub: "",
              })
            }
            style={[styles.chip, !selectedSub && styles.chipOn]}
          >
            <Text style={[styles.chipText, !selectedSub && styles.chipTextOn]}>
              All
            </Text>
          </Pressable>
          {(PRODUCT_CATEGORIES[selectedCategory] || []).map((sub) => {
            const on = selectedSub === sub;
            return (
              <Pressable
                key={sub}
                onPress={() =>
                  router.setParams({
                    mode: "category",
                    category: selectedCategory,
                    sub,
                  })
                }
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {sub}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaLeft}>
          {loading ? "Loading…" : `${displayedProducts.length} results`}
        </Text>
        <Pressable onPress={() => setSortOpen(true)} hitSlop={8}>
          <Text style={styles.metaRight}>
            {SORT_OPTIONS.find((s) => s.key === sort)?.label || "Relevance"}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <StorePreloader />
      ) : (
        <FlatList
          data={displayedProducts}
          keyExtractor={(item) => String(item._id)}
          numColumns={2}
          contentContainerStyle={styles.listPad}
          columnWrapperStyle={{ justifyContent: "space-between" }}
          renderItem={({ item }) => (
            <ProductCard product={item} cardWidth={cardW} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={28} color={MUTED} />
              <Text style={styles.emptyText}>
                {products.length === 0
                  ? "No products found"
                  : "No products match your filters"}
              </Text>
              {activeFilterCount > 0 && (
                <Pressable onPress={resetFilters} style={styles.emptyAction}>
                  <Text style={styles.emptyActionText}>Clear filters</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* Sort sheet */}
      <Modal visible={sortOpen} transparent animationType="slide">
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSortOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sort by</Text>
          {SORT_OPTIONS.map((opt) => {
            const on = sort === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setSort(opt.key);
                  setSortOpen(false);
                }}
                style={styles.sheetRow}
              >
                <Text style={[styles.sheetRowText, on && styles.sheetRowOn]}>
                  {opt.label}
                </Text>
                {on ? <Ionicons name="checkmark" size={18} color={GREEN} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {/* Filter sheet — draft → apply */}
      <Modal visible={filterOpen} transparent animationType="slide">
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setFilterOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filters</Text>

          <Text style={styles.filterLabel}>PRICE RANGE</Text>
          <View style={styles.priceRow}>
            <TextInput
              style={styles.priceInput}
              placeholder="Min"
              keyboardType="numeric"
              value={draftMin}
              onChangeText={setDraftMin}
              placeholderTextColor={MUTED}
            />
            <Text style={{ color: MUTED }}>–</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="Max"
              keyboardType="numeric"
              value={draftMax}
              onChangeText={setDraftMax}
              placeholderTextColor={MUTED}
            />
          </View>

          <Pressable
            onPress={() => setDraftStock((v) => !v)}
            style={styles.checkRow}
          >
            <View
              style={[
                styles.checkbox,
                draftStock && styles.checkboxOn,
              ]}
            >
              {draftStock ? (
                <Ionicons name="checkmark" size={14} color="#041412" />
              ) : null}
            </View>
            <Text style={styles.checkLabel}>In stock only</Text>
          </Pressable>

          <View style={styles.sheetActions}>
            <Pressable onPress={resetFilters} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Reset</Text>
            </Pressable>
            <Pressable onPress={applyFilters} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PlazoreNavigationHub visible={hubOpen} onClose={() => setHubOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    backgroundColor: BG,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
  },
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLine: {
    height: 2.2,
    backgroundColor: TEXT,
    borderRadius: 2,
  },

  searchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: TEXT,
  },
  toolBtn: {
    width: 44,
    height: 44,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  filterDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#041412",
  },

  listPad: { paddingHorizontal: 16, paddingBottom: 110 },

  // Categories — full-bleed image + overlay text
  catCard: {
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: SURFACE,
  },
  catImageWrap: {
    width: "100%",
    height: 148,
    position: "relative",
  },
  catGradient: {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: "rgba(9,11,15,0.45)",
},
  catOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
  },
  catName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  catMeta: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    marginTop: 3,
  },

  // Stores
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    padding: 12,
    marginBottom: 10,
  },
  storeLogo: {
    width: 52,
    height: 52,
    backgroundColor: SURFACE_2,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  storeName: { color: TEXT, fontSize: 14, fontWeight: "600" },
  storeBadge: { color: MUTED, fontSize: 11, marginTop: 3, fontWeight: "600" },

  // Chips
  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
  },
  chipOn: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 12, fontWeight: "700", color: TEXT },
  chipTextOn: { color: "#041412" },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  metaLeft: { color: MUTED, fontSize: 12 },
  metaRight: { color: SECONDARY, fontSize: 12, fontWeight: "600" },

  empty: { paddingVertical: 60, alignItems: "center", gap: 10 },
  emptyText: { color: MUTED, fontSize: 13 },
  emptyAction: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: LINE,
  },
  emptyActionText: { color: GREEN, fontWeight: "700", fontSize: 13 },

  // Sheets
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingBottom: 36,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: LINE,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  sheetRowText: { color: TEXT, fontSize: 14, fontWeight: "500" },
  sheetRowOn: { color: GREEN, fontWeight: "700" },

  filterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  priceInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TEXT,
    backgroundColor: SURFACE_2,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  checkLabel: { fontSize: 14, color: TEXT },

  sheetActions: { flexDirection: "row", gap: 10 },
  btnGhost: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { fontWeight: "700", color: SECONDARY },
  btnPrimary: {
    flex: 1,
    height: 48,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { fontWeight: "800", color: "#041412" },

  // Orb loader (same as product page)
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
});