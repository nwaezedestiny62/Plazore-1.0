import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

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

const PRODUCT_REPORT_REASONS = [
  { value: "counterfeit", label: "Counterfeit or suspected fake" },
  { value: "misleading_info", label: "Misleading product information" },
  { value: "photos_mismatch", label: "Photos do not match" },
  { value: "incorrect_specs", label: "Incorrect specifications" },
  { value: "misleading_price", label: "Misleading price" },
  { value: "unavailable", label: "Listed but unavailable" },
  { value: "unsafe_prohibited", label: "Unsafe or prohibited" },
  { value: "ip_concern", label: "IP concern" },
  { value: "suspicious_listing", label: "Suspicious listing" },
  { value: "other_product", label: "Other product issue" },
];

const STORE_REPORT_REASONS = [
  { value: "fraudulent_store", label: "Suspected fraudulent store" },
  { value: "impersonation", label: "Store impersonation" },
  { value: "misleading_business", label: "Misleading business info" },
  { value: "abusive_behaviour", label: "Abusive behaviour" },
  { value: "repeated_misleading", label: "Repeated misleading listings" },
  { value: "prohibited_activity", label: "Prohibited activity" },
  { value: "ip_concern_store", label: "IP concern" },
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "other_store", label: "Other store issue" },
];

