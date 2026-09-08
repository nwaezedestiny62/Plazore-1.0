import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "@/constants/api";

const BG = "#090B0F";
const SURFACE = "#11141A";
const SURFACE_2 = "#171B22";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#F5F7FA";
const SECONDARY = "#A7ADB8";
const MUTED = "#737A86";
const GREEN = "#00E575";
const AMBER = "#F59E0B";
const DANGER = "#EF6262";
const REPORT = "#F87171";

const CONTACT_CATEGORIES = [
  { value: "buying", label: "Buying on Plazore" },
  { value: "selling", label: "Selling on Plazore" },
  { value: "order_payment", label: "Order or payment enquiry" },
  { value: "delivery", label: "Delivery or fulfilment help" },
  { value: "feedback", label: "Feedback or suggestion" },
  { value: "technical", label: "Technical problem" },
  { value: "account", label: "Account assistance" },
  { value: "other", label: "Something else" },
];

const DELIVERY_ISSUE_CATEGORIES = [
  { value: "order_not_received", label: "Order not received" },
  {
    value: "marked_delivered_not_received",
    label: "Package marked delivered but not received",
  },
  { value: "wrong_product", label: "Wrong product received" },
  { value: "product_damaged", label: "Product damaged" },
  { value: "missing_item", label: "Missing item" },
  { value: "delivery_problem", label: "Delivery problem" },
  {
    value: "seller_marked_incorrectly",
    label: "Seller marked delivered incorrectly",
  },
  { value: "other_order", label: "Other order issue" },
];

const PRODUCT_REPORT_REASONS = [
  { value: "counterfeit", label: "Counterfeit or suspected fake product" },
  { value: "misleading_info", label: "Misleading product information" },
  { value: "photos_mismatch", label: "Product photos do not match" },
  { value: "incorrect_specs", label: "Incorrect specifications" },
  { value: "misleading_price", label: "Incorrect or misleading price" },
  { value: "unavailable", label: "Product unavailable despite being listed" },
  { value: "unsafe_prohibited", label: "Unsafe or prohibited product" },
  { value: "ip_concern", label: "Intellectual property concern" },
  { value: "suspicious_listing", label: "Suspicious listing / activity" },
  { value: "other_product", label: "Other product issue" },
];

const STORE_REPORT_REASONS = [
  { value: "fraudulent_store", label: "Suspected fraudulent store" },
  { value: "impersonation", label: "Store impersonation" },
  { value: "misleading_business", label: "Misleading business information" },
  { value: "abusive_behaviour", label: "Abusive or inappropriate behaviour" },
  { value: "repeated_misleading", label: "Repeated misleading listings" },
  { value: "prohibited_activity", label: "Prohibited business activity" },
  { value: "ip_concern_store", label: "Intellectual property concern" },
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "other_store", label: "Other store issue" },
];

function wordCount(text: string) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function firstParam(v?: string | string[]) {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}

