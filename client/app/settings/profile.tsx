import api from "@/constants/api";
import { getRegion, REGION_LIST } from "@/constants/regions";
import { useMarketplace } from "@/context/MarketplaceContext";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const GREEN = "#00E575";
const BLUE = "#3B82F6";
const BG = "#090B0F";
const CARD = "#11151C";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#FFFFFF";
const TEXT_DIM = "rgba(255,255,255,0.55)";
const TEXT_MUTED = "rgba(255,255,255,0.38)";

/** Plazore orb preloader – same style as product / auth screens */
function PlazoreOrbPreloader() {
  const pulse = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.65,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.preloaderWrap}>
      <StatusBar hidden translucent backgroundColor="transparent" />
      <Animated.View style={{ opacity: pulse, transform: [{ scale: pulse }] }}>
        <Image
          source={require("@/assets/logo-1.png")}
          style={styles.preloaderLogo}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={styles.preloaderLabel}>Loading profile…</Text>
    </View>
  );
}

export default function EditProfileScreen() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const { region: appRegion, setRegionLocal } = useMarketplace();
  const router = useRouter();

  const clerkName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.fullName ||
    "";

  const [name, setName] = useState(clerkName);
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState(appRegion || "NG");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  const regionTouched = useRef(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (loadedOnce.current) return;
    loadedOnce.current = true;

    const load = async () => {
      try {
        if (!isSignedIn) {
          setLoading(false);
          return;
        }
        const token = await getToken();
        if (!token) {
          setLoading(false);
          return;
        }
        const res = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) {
          const u = res.data.data;
          setName(u.name || clerkName || "");
          setPhone(u.phone || "");
          if (!regionTouched.current) {
            setRegion(u.marketplaceRegion || appRegion || "NG");
          }
        }
      } catch {
        if (!name && clerkName) setName(clerkName);
        if (!regionTouched.current && appRegion) setRegion(appRegion);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoaded, isSignedIn]);

  const handleSelectRegion = (code: string) => {
    regionTouched.current = true;
    setRegion(code);
    setShowRegions(false);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Toast.show({
        type: "error",
        text1: "Name is required",
        text2: "Enter your name before saving",
      });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        Toast.show({
          type: "error",
          text1: "Not signed in",
          text2: "Sign out and sign in again",
        });
        setSaving(false);
        return;
      }
      const res = await api.patch(
        "/users/me",
        {
          name: trimmedName,
          phone: phone.trim(),
          marketplaceRegion: region,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Save failed");
      }
      const savedRegion = res.data.data?.marketplaceRegion || region;
      setRegionLocal(savedRegion);
      setRegion(savedRegion);
      regionTouched.current = false;
      try {
        const parts = trimmedName.split(" ");
        await clerkUser?.update({
          firstName: parts[0],
          lastName: parts.slice(1).join(" ") || undefined,
        });
      } catch {
        // optional
      }
      const chosen = getRegion(savedRegion);
      Toast.show({
        type: "success",
        text1: "Profile updated",
        text2: `Marketplace: ${chosen.name} (${chosen.currency.symbol})`,
      });
      router.back();
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401) {
        Toast.show({
          type: "error",
          text1: "Session expired",
          text2: "Please sign out and sign in again",
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Failed to save",
          text2:
            e?.response?.data?.message ||
            e?.message ||
            "Check your connection and try again",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PlazoreOrbPreloader />;
  }

  const currentRegion = getRegion(region);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarRing}>
            {clerkUser?.imageUrl ? (
              <Image
                source={{ uri: clerkUser.imageUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={42} color={TEXT_MUTED} />
              </View>
            )}
          </View>
          <Text style={styles.avatarHint}>
            Profile photo is managed by your account provider
          </Text>
        </View>

        {/* Full Name */}
        <Text style={styles.label}>Full Name</Text>
        <View
          style={[
            styles.field,
            nameFocused && styles.fieldFocused,
          ]}
        >
          <Ionicons
            name="person-outline"
            size={18}
            color={nameFocused ? GREEN : TEXT_MUTED}
            style={styles.fieldIcon}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={TEXT_MUTED}
            style={styles.input}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Email (read-only) */}
        <Text style={styles.label}>Email</Text>
        <View style={[styles.field, styles.fieldReadonly]}>
          <Ionicons
            name="mail-outline"
            size={18}
            color={TEXT_MUTED}
            style={styles.fieldIcon}
          />
          <Text style={styles.readonlyText} numberOfLines={1}>
            {clerkUser?.emailAddresses?.[0]?.emailAddress || "—"}
          </Text>
        </View>

        {/* Phone */}
        <Text style={styles.label}>Phone Number</Text>
        <View
          style={[
            styles.field,
            phoneFocused && styles.fieldFocused,
          ]}
        >
          <Ionicons
            name="call-outline"
            size={18}
            color={phoneFocused ? GREEN : TEXT_MUTED}
            style={styles.fieldIcon}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 08012345678"
            placeholderTextColor={TEXT_MUTED}
            keyboardType="phone-pad"
            style={styles.input}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
          />
        </View>

        {/* Marketplace Region */}
        <Text style={styles.label}>Marketplace Region</Text>
        <Text style={styles.helper}>
          Prices and currency across the app follow this country.
        </Text>

        <Pressable
          onPress={() => setShowRegions((v) => !v)}
          style={({ pressed }) => [
            styles.regionBtn,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.regionFlag}>{currentRegion.flag}</Text>
          <View style={styles.regionInfo}>
            <Text style={styles.regionName}>{currentRegion.name}</Text>
            <Text style={styles.regionCurrency}>
              Currency: {currentRegion.currency.symbol} ({currentRegion.currency.code})
            </Text>
          </View>
          <Ionicons
            name={showRegions ? "chevron-up" : "chevron-down"}
            size={18}
            color={TEXT_DIM}
          />
        </Pressable>

        {showRegions && (
          <View style={styles.regionList}>
            {REGION_LIST.map((r, index) => {
              const selected = region === r.code;
              return (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => handleSelectRegion(r.code)}
                  activeOpacity={0.75}
                  style={[
                    styles.regionItem,
                    selected && styles.regionItemSelected,
                    index < REGION_LIST.length - 1 && styles.regionItemBorder,
                  ]}
                >
                  <Text style={styles.regionItemFlag}>{r.flag}</Text>
                  <View style={styles.regionItemInfo}>
                    <Text style={styles.regionItemName}>{r.name}</Text>
                    <Text style={styles.regionItemCurrency}>
                      {r.currency.symbol} · {r.currency.code}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={GREEN} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
          style={styles.saveOuter}
        >
          <LinearGradient
            colors={[GREEN, "#14B8A6", BLUE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            {saving ? (
              <Animated.View>
                <Text style={styles.saveText}>Saving…</Text>
              </Animated.View>
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Preloader
  preloaderWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  preloaderLogo: {
    width: 96,
    height: 96,
    marginBottom: 20,
  },
  preloaderLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    letterSpacing: 0.3,
    fontWeight: "500",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  // Avatar
  avatarSection: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: "rgba(0,229,117,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,229,117,0.06)",
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: {
    marginTop: 14,
    color: TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 24,
  },

  // Form
  label: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  helper: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    marginTop: -2,
  },

  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 56,
    marginBottom: 18,
  },
  fieldFocused: {
    borderColor: GREEN,
    backgroundColor: "rgba(0,229,117,0.05)",
  },
  fieldReadonly: {
    opacity: 0.75,
  },
  fieldIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    paddingVertical: 0,
  },
  readonlyText: {
    flex: 1,
    color: TEXT_DIM,
    fontSize: 16,
  },

  // Region
  regionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  regionFlag: {
    fontSize: 26,
    marginRight: 14,
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "600",
  },
  regionCurrency: {
    color: TEXT_DIM,
    fontSize: 13,
    marginTop: 2,
  },

  regionList: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  regionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  regionItemSelected: {
    backgroundColor: "rgba(0,229,117,0.08)",
  },
  regionItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  regionItemFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  regionItemInfo: {
    flex: 1,
  },
  regionItemName: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "500",
  },
  regionItemCurrency: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 1,
  },

  // Save
  saveOuter: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  saveBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#041412",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});