import api from "@/constants/api";
import { getRegion, REGION_LIST } from "@/constants/regions";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function SellerSettings() {
  const { getToken } = useAuth();
  const router = useRouter();

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
          setRegion(res.data.data.marketplaceRegion || "NG");
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
    setSaving(true);
    try {
      const token = await getToken();
      await api.patch(
        "/users/me",
        { marketplaceRegion: region },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: "success",
        text1: "Marketplace updated",
        text2: "Currency and pricing will now follow this region",
      });

      router.back();
    } catch {
      Toast.show({ type: "error", text1: "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-[#07111F] items-center justify-center">
        <ActivityIndicator color="#DCEBFF" />
      </View>
    );
  }

  const current = getRegion(region);

  return (
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={["top"]}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Seller Settings</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text className="text-[#7A93A8] text-[12px] font-semibold tracking-widest uppercase mb-3">
          Marketplace
        </Text>

        <View className="bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5 mb-6">
          <Text className="text-[#AFC3D6] text-sm mb-3">Marketplace Region</Text>

          <TouchableOpacity
            onPress={() => setShowRegions(!showRegions)}
            className="bg-[#0F1C2E] border border-[#243B55] rounded-2xl px-4 py-4 flex-row items-center"
          >
            <Text className="text-2xl mr-3">{current.flag}</Text>
            <View className="flex-1">
              <Text className="text-white font-semibold text-[16px]">
                {current.name}
              </Text>
              <Text className="text-[#7A93A8] text-[13px] mt-0.5">
                Currency: {current.currency.symbol} ({current.currency.code})
              </Text>
            </View>
            <Ionicons
              name={showRegions ? "chevron-up" : "chevron-down"}
              size={18}
              color="#7A93A8"
            />
          </TouchableOpacity>

          {showRegions && (
            <View className="mt-3 border border-[#243B55] rounded-2xl overflow-hidden">
              {REGION_LIST.map((r) => (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => {
                    setRegion(r.code);
                    setShowRegions(false);
                  }}
                  className={`px-4 py-3.5 flex-row items-center ${
                    region === r.code ? "bg-[#152636]" : ""
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

          <Text className="text-[#5A7088] text-[12px] mt-4 leading-5">
            Changing your marketplace region updates the currency used across
            your dashboard, product creation, prices and subscription plans.
            Existing product prices are not converted automatically.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          className="bg-[#DCEBFF] rounded-2xl py-4 items-center"
        >
          {saving ? (
            <ActivityIndicator color="#07111F" />
          ) : (
            <Text className="text-[#07111F] font-extrabold text-[16px]">
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}