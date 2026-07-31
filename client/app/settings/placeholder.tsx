import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsPlaceholder() {
  const { title } = useLocalSearchParams<{ title: string }>();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#070B12]" edges={["top"]}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">{title || "Settings"}</Text>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <View className="w-20 h-20 rounded-3xl bg-[#0C1520] border border-[#1A2A3A] items-center justify-center mb-5">
          <Ionicons name="construct-outline" size={36} color="#5A7088" />
        </View>
        <Text className="text-white text-lg font-bold mb-2">Coming Soon</Text>
        <Text className="text-[#7A93A8] text-center text-[14px] leading-6">
          This section is being prepared for the next phase of Plazore.
        </Text>
      </View>
    </SafeAreaView>
  );
}