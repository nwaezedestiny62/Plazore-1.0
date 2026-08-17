import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import api from "@/constants/api";
import { useMarketplace } from "@/context/MarketplaceContext";

/* ── Plazore palette ── */
const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "#252A33";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const AI_GREEN = "#10B981";
const AI_BLUE = "#3B82F6";
const DANGER = "#F97066";

type Message = {
  _id: string;
  text: string;
  sender: { _id: string; name?: string; image?: string };
  createdAt: string;
  readBy?: string[];
  status?: "sending" | "sent" | "failed";
  localId?: string;
};

type Conversation = {
  _id: string;
  product?: {
    _id: string;
    name?: string;
    images?: string[];
    price?: number;
    region?: string;
  };
  buyer?: { _id: string; name?: string; image?: string };
  seller?: {
    _id: string;
    name?: string;
    storeName?: string;
    storeLogo?: string;
    image?: string;
  };
  lastMessage?: { text?: string; createdAt?: string };
  updatedAt?: string;
  myRole?: "buyer" | "seller" | null;
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

export default function ChatScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const conversationId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken, isSignedIn } = useAuth();
  const { formatProduct } = useMarketplace();

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* Resolve current user id early so role is never ambiguous */
  const resolveMyUserId = useCallback(async (token: string) => {
    if (myUserId) return myUserId;
    const endpoints = ["/users/me", "/users/profile", "/user/me"];
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });
        const id = res.data?.data?._id || res.data?._id;
        if (id) {
          const sid = String(id);
          if (mountedRef.current) setMyUserId(sid);
          return sid;
        }
      } catch {
        /* try next */
      }
    }
    return null;
  }, [myUserId]);

  /** Derive role strictly from ids — seller must never be treated as chatting with themselves */
  const resolveRole = useCallback(
    (
      conv: any,
      uid: string | null,
    ): "buyer" | "seller" | null => {
      if (!conv) return null;
      const me = String(uid || "");
      const buyerId = String(conv.buyer?._id || conv.buyer || "");
      const sellerId = String(conv.seller?._id || conv.seller || "");

      if (me && buyerId && me === buyerId) return "buyer";
      if (me && sellerId && me === sellerId) return "seller";
      if (conv.myRole === "buyer" || conv.myRole === "seller") return conv.myRole;
      return null;
    },
    [],
  );

  /* Keyboard */
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    };
    const onHide = () => setKeyboardHeight(0);

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const loadChat = useCallback(async () => {
    if (!conversationId) {
      setLoading(false);
      setError("Invalid chat.");
      return;
    }
    if (!isSignedIn) {
      setLoading(false);
      setError("Please sign in to view this chat.");
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      setError(null);
      const token = await getTokenRef.current();
      if (!token) {
        if (mountedRef.current) {
          setError("Please sign in again.");
          setLoading(false);
        }
        return;
      }

      const uid = await resolveMyUserId(token);

      const messagesRes = await api.get(`/chat/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });

      if (messagesRes.data?.success && mountedRef.current) {
        const list: Message[] = (messagesRes.data.data || []).map(
          (m: Message) => ({ ...m, status: "sent" as const }),
        );
        setMessages(list);

        // Infer my id from a message I sent, if profile endpoints failed
        if (!uid) {
          for (const m of list) {
            if (m.sender?._id) {
              // can't know which is me yet without conv meta
              break;
            }
          }
        }
      }

      try {
        const convRes = await api.get("/chat/conversations", {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        if (convRes.data?.success && mountedRef.current) {
          const found =
            (convRes.data.data || []).find(
              (c: any) => c._id === conversationId,
            ) || null;

          if (found) {
            const role = resolveRole(found, uid);
            setConversation({
              ...found,
              myRole: role,
            });
          }
        }
      } catch {
        /* meta optional */
      }

      api
        .patch(
          `/chat/${conversationId}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 },
        )
        .catch(() => {});
    } catch (err: any) {
      console.log("Load chat error:", err?.response?.data || err?.message || err);
      if (mountedRef.current) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not load this chat.";
        if (
          msg === "Network Error" ||
          String(msg).toLowerCase().includes("network")
        ) {
          setError("No internet connection. Check your network and try again.");
        } else if (err?.code === "ECONNABORTED") {
          setError("Request timed out. Try again.");
        } else {
          setError(msg);
        }
      }
    } finally {
      inFlight.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [conversationId, isSignedIn, resolveMyUserId, resolveRole]);

  useEffect(() => {
    setLoading(true);
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isSignedIn]);

  const handleSend = async () => {
    if (!text.trim() || sending || !conversationId) return;

    const messageText = text.trim();
    const localId = `local_${Date.now()}`;
    setText("");
    setSending(true);
    setError(null);

    const optimistic: Message = {
      _id: localId,
      localId,
      text: messageText,
      sender: { _id: myUserId || "me" },
      createdAt: new Date().toISOString(),
      status: "sending",
      readBy: myUserId ? [myUserId] : [],
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() =>
      flatListRef.current?.scrollToEnd({ animated: true }),
    );

    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error("No auth token");

      const res = await api.post(
        `/chat/${conversationId}/messages`,
        { text: messageText },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
      );

      if (res.data?.success && res.data.data) {
        const real: Message = { ...res.data.data, status: "sent" };
        if (real.sender?._id) setMyUserId(String(real.sender._id));
        setMessages((prev) =>
          prev.map((m) => (m.localId === localId ? real : m)),
        );
      } else {
        throw new Error(res.data?.message || "Failed to send");
      }
    } catch (err: any) {
      console.log("Send error:", err?.response?.data || err);
      setMessages((prev) =>
        prev.map((m) =>
          m.localId === localId ? { ...m, status: "failed" } : m,
        ),
      );
      setText(messageText);
      setError(
        err?.message === "Network Error"
          ? "Message not sent. Check your connection."
          : err?.response?.data?.message || "Message failed to send.",
      );
    } finally {
      setSending(false);
    }
  };

  const retryFailed = (localId?: string) => {
    if (!localId) return;
    const failed = messages.find((m) => m.localId === localId);
    if (!failed) return;
    setText(failed.text);
    setMessages((prev) => prev.filter((m) => m.localId !== localId));
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const isMine = useCallback(
    (message: Message) => {
      if (message.status === "sending" || message.status === "failed")
        return true;

      const senderId = String(message.sender?._id || "");
      if (myUserId && senderId) {
        return senderId === String(myUserId);
      }

      // Role-based fallback — never treat seller's own id as "other"
      if (conversation?.myRole === "buyer" && conversation.buyer?._id) {
        return senderId === String(conversation.buyer._id);
      }
      if (conversation?.myRole === "seller" && conversation.seller?._id) {
        return senderId === String(conversation.seller._id);
      }
      return false;
    },
    [myUserId, conversation],
  );

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  /**
   * Always the OTHER participant — never the signed-in user.
   * Seller → sees buyer
   * Buyer  → sees seller / store
   */
  const otherParty = useMemo(() => {
    const role =
      conversation?.myRole ||
      resolveRole(conversation, myUserId);

    if (role === "seller") {
      return {
        name: conversation?.buyer?.name || "Buyer",
        image: conversation?.buyer?.image,
        label: "Buyer",
      };
    }

    if (role === "buyer") {
      return {
        name:
          conversation?.seller?.storeName ||
          conversation?.seller?.name ||
          "Seller",
        image:
          conversation?.seller?.storeLogo || conversation?.seller?.image,
        label: "Seller",
      };
    }

    // Unknown role: still avoid showing "Seller" as a default identity
    // Prefer buyer if we look like the seller id matches me
    if (
      myUserId &&
      conversation?.seller?._id &&
      String(conversation.seller._id) === String(myUserId)
    ) {
      return {
        name: conversation?.buyer?.name || "Buyer",
        image: conversation?.buyer?.image,
        label: "Buyer",
      };
    }

    return {
      name:
        conversation?.seller?.storeName ||
        conversation?.seller?.name ||
        conversation?.buyer?.name ||
        "Chat",
      image:
        conversation?.seller?.storeLogo ||
        conversation?.seller?.image ||
        conversation?.buyer?.image,
      label: "Chat",
    };
  }, [conversation, myUserId, resolveRole]);

  const getTicks = (message: Message) => {
    if (!isMine(message)) return null;
    if (message.status === "sending") {
      return (
        <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.55)" />
      );
    }
    if (message.status === "failed") {
      return <Ionicons name="alert-circle" size={13} color="#FECACA" />;
    }

    const role =
      conversation?.myRole || resolveRole(conversation, myUserId);
    const otherId =
      role === "buyer"
        ? conversation?.seller?._id
        : conversation?.buyer?._id;

    const readByOther =
      !!otherId &&
      Array.isArray(message.readBy) &&
      message.readBy.some((id) => String(id) === String(otherId));

    return (
      <Ionicons
        name="checkmark-done"
        size={14}
        color={readByOther ? AI_GREEN : "rgba(255,255,255,0.45)"}
      />
    );
  };

  if (loading) {
    return <StorePreloader />;
  }

  const product = conversation?.product;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        pointerEvents="none"
        colors={["#0C1520", "rgba(9,11,15,0)"]}
        style={styles.topVeil}
      />

      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* Header — always the other party */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            style={styles.headerBtn}
          >
            <Ionicons name="chevron-back" size={20} color={TEXT} />
          </TouchableOpacity>

          {otherParty.image ? (
            <Image source={{ uri: otherParty.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={18} color={MUTED} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.headerName}>
              {otherParty.name}
            </Text>
            <Text numberOfLines={1} style={styles.headerSub}>
              {otherParty.label === "Buyer"
                ? "Buyer inquiry"
                : otherParty.label === "Seller"
                  ? "Store conversation"
                  : "Secure conversation"}
            </Text>
          </View>
        </View>

        {product ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              product._id && router.push(`/product/${product._id}` as any)
            }
            style={styles.productCard}
          >
            {product.images?.[0] ? (
              <Image
                source={{ uri: product.images[0] }}
                style={styles.productImg}
              />
            ) : (
              <View style={[styles.productImg, styles.productImgFallback]}>
                <Ionicons name="image-outline" size={18} color={MUTED} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text numberOfLines={1} style={styles.productName}>
                {product.name || "Product"}
              </Text>
              <Text style={styles.productPrice}>
                {formatProduct(Number(product.price || 0), product.region)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </TouchableOpacity>
        ) : null}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setLoading(true);
                loadChat();
              }}
              style={{ marginTop: 8, alignItems: "center" }}
            >
              <Text style={styles.errorRetry}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.localId || item._id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={28}
                  color={AI_GREEN}
                />
              </View>
              <Text style={styles.emptyTitle}>Start the conversation</Text>
              <Text style={styles.emptyBody}>
                Ask about condition, shipping, or anything else about this
                piece.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = isMine(item);
            return (
              <Pressable
                onPress={() => {
                  if (item.status === "failed") retryFailed(item.localId);
                }}
                style={[
                  styles.bubbleWrap,
                  mine ? styles.bubbleWrapMine : styles.bubbleWrapOther,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                  ]}
                >
                  <Text style={styles.bubbleText}>{item.text}</Text>
                </View>
                <View
                  style={[
                    styles.metaRow,
                    mine ? { justifyContent: "flex-end" } : null,
                  ]}
                >
                  <Text style={styles.metaTime}>
                    {formatTime(item.createdAt)}
                  </Text>
                  {mine && getTicks(item)}
                  {item.status === "failed" && (
                    <Text style={styles.metaFail}>Tap to retry</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />

        <View
          style={[
            styles.inputBar,
            {
              paddingBottom:
                keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 12),
              marginBottom: keyboardHeight > 0 ? keyboardHeight : 0,
            },
          ]}
        >
          <View
            style={[
              styles.inputShell,
              inputFocused && styles.inputShellFocused,
            ]}
          >
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="Write a message…"
              placeholderTextColor={MUTED}
              multiline
              maxLength={2000}
              onFocus={() => {
                setInputFocused(true);
                requestAnimationFrame(() =>
                  flatListRef.current?.scrollToEnd({ animated: true }),
                );
              }}
              onBlur={() => setInputFocused(false)}
              style={styles.input}
              textAlignVertical="center"
              blurOnSubmit={false}
              returnKeyType="default"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || sending}
              activeOpacity={0.85}
              style={[
                styles.sendBtn,
                text.trim() && !sending
                  ? styles.sendBtnActive
                  : styles.sendBtnIdle,
              ]}
            >
              {sending ? (
                <Ionicons name="hourglass-outline" size={18} color={MUTED} />
              ) : (
                <Ionicons
                  name="send"
                  size={17}
                  color={text.trim() ? BG : MUTED}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topVeil: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
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

  diamondCore: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderLogo: { width: 28, height: 28 },
  loaderText: {
    marginTop: 32,
    color: MUTED,
    fontSize: 13,
    letterSpacing: 0.8,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    gap: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  avatar: { width: 40, height: 40, backgroundColor: SURFACE_2 },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  headerName: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSub: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  productCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  productImg: { width: 48, height: 48, backgroundColor: SURFACE_2 },
  productImgFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  productName: { color: TEXT, fontSize: 13, fontWeight: "600" },
  productPrice: {
    color: AI_GREEN,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },

  errorBox: {
    marginHorizontal: 14,
    marginTop: 10,
    backgroundColor: "rgba(249,112,102,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(249,112,102,0.35)",
    padding: 12,
  },
  errorText: { color: "#FECACA", fontSize: 13, textAlign: "center" },
  errorRetry: { color: AI_BLUE, fontWeight: "600", fontSize: 13 },

  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    flexGrow: 1,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 72,
    paddingHorizontal: 32,
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
    fontSize: 17,
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

  bubbleWrap: { marginBottom: 12, maxWidth: "80%" },
  bubbleWrapMine: { alignSelf: "flex-end" },
  bubbleWrapOther: { alignSelf: "flex-start" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: AI_BLUE },
  bubbleOther: {
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  bubbleText: { color: TEXT, fontSize: 15, lineHeight: 21 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  metaTime: { color: MUTED, fontSize: 10 },
  metaFail: { color: DANGER, fontSize: 10, marginLeft: 4 },

  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    backgroundColor: BG,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
  },
  inputShellFocused: { borderColor: "rgba(16,185,129,0.45)" },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    maxHeight: 120,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    marginRight: 8,
  },
  sendBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: { backgroundColor: AI_GREEN },
  sendBtnIdle: { backgroundColor: SURFACE_2 },
});