import api from "@/constants/api";
import { REGION_LIST } from "@/constants/regions";
import { useMarketplace } from "@/context/MarketplaceContext";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export default function SelectRegionScreen() {
  const { getToken } = useAuth();
  const { refreshRegion, setRegionLocal } = useMarketplace();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selected) {
      Toast.show({
        type: "error",
        text1: "Select a country",
        text2: "Please choose your marketplace region",
      });
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      await api.patch(
        "/users/me",
        { marketplaceRegion: selected },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update app currency/region immediately
      setRegionLocal(selected);
      await refreshRegion();

      Toast.show({
        type: "success",
        text1: "Marketplace set",
        text2: "Welcome to Plazore!",
      });

      router.replace("/");
    } catch (error) {
      console.log("Region save error:", error);
      Toast.show({
        type: "error",
        text1: "Something went wrong",
        text2: "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#070B12]">
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-6 mb-10">
          <Text className="text-white text-3xl font-extrabold mb-3">
            Choose your marketplace
          </Text>
          <Text className="text-[#8BA3B8] text-[15px] leading-6">
            This helps us show you products, prices and sellers from your region
            first. You can change it later in Settings.
          </Text>
        </View>

        <View className="gap-3 mb-10">
          {REGION_LIST.map((region) => {
            const isSelected = selected === region.code;
            return (
              <TouchableOpacity
                key={region.code}
                onPress={() => setSelected(region.code)}
                activeOpacity={0.8}
                className={`flex-row items-center p-4 rounded-2xl border ${
                  isSelected
                    ? "bg-[#0F1C2E] border-[#7EC8FF]"
                    : "bg-[#0C1520] border-[#1A2A3A]"
                }`}
              >
                <Text className="text-3xl mr-4">{region.flag}</Text>

                <View className="flex-1">
                  <Text className="text-white font-semibold text-[16px]">
                    {region.name}
                  </Text>
                  <Text className="text-[#7A93A8] text-[13px] mt-0.5">
                    Currency: {region.currency.symbol}
                  </Text>
                </View>

                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    isSelected ? "border-[#7EC8FF]" : "border-[#3A5068]"
                  }`}
                >
                  {isSelected && (
                    <View className="w-3 h-3 rounded-full bg-[#7EC8FF]" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={loading || !selected}
          activeOpacity={0.85}
          className={`py-4 rounded-2xl items-center ${
            selected ? "bg-[#7EC8FF]" : "bg-[#1A2A3A]"
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#071018" />
          ) : (
            <Text
              className={`font-bold text-[16px] ${
                selected ? "text-[#071018]" : "text-[#5A7088]"
              }`}
            >
              Continue to Plazore
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}