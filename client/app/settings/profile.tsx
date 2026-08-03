import api from "@/constants/api";
import { getRegion, REGION_LIST } from "@/constants/regions";
import { useMarketplace } from "@/context/MarketplaceContext";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

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
    return (
      <View className="flex-1 bg-[#070B12] items-center justify-center">
        <ActivityIndicator color="#7EC8FF" size="large" />
      </View>
    );
  }

  const currentRegion = getRegion(region);

  return (
    <SafeAreaView className="flex-1 bg-[#070B12]" edges={["top"]}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Edit Profile</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          {clerkUser?.imageUrl ? (
            <Image
              source={{ uri: clerkUser.imageUrl }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-[#0C1520] items-center justify-center">
              <Ionicons name="person" size={40} color="#5A7088" />
            </View>
          )}
          <Text className="text-[#7A93A8] text-[13px] mt-3 text-center">
            Profile photo is managed by your account provider
          </Text>
        </View>

        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
          Full Name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor="#5A7088"
          className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
        />

        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">Email</Text>
        <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 mb-5">
          <Text className="text-[#7A93A8] text-[16px]">
            {clerkUser?.emailAddresses?.[0]?.emailAddress || "—"}
          </Text>
        </View>

        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
          Phone Number
        </Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 08012345678"
          placeholderTextColor="#5A7088"
          keyboardType="phone-pad"
          className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
        />

        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
          Marketplace Region
        </Text>
        <Text className="text-[#5A7088] text-[12px] mb-2 leading-4">
          Prices and currency across the app follow this country.
        </Text>

        <TouchableOpacity
          onPress={() => setShowRegions((v) => !v)}
          activeOpacity={0.85}
          className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 mb-3 flex-row items-center"
        >
          <Text className="text-2xl mr-3">{currentRegion.flag}</Text>
          <View className="flex-1">
            <Text className="text-white text-[16px] font-medium">
              {currentRegion.name}
            </Text>
            <Text className="text-[#7A93A8] text-[13px] mt-0.5">
              Currency: {currentRegion.currency.symbol} (
              {currentRegion.currency.code})
            </Text>
          </View>
          <Ionicons
            name={showRegions ? "chevron-up" : "chevron-down"}
            size={18}
            color="#7A93A8"
          />
        </TouchableOpacity>

        {showRegions && (
          <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl overflow-hidden mb-5">
            {REGION_LIST.map((r, index) => {
              const selected = region === r.code;
              return (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => handleSelectRegion(r.code)}
                  activeOpacity={0.8}
                  className={`px-4 py-3.5 flex-row items-center ${
                    selected ? "bg-[#13263B]" : ""
                  } ${
                    index < REGION_LIST.length - 1
                      ? "border-b border-[#1A2A3A]"
                      : ""
                  }`}
                >
                  <Text className="text-xl mr-3">{r.flag}</Text>
                  <View className="flex-1">
                    <Text className="text-white text-[15px] font-medium">
                      {r.name}
                    </Text>
                    <Text className="text-[#7A93A8] text-[12px] mt-0.5">
                      {r.currency.symbol} · {r.currency.code}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#7EC8FF"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          className="bg-[#7EC8FF] rounded-2xl py-4 items-center mt-4 mb-6"
        >
          {saving ? (
            <ActivityIndicator color="#071018" />
          ) : (
            <Text className="text-[#071018] font-extrabold text-[16px]">
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}