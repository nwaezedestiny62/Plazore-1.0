import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SETTINGS_SECTIONS = [
  {
    title: "Account",
    items: [
      { id: "profile", title: "Profile", icon: "person-outline", route: "/settings/profile" },
      { id: "region", title: "Marketplace Region", icon: "globe-outline", route: "/settings/profile" },
      { id: "addresses", title: "Addresses", icon: "location-outline", route: "/settings/placeholder?title=Addresses" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { id: "notifications", title: "Notifications", icon: "notifications-outline", route: "/settings/placeholder?title=Notifications" },
      { id: "music", title: "Ambient Music", icon: "musical-notes-outline", route: "/settings/placeholder?title=Ambient%20Music" },
      { id: "language", title: "Language & Region", icon: "language-outline", route: "/settings/placeholder?title=Language%20%26%20Region" },
      { id: "appearance", title: "Appearance", icon: "color-palette-outline", route: "/settings/placeholder?title=Appearance" },
    ],
  },
  {
    title: "Security",
    items: [
      { id: "security", title: "Security", icon: "shield-checkmark-outline", route: "/settings/placeholder?title=Security" },
    ],
  },
  {
    title: "Support",
    items: [
      { id: "help", title: "Help & Support", icon: "help-circle-outline", route: "/settings/placeholder?title=Help%20%26%20Support" },
      { id: "about", title: "About Plazore", icon: "information-circle-outline", route: "/settings/placeholder?title=About%20Plazore" },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#070B12]" edges={["top"]}>
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Settings</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {SETTINGS_SECTIONS.map((section) => (
          <View key={section.title} className="mb-7">
            <Text className="text-[#7A93A8] text-[12px] font-semibold tracking-widest uppercase mb-3">
              {section.title}
            </Text>
            <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] overflow-hidden">
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => router.push(item.route as any)}
                  className={`px-5 py-4 flex-row items-center ${
                    index !== section.items.length - 1 ? "border-b border-[#152030]" : ""
                  }`}
                >
                  <View className="w-10 h-10 rounded-xl bg-[#13263B] items-center justify-center">
                    <Ionicons name={item.icon as any} size={20} color="#DCEBFF" />
                  </View>
                  <Text className="text-white font-medium text-[15px] ml-4 flex-1">
                    {item.title}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#5A7088" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}