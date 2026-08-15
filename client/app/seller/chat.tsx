import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import api from "@/constants/api";

const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "#252A33";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const AI_GREEN = "#10B981";
const AI_BLUE = "#3B82F6";

const INACTIVITY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

type Conversation = {
  _id: string;
  product?: {
    _id: string;
    name?: string;
    images?: string[];
    price?: number;
  };
  buyer?: {
    _id: string;
    name?: string;
    image?: string;
  };
  seller?: {
    _id: string;
    name?: string;
    storeName?: string;
    storeLogo?: string;
    image?: string;
  };
  lastMessage?: {
    text?: string;
    createdAt?: string;
  };
  unreadByBuyer?: number;
  unreadBySeller?: number;
  unreadCount?: number;
  myRole?: "buyer" | "seller" | null;
  updatedAt?: string;
  createdAt?: string;
};

function getActivityTime(conv: Conversation): number {
  const raw =
    conv.lastMessage?.createdAt || conv.updatedAt || conv.createdAt || 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isActiveConversation(conv: Conversation): boolean {
  const activity = getActivityTime(conv);
  if (!activity) return false;
  return Date.now() - activity <= INACTIVITY_MS;
}

export default function SellerChat() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  const isFetching = useRef(false);
  const mountedRef = useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveMyUserId = useCallback(async (token: string) => {
    const endpoints = ["/users/me", "/users/profile", "/user/me"];
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const id = res.data?.data?._id || res.data?._id;
        if (id) {
          setMyUserId(String(id));
          return String(id);
        }
      } catch {
        // try next
      }
    }
    return null;
  }, []);

  const fetchConversations = useCallback(
    async (isRefresh = false) => {
      if (!isSignedIn) {
        if (mountedRef.current) {
          setConversations([]);
          setBooted(true);
          setRefreshing(false);
        }
        return;
      }

      if (isFetching.current) return;
      isFetching.current = true;

      try {
        if (mountedRef.current) {
          setError(null);
          if (isRefresh) setRefreshing(true);
        }

        const token = await getTokenRef.current();
        if (!token) {
          if (mountedRef.current) setError("Please sign in again.");
          return;
        }

        // Resolve seller identity so we never show another store's threads
        let uid = myUserId;
        if (!uid) {
          uid = await resolveMyUserId(token);
        }

        const res = await api.get("/chat/conversations", {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });

        if (res.data?.success) {
          const list: Conversation[] = Array.isArray(res.data.data)
            ? res.data.data
            : [];

          const me = String(uid || "");

          // ONLY conversations where THIS user is the seller for that product
          const sellerChats = list
            .filter((conv) => {
              if (conv.myRole === "seller") return true;
              const sellerId = String(
                (conv.seller as any)?._id || conv.seller || "",
              );
              return !!me && sellerId === me;
            })
            .map((conv) => {
              const unread =
                typeof conv.unreadCount === "number" && conv.myRole === "seller"
                  ? conv.unreadCount
                  : conv.unreadBySeller || 0;

              return {
                ...conv,
                myRole: "seller" as const,
                unreadCount: unread,
              };
            })
            // 2 days of no messages → leave the dashboard
            .filter(isActiveConversation);

          if (mountedRef.current) setConversations(sellerChats);
        } else {
          if (mountedRef.current) {
            setConversations([]);
            setError(res.data?.message || "Failed to load chats");
          }
        }
      } catch (err: any) {
        console.log("Seller chat fetch error:", err?.response?.data || err);
        if (mountedRef.current) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Network error. Please try again.";
          if (
            msg === "Network Error" ||
            String(msg).toLowerCase().includes("network")
          ) {
            setError(
              "No internet connection. Check your network and try again.",
            );
          } else {
            setError(msg);
          }
        }
      } finally {
        if (mountedRef.current) {
          setBooted(true);
          setRefreshing(false);
        }
        isFetching.current = false;
      }
    },
    [isSignedIn, myUserId, resolveMyUserId],
  );

  useFocusEffect(
    useCallback(() => {
      fetchConversations(false);
    }, [fetchConversations]),
  );

  const onRefresh = () => fetchConversations(true);

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  const getUnread = (conv: Conversation) =>
    typeof conv.unreadCount === "number"
      ? conv.unreadCount
      : conv.unreadBySeller || 0;

  const getBuyerName = (conv: Conversation) => conv.buyer?.name || "Buyer";

  const sorted = useMemo(() => {
    return [...conversations].sort(
      (a, b) => getActivityTime(b) - getActivityTime(a),
    );
  }, [conversations]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>STOREFRONT</Text>
          <Text style={styles.title}>Buyer messages</Text>
          <Text style={styles.subtitle}>
            Only chats about your products. Threads with no activity for 2 days
            leave this list automatically.
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => fetchConversations(false)}
              activeOpacity={0.85}
              style={styles.errorRetry}
            >
              <Text style={styles.errorRetryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={sorted}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            booted ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={28}
                    color={AI_GREEN}
                  />
                </View>
                <Text style={styles.emptyTitle}>No buyer messages</Text>
                <Text style={styles.emptyBody}>
                  When someone messages you about one of your products, it will
                  appear here — only on this storefront.
                </Text>
              </View>
            ) : (
              <View style={styles.empty} />
            )
          }
          renderItem={({ item }) => {
            const unread = getUnread(item);
            const product = item.product;
            const lastText = item.lastMessage?.text || "No messages yet";
            const time = formatTime(
              item.lastMessage?.createdAt || item.updatedAt || item.createdAt,
            );
            const hasUnread = unread > 0;

            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push(`/chat/${item._id}` as any)}
                style={[styles.card, hasUnread && styles.cardUnread]}
              >
                <View style={styles.thumbWrap}>
                  {product?.images?.[0] ? (
                    <Image
                      source={{ uri: product.images[0] }}
                      style={styles.thumb}
                    />
                  ) : item.buyer?.image ? (
                    <Image
                      source={{ uri: item.buyer.image }}
                      style={styles.thumb}
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={MUTED}
                      />
                    </View>
                  )}
                  {hasUnread ? <View style={styles.unreadDot} /> : null}
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.partyName} numberOfLines={1}>
                      {getBuyerName(item)}
                    </Text>
                    <Text style={styles.time}>{time}</Text>
                  </View>

                  <Text style={styles.productLine} numberOfLines={1}>
                    {product?.name || "Product conversation"}
                  </Text>

                  <View style={styles.rowBottom}>
                    <Text
                      style={[
                        styles.preview,
                        hasUnread && styles.previewUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {lastText}
                    </Text>
                    {hasUnread ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {unread > 99 ? "99+" : unread}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  eyebrow: {
    color: AI_GREEN,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    color: TEXT,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    color: SECONDARY,
    fontSize: 13,
    lineHeight: 19,
  },

  errorBox: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "rgba(249,112,102,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,112,102,0.35)",
    padding: 14,
  },
  errorText: {
    color: "#FECACA",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  errorRetry: {
    marginTop: 10,
    alignItems: "center",
  },
  errorRetryText: {
    color: AI_BLUE,
    fontWeight: "600",
    fontSize: 13,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 120,
    flexGrow: 1,
  },

  empty: {
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: 28,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,185,129,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,185,129,0.25)",
    marginBottom: 18,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: SECONDARY,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 12,
  },
  cardUnread: {
    borderColor: "rgba(16,185,129,0.4)",
  },
  thumbWrap: {
    position: "relative",
  },
  thumb: {
    width: 52,
    height: 52,
    backgroundColor: SURFACE_2,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    backgroundColor: AI_GREEN,
    borderWidth: 2,
    borderColor: SURFACE,
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  partyName: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  time: {
    color: MUTED,
    fontSize: 11,
  },
  productLine: {
    color: MUTED,
    fontSize: 12,
    marginTop: 3,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  preview: {
    flex: 1,
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  previewUnread: {
    color: TEXT,
    fontWeight: "600",
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    backgroundColor: AI_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: BG,
    fontSize: 10,
    fontWeight: "800",
  },
});