function PlazoreOrb({ size = 110 }: { size?: number }) {
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
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.4,
          borderColor: "transparent",
          borderTopColor: GREEN,
          borderRightColor: "#3B82F6",
          borderLeftColor: GREEN,
          transform: [{ rotate }],
        }}
      />
      <View
        style={{
          width: size * 0.51,
          height: size * 0.51,
          borderRadius: (size * 0.51) / 2,
          backgroundColor: "rgba(0,229,117,0.1)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={require("@/assets/logo-1.png")}
          style={{ width: size * 0.29, height: size * 0.29 }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

export default function ContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    contextType?: string | string[];
    context?: string | string[];
    category?: string | string[];
    subject?: string | string[];
    productId?: string | string[];
    productName?: string | string[];
    storeId?: string | string[];
    storeName?: string | string[];
    orderId?: string | string[];
  }>();

  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const mode = firstParam(params.mode).toLowerCase() || "contact";
  const contextTypeParam = (
    firstParam(params.contextType) ||
    firstParam(params.context) ||
    "general"
  ).toLowerCase();
  const categoryParam = firstParam(params.category).toLowerCase();
  const subjectParam = firstParam(params.subject);
  const productId = firstParam(params.productId);
  const storeId = firstParam(params.storeId);
  const orderId = firstParam(params.orderId);

  const isReport = mode === "report";
  const isOrderContext =
    contextTypeParam === "order" || !!orderId || categoryParam === "delivery";
  const isStoreContext =
    !isOrderContext && (contextTypeParam === "store" || !!storeId);
  const isProductContext =
    !isOrderContext && (contextTypeParam === "product" || !!productId);

  const roleMeta = (user?.publicMetadata?.role as string) || "buyer";
  const canSeller = roleMeta === "seller" || roleMeta === "admin";

  const [contactAs, setContactAs] = useState<"buyer" | "seller">(
    canSeller ? "seller" : "buyer",
  );
  const [category, setCategory] = useState(() => {
    if (isOrderContext) return "delivery";
    if (categoryParam && CONTACT_CATEGORIES.some((c) => c.value === categoryParam))
      return categoryParam;
    return "other";
  });
  const [deliveryIssue, setDeliveryIssue] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(
    user?.primaryEmailAddress?.emailAddress || "",
  );
  const [country, setCountry] = useState("NG");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");

  const [storeName, setStoreName] = useState(firstParam(params.storeName) || "");
  const [productName, setProductName] = useState(
    firstParam(params.productName) || "",
  );
  const [orderLabel, setOrderLabel] = useState(
    subjectParam || (orderId ? `Order ${orderId.slice(-8)}` : ""),
  );

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [hydrating, setHydrating] = useState(true);
  const [picker, setPicker] = useState<"none" | "help" | "issue" | "reason">(
    "none",
  );

  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;

  const words = useMemo(() => wordCount(message), [message]);

  const contextLabel = isReport
    ? isProductContext
      ? "Reporting product"
      : isStoreContext
        ? "Reporting store"
        : "Report to Plazore"
    : isOrderContext
      ? "Delivery / order issue"
      : isStoreContext || isProductContext
        ? "Contact Store through Plazore"
        : "Talk to Plazore";

  const headline = isReport
    ? "Tell us what doesn’t feel right"
    : isOrderContext
      ? "Something wrong with this delivery?"
      : isStoreContext || isProductContext
        ? "Reach the store through Plazore"
        : "We’re here with you";

  const subhead = isReport
    ? "Your report stays private. It goes straight into our moderation workflow."
    : isOrderContext
      ? "This order stays attached to your message. Seller payout remains pending until Plazore resolves the issue."
      : isStoreContext || isProductContext
        ? "Routed through Plazore — not direct seller chat. Calm, structured, no pressure."
        : "No bots. No hard sell. Just a clear line to the Plazore team.";

  const helpOptions = CONTACT_CATEGORIES;
  const issueOptions = DELIVERY_ISSUE_CATEGORIES;
  const reasonOptions = isProductContext
    ? PRODUCT_REPORT_REASONS
    : STORE_REPORT_REASONS;

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [user]);

  useEffect(() => {
    if (isOrderContext) setCategory("delivery");
  }, [isOrderContext]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace({
        pathname: "/(auth)/sign-in" as any,
        params: { redirect_url: "/contact" },
      });
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (productId && !productName) {
          try {
            const res = await api.get(`/products/${productId}`);
            const p = res.data?.data || res.data;
            if (!cancelled) {
              if (p?.name) setProductName(p.name);
              if (p?.seller?.storeName) setStoreName(p.seller.storeName);
            }
          } catch {}
        } else if (storeId && !storeName) {
          try {
            const res = await api.get(`/seller/store/${storeId}`);
            const d = res.data?.data;
            const s = d?.store || d;
            if (!cancelled && (s?.storeName || s?.name)) {
              setStoreName(s.storeName || s.name);
            }
          } catch {
            try {
              const res = await api.get(`/users/${storeId}`);
              const s = res.data?.data || res.data;
              if (!cancelled) setStoreName(s?.storeName || s?.name || "");
            } catch {}
          }
        }

        if (orderId && isSignedIn) {
          try {
            const token = await getTokenRef.current();
            const res = await api.get(`/orders/${orderId}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const o = res.data?.data || res.data;
            if (!cancelled && o?.orderNumber) {
              setOrderLabel(
                subjectParam || `Delivery issue · ${o.orderNumber}`,
              );
              if (o.seller?.storeName) setStoreName(o.seller.storeName);
            }
          } catch {}
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, storeId, orderId, isSignedIn, productName, storeName, subjectParam]);

  useEffect(() => {
    if (hydrating) return;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [hydrating, fade, lift]);

  const onMessageChange = (val: string) => {
    if (wordCount(val) <= 300) setMessage(val);
  };

  const submit = async () => {
    setError("");
    if (words < 1) return setError("Please write a short message.");
    if (words > 300) return setError("Message must be 300 words or fewer.");
    if (!email.includes("@")) return setError("A valid email is required.");
    if (!country.trim() || !state.trim() || !city.trim())
      return setError("Country, state and city are required.");
    if (isReport && !reason) return setError("Please choose a category.");
    if (isOrderContext && !isReport && !deliveryIssue)
      return setError("Please choose what kind of delivery issue this is.");

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Session expired. Please sign in again.");

      if (isReport) {
        const res = await api.post(
          "/contact/report",
          {
            targetType: isProductContext ? "product" : "store",
            productId: productId || undefined,
            storeId: storeId || undefined,
            reason,
            description: message.trim(),
            email: email.trim(),
            country: country.trim(),
            state: state.trim(),
            city: city.trim(),
            street: street.trim(),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.data?.success === false) {
          throw new Error(res.data?.message || "Failed to submit report");
        }
      } else {
        const issueLine =
          isOrderContext && deliveryIssue
            ? DELIVERY_ISSUE_CATEGORIES.find((d) => d.value === deliveryIssue)
                ?.label || deliveryIssue
            : "";
        const composedMessage =
          isOrderContext && issueLine
            ? `[${issueLine}]\n\n${message.trim()}`
            : message.trim();

        const res = await api.post(
          "/contact",
          {
            contactAs: isOrderContext ? "buyer" : contactAs,
            contextType: isOrderContext
              ? "order"
              : isProductContext
                ? "product"
                : isStoreContext
                  ? "store"
                  : contextTypeParam || "general",
            category: isOrderContext ? "delivery" : category,
            subject:
              subjectParam ||
              (isOrderContext && orderLabel ? orderLabel : undefined),
            message: composedMessage,
            email: email.trim(),
            country: country.trim(),
            state: state.trim(),
            city: city.trim(),
            street: street.trim(),
            productId: productId || undefined,
            storeId: storeId || undefined,
            orderId: orderId || undefined,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.data?.success === false) {
          throw new Error(res.data?.message || "Failed to send message");
        }
      }
      setDone(true);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHelp =
    helpOptions.find((o) => o.value === category)?.label || "Select…";
  const selectedIssue =
    issueOptions.find((o) => o.value === deliveryIssue)?.label || "Select…";
  const selectedReason =
    reasonOptions.find((o) => o.value === reason)?.label || "Select…";

  if (!isLoaded || hydrating) {
    return (
      <View style={styles.center}>
        <PlazoreOrb />
      </View>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.doneWrap}>
          <View
            style={[
              styles.doneMark,
              isReport || isOrderContext
                ? { borderColor: "rgba(245,158,11,0.35)", backgroundColor: "rgba(245,158,11,0.1)" }
                : null,
            ]}
          >
            <Ionicons
              name={isReport ? "flag" : "checkmark-circle"}
              size={32}
              color={isReport ? AMBER : GREEN}
            />
          </View>
          <Text style={styles.doneTitle}>
            {isReport
              ? "Report received"
              : isOrderContext
                ? "Issue submitted"
                : "Message sent"}
          </Text>
          <Text style={styles.doneBody}>
            {isReport
              ? "We've received your report and will review it carefully."
              : isOrderContext
                ? "Plazore has your delivery issue. Seller payout stays pending while we review. We'll follow up here and in notifications."
                : "Plazore has your message. We'll get back to you soon."}
          </Text>
          <View style={styles.doneActions}>
  <TouchableOpacity
    onPress={() => router.replace("/notifications" as any)}
    activeOpacity={0.9}
    style={styles.primaryBtn}
  >
    <Text style={styles.primaryBtnText}>View notifications</Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => router.back()}
    activeOpacity={0.88}
    style={styles.ghostBtn}
  >
    <Text style={styles.ghostBtnText}>Go back</Text>
  </TouchableOpacity>
</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT} />
          </TouchableOpacity>
          <Image
            source={require("@/assets/logo-1.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {contextLabel}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isOrderContext
                ? "Order linked · payout held until resolved"
                : isReport
                  ? "Structured · calm · private"
                  : "Calm support · no sales pressure"}
            </Text>
          </View>
        </View>

        <Animated.ScrollView
          style={{ flex: 1, opacity: fade, transform: [{ translateY: lift }] }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {(storeName || productName || orderLabel) ? (
            <View style={styles.chipRow}>
              {!!orderLabel && (
                <View style={styles.chip}>
                  <Ionicons name="receipt-outline" size={13} color={SECONDARY} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {orderLabel}
                  </Text>
                </View>
              )}
              {!!storeName && (
                <View style={styles.chip}>
                  <Ionicons name="storefront-outline" size={13} color={SECONDARY} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {storeName}
                  </Text>
                </View>
              )}
              {!!productName && (
                <View style={styles.chip}>
                  <Ionicons name="cube-outline" size={13} color={SECONDARY} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {productName}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.heroIcon}>
            {isReport || isOrderContext ? (
              <Ionicons name="warning-outline" size={20} color={AMBER} />
            ) : (
              <Ionicons name="chatbubbles-outline" size={20} color={GREEN} />
            )}
          </View>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subhead}>{subhead}</Text>

          {!isReport && !isOrderContext && canSeller ? (
            <Field label="Contacting Plazore as">
              <View style={styles.roleRow}>
                {(["buyer", "seller"] as const).map((r) => {
                  const on = contactAs === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setContactAs(r)}
                      activeOpacity={0.85}
                      style={[styles.roleBtn, on && styles.roleBtnOn]}
                    >
                      <Text style={[styles.roleText, on && styles.roleTextOn]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>
          ) : null}

          {isOrderContext && !isReport ? (
            <Field label="What kind of delivery issue?">
              <SelectButton
                value={selectedIssue}
                placeholder="Select…"
                onPress={() => setPicker("issue")}
              />
            </Field>
          ) : (
            <Field label={isReport ? "What’s the issue?" : "What can we help with?"}>
              <SelectButton
                value={isReport ? selectedReason : selectedHelp}
                placeholder="Select…"
                onPress={() => setPicker(isReport ? "reason" : "help")}
              />
            </Field>
          )}

          <Field
            label={isReport || isOrderContext ? "Explain the issue" : "Your message"}
            hint={`${words} / 300 words`}
          >
            <TextInput
              value={message}
              onChangeText={onMessageChange}
              multiline
              placeholder={
                isReport || isOrderContext
                  ? "What happened? Be as clear as you can…"
                  : "Tell us what’s on your mind…"
              }
              placeholderTextColor="#5C6370"
              style={styles.textarea}
              textAlignVertical="top"
            />
          </Field>

          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@email.com"
              placeholderTextColor="#5C6370"
              style={styles.input}
            />
          </Field>

          <View style={styles.locRow}>
            <View style={{ flex: 1 }}>
              <Field label="Country *">
                <TextInput
                  value={country}
                  onChangeText={setCountry}
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="State *">
                <TextInput
                  value={state}
                  onChangeText={setState}
                  style={styles.input}
                />
              </Field>
            </View>
          </View>

          <Field label="City *">
            <TextInput
              value={city}
              onChangeText={setCity}
              style={styles.input}
            />
          </Field>

          <Field label="Street address (optional)">
            <TextInput
              value={street}
              onChangeText={setStreet}
              style={styles.input}
            />
          </Field>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={DANGER} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.9}
            style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#041412" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isReport
                  ? "Submit report"
                  : isOrderContext
                    ? "Submit delivery issue"
                    : "Send to Plazore"}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.privacy}>
            We never share your message with other users.
          </Text>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker !== "none"}
        title={
          picker === "issue"
            ? "Delivery issue"
            : picker === "reason"
              ? "What’s the issue?"
              : "How can we help?"
        }
        options={
          picker === "issue"
            ? issueOptions
            : picker === "reason"
              ? reasonOptions
              : helpOptions
        }
        selected={
          picker === "issue"
            ? deliveryIssue
            : picker === "reason"
              ? reason
              : category
        }
        tone={picker === "reason" || picker === "issue" ? "warn" : "calm"}
        onClose={() => setPicker("none")}
        onSelect={(v) => {
          if (picker === "issue") setDeliveryIssue(v);
          else if (picker === "reason") setReason(v);
          else setCategory(v);
          setPicker("none");
        }}
      />
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SelectButton({
  value,
  placeholder,
  onPress,
}: {
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  const empty = !value || value === "Select…";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.select}
    >
      <Text style={[styles.selectText, empty && { color: MUTED }]} numberOfLines={1}>
        {empty ? placeholder : value}
      </Text>
      <Ionicons name="chevron-down" size={16} color={MUTED} />
    </TouchableOpacity>
  );
}

function PickerSheet({
  visible,
  title,
  options,
  selected,
  tone,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  tone: "calm" | "warn";
  onClose: () => void;
  onSelect: (v: string) => void;
}) {
  const accent = tone === "warn" ? AMBER : GREEN;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetScrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={MUTED} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {options.map((o) => {
              const on = o.value === selected;
              return (
                <TouchableOpacity
                  key={o.value}
                  onPress={() => onSelect(o.value)}
                  activeOpacity={0.8}
                  style={styles.optionRow}
                >
                  <Text
                    style={[
                      styles.optionText,
                      on && { color: accent, fontWeight: "700" },
                    ]}
                  >
                    {o.label}
                  </Text>
                  {on ? (
                    <Ionicons name="checkmark" size={18} color={accent} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(9,11,15,0.96)",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: { width: 26, height: 26, marginRight: 10 },
  headerTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerSub: { color: MUTED, fontSize: 11, marginTop: 2 },
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48 },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    borderRadius: 999,
  },
  chipText: { color: SECONDARY, fontSize: 12, fontWeight: "600", maxWidth: 220 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  headline: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  subhead: {
    color: SECONDARY,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 26,
    maxWidth: 360,
  },
  fieldHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  fieldHint: { color: "#6B7280", fontSize: 11, fontWeight: "600" },
  roleRow: { flexDirection: "row", gap: 8 },
  roleBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBtnOn: {
    borderColor: "rgba(0,229,117,0.5)",
    backgroundColor: "rgba(0,229,117,0.1)",
  },
  roleText: { color: SECONDARY, fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  roleTextOn: { color: GREEN },
  select: {
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectText: { color: TEXT, fontSize: 14, flex: 1 },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    color: TEXT,
    fontSize: 14,
  },
  textarea: {
    minHeight: 148,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: TEXT,
    fontSize: 14.5,
    lineHeight: 21,
  },
  locRow: { flexDirection: "row", gap: 10 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239,98,98,0.35)",
    backgroundColor: "rgba(239,98,98,0.1)",
  },
  errorText: { color: DANGER, fontSize: 13, flex: 1, lineHeight: 18 },
doneWrap: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 28,
},
  privacy: {
    marginTop: 16,
    textAlign: "center",
    color: "#5C6370",
    fontSize: 12,
  },
doneMark: {
  width: 72,
  height: 72,
  borderRadius: 36,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(0,229,117,0.35)",
  backgroundColor: "rgba(0,229,117,0.1)",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 20,
},
doneTitle: {
  color: TEXT,
  fontSize: 24,
  fontWeight: "800",
  letterSpacing: -0.5,
  textAlign: "center",
},
doneBody: {
  color: SECONDARY,
  fontSize: 15,
  lineHeight: 22,
  textAlign: "center",
  marginTop: 10,
  marginBottom: 28,
  maxWidth: 320,
},
doneActions: {
  width: "100%",
  maxWidth: 340,
  gap: 12,
},
primaryBtn: {
  height: 52,
  borderRadius: 16,
  backgroundColor: GREEN,
  alignItems: "center",
  justifyContent: "center",
},
primaryBtnText: {
  color: "#041412",
  fontSize: 15,
  fontWeight: "800",
  letterSpacing: -0.2,
},
ghostBtn: {
  height: 52,
  borderRadius: 16,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: LINE,
  backgroundColor: SURFACE,
  alignItems: "center",
  justifyContent: "center",
},
ghostBtnText: {
  color: TEXT,
  fontSize: 15,
  fontWeight: "700",
},
  sheetScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    paddingHorizontal: 18,
    paddingBottom: 28,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetTitle: { color: TEXT, fontSize: 17, fontWeight: "800" },
  optionRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
    paddingVertical: 14,
  },
  optionText: { color: TEXT, fontSize: 14.5, flex: 1, lineHeight: 20 },
});