import api from "@/constants/api";
import { getRegion, REGION_LIST } from "@/constants/regions";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("NG");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegions, setShowRegions] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        const res = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          const u = res.data.data;
          setName(u.name || "");
          setPhone(u.phone || "");
          setRegion(u.marketplaceRegion || "NG");
        }
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Name is required" });
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      await api.patch(
        "/users/me",
        {
          name: name.trim(),
          phone: phone.trim(),
          marketplaceRegion: region,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      try {
        await clerkUser?.update({
          firstName: name.trim().split(" ")[0],
          lastName: name.trim().split(" ").slice(1).join(" ") || undefined,
        });
      } catch {}

      Toast.show({
        type: "success",
        text1: "Profile updated",
        text2: "Your changes have been saved",
      });

      router.back();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#070B12] items-center justify-center">
        <ActivityIndicator color="#7EC8FF" />
      </View>
    );
  }

  const currentRegion = getRegion(region);

  return (
    <SafeAreaView className="flex-1 bg-[#070B12]" edges={["top"]}>
      <View className="px-5 pt-3 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
            <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Edit Profile</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View className="items-center mb-8">
          <Image
            source={{ uri: clerkUser?.imageUrl }}
            style={{ width: 96, height: 96, borderRadius: 48 }}
          />
          <Text className="text-[#7A93A8] text-[13px] mt-3">
            Profile photo is managed by your account provider
          </Text>
        </View>

        {/* Full Name */}
        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">Full Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor="#5A7088"
          className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
        />

        {/* Email (read-only) */}
        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">Email</Text>
        <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 mb-5">
          <Text className="text-[#7A93A8] text-[16px]">
            {clerkUser?.emailAddresses?.[0]?.emailAddress || "—"}
          </Text>
        </View>

        {/* Phone */}
        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">Phone Number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 08012345678"
          placeholderTextColor="#5A7088"
          keyboardType="phone-pad"
          className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
        />

        {/* Marketplace Region */}
        <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
          Marketplace Region
        </Text>
        <TouchableOpacity
          onPress={() => setShowRegions(!showRegions)}
          className="bg-[#0C1520] border border-[#1A2A3A] rounded-2xl px-4 py-4 mb-3 flex-row items-center"
        >
          <Text className="text-2xl mr-3">{currentRegion.flag}</Text>
          <View className="flex-1">
            <Text className="text-white text-[16px] font-medium">
              {currentRegion.name}
            </Text>
            <Text className="text-[#7A93A8] text-[13px]">
              Currency: {currentRegion.currency.symbol}
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
            {REGION_LIST.map((r) => (
              <TouchableOpacity
                key={r.code}
                onPress={() => {
                  setRegion(r.code);
                  setShowRegions(false);
                }}
                className={`px-4 py-3.5 flex-row items-center ${
                  region === r.code ? "bg-[#13263B]" : ""
                }`}
              >
                <Text className="text-xl mr-3">{r.flag}</Text>
                <Text className="text-white flex-1">{r.name}</Text>
                {region === r.code && (
                  <Ionicons name="checkmark" size={18} color="#7EC8FF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          className="bg-[#7EC8FF] rounded-2xl py-4 items-center mt-4"
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