function wordCount(text: string) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function ContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    context?: string;
    productId?: string;
    storeId?: string;
    orderId?: string;
  }>();
  const { getToken } = useAuth();
  const { user } = useUser();

  const mode = (params.mode || "contact").toLowerCase();
  const contextType = (params.context || "general").toLowerCase();
  const productId = params.productId || "";
  const storeId = params.storeId || "";
  const orderId = params.orderId || "";

  const isReport = mode === "report";
  const isStoreContext = contextType === "store" || !!storeId;
  const isProductContext = contextType === "product" || !!productId;

  const roleMeta = (user?.publicMetadata?.role as string) || "buyer";
  const canSeller = roleMeta === "seller" || roleMeta === "admin";

  const [contactAs, setContactAs] = useState<"buyer" | "seller">(
    canSeller ? "seller" : "buyer"
  );
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(
    user?.primaryEmailAddress?.emailAddress || ""
  );
  const [country, setCountry] = useState("NG");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const words = useMemo(() => wordCount(message), [message]);
  const reasons = isProductContext ? PRODUCT_REPORT_REASONS : STORE_REPORT_REASONS;
  const options = isReport ? reasons : CONTACT_CATEGORIES;
  const selectedLabel =
    options.find((o) => o.value === (isReport ? reason : category))?.label ||
    "Select…";

  const title = isReport
    ? "Report to Plazore"
    : isStoreContext || isProductContext
      ? "Contact Store through Plazore"
      : "Talk to Plazore";

  const onMessageChange = (val: string) => {
    if (wordCount(val) <= 300) setMessage(val);
  };

  const submit = async () => {
    setError("");
    if (words < 1) return setError("Please write a short message.");
    if (words > 300) return setError("Max 300 words.");
    if (!email.includes("@")) return setError("Valid email required.");
    if (!country || !state || !city)
      return setError("Country, state and city are required.");
    if (isReport && !reason) return setError("Choose a category.");

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");

      if (isReport) {
        const res = await fetch(`${API}/contact/report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
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
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed");
      } else {
        const res = await fetch(`${API}/contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            contactAs,
            contextType: isProductContext
              ? "product"
              : isStoreContext
                ? "store"
                : contextType || "general",
            category,
            message: message.trim(),
            email: email.trim(),
            country: country.trim(),
            state: state.trim(),
            city: city.trim(),
            street: street.trim(),
            productId: productId || undefined,
            storeId: storeId || undefined,
            orderId: orderId || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed");
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-[#090B0F]">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-full border border-[#00E575]/30 bg-[#00E575]/10">
            <Ionicons name="checkmark-circle" size={36} color="#00E575" />
          </View>
          <Text className="text-center text-2xl font-extrabold text-[#F5F7FA]">
            {isReport ? "Report received" : "Message sent"}
          </Text>
          <Text className="mt-3 text-center text-[15px] leading-6 text-[#A7ADB8]">
            {isReport
              ? "We've received your report and will review it."
              : "Plazore has your message. We'll get back to you soon."}
          </Text>
          <Pressable
            onPress={() => router.replace("/notifications")}
            className="mt-8 h-12 w-full items-center justify-center bg-[#00E575]"
          >
            <Text className="text-[15px] font-extrabold text-[#041412]">
              View notifications
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="mt-3 h-12 w-full items-center justify-center border border-white/10 bg-[#11141A]"
          >
            <Text className="text-[15px] font-semibold text-[#F5F7FA]">Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#090B0F]" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="h-14 flex-row items-center border-b border-white/5 px-2">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="chevron-back" size={22} color="#F5F7FA" />
          </Pressable>
          <Image
            source={require("../assets/logo-1.png")}
            style={{ width: 26, height: 26, marginRight: 10 }}
          />
          <View className="flex-1">
            <Text className="text-[15px] font-extrabold text-[#F5F7FA]" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-[11px] text-[#737A86]">
              {isReport ? "Private · structured" : "Calm · no pressure"}
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-1 text-xl font-extrabold text-[#F5F7FA]">
            {isReport ? "What doesn’t feel right?" : "We’re here with you"}
          </Text>
          <Text className="mb-6 text-[14px] leading-5 text-[#A7ADB8]">
            {isReport
              ? "Your report goes into moderation. No one else sees it."
              : "Clear line to the Plazore team. No bots."}
          </Text>

          {!isReport && canSeller && (
            <Field label="Contacting as">
              <View className="flex-row gap-2">
                {(["buyer", "seller"] as const).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setContactAs(r)}
                    className={`h-11 flex-1 items-center justify-center border ${
                      contactAs === r
                        ? "border-[#00E575]/50 bg-[#00E575]/10"
                        : "border-white/10 bg-[#11141A]"
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold capitalize ${
                        contactAs === r ? "text-[#00E575]" : "text-[#A7ADB8]"
                      }`}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          )}

          <Field label={isReport ? "Category" : "What can we help with?"}>
            <Pressable
              onPress={() => setPickerOpen((v) => !v)}
              className="h-12 flex-row items-center justify-between border border-white/10 bg-[#11141A] px-4"
            >
              <Text className="text-[14px] text-[#F5F7FA]">{selectedLabel}</Text>
              <Ionicons
                name={pickerOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color="#737A86"
              />
            </Pressable>
            {pickerOpen && (
              <View className="mt-1 border border-white/10 bg-[#11141A]">
                {options.map((o) => (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      if (isReport) setReason(o.value);
                      else setCategory(o.value);
                      setPickerOpen(false);
                    }}
                    className="border-t border-white/5 px-4 py-3"
                  >
                    <Text className="text-[14px] text-[#F5F7FA]">{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          <Field label={isReport ? "Explain the issue" : "Your message"} hint={`${words}/300`}>
            <TextInput
              value={message}
              onChangeText={onMessageChange}
              multiline
              numberOfLines={6}
              placeholder={
                isReport ? "What happened?" : "Tell us what’s on your mind…"
              }
              placeholderTextColor="#5C6370"
              className="min-h-[140px] border border-white/10 bg-[#11141A] px-4 py-3 text-[14px] leading-5 text-[#F5F7FA]"
              textAlignVertical="top"
            />
          </Field>

          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className="h-12 border border-white/10 bg-[#11141A] px-4 text-[14px] text-[#F5F7FA]"
              placeholderTextColor="#5C6370"
            />
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Country *">
                <TextInput
                  value={country}
                  onChangeText={setCountry}
                  className="h-12 border border-white/10 bg-[#11141A] px-4 text-[14px] text-[#F5F7FA]"
                />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="State *">
                <TextInput
                  value={state}
                  onChangeText={setState}
                  className="h-12 border border-white/10 bg-[#11141A] px-4 text-[14px] text-[#F5F7FA]"
                />
              </Field>
            </View>
          </View>

          <Field label="City *">
            <TextInput
              value={city}
              onChangeText={setCity}
              className="h-12 border border-white/10 bg-[#11141A] px-4 text-[14px] text-[#F5F7FA]"
            />
          </Field>

          <Field label="Street (optional)">
            <TextInput
              value={street}
              onChangeText={setStreet}
              className="h-12 border border-white/10 bg-[#11141A] px-4 text-[14px] text-[#F5F7FA]"
            />
          </Field>

          {!!error && (
            <View className="mb-3 border border-[#ef6262]/30 bg-[#ef6262]/10 px-4 py-3">
              <Text className="text-[13px] text-[#ef6262]">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={submitting}
            className="mt-2 h-13 items-center justify-center bg-[#00E575]"
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator color="#041412" />
            ) : (
              <Text className="text-[15px] font-extrabold text-[#041412]">
                {isReport ? "Submit report" : "Send to Plazore"}
              </Text>
            )}
          </Pressable>

          <Text className="mt-4 text-center text-[12px] text-[#5C6370]">
            We never share your message with other users.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[11px] font-extrabold tracking-[1.5px] text-[#6B7280]">
          {label.toUpperCase()}
        </Text>
        {hint ? (
          <Text className="text-[11px] font-semibold text-[#6B7280]">{hint}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}