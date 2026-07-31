import api from "@/constants/api";
import { REGION_LIST } from "@/constants/regions";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SellerRegister() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [marketplaceRegion, setMarketplaceRegion] = useState("NG");
  const [showRegions, setShowRegions] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPhone = async () => {
      try {
        const token = await getToken();
        const res = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success && res.data.data?.phone) {
          setPhone(res.data.data.phone);
        }
        if (res.data.success && res.data.data?.marketplaceRegion) {
          setMarketplaceRegion(res.data.data.marketplaceRegion);
        }
      } catch (e) {
        console.log(e);
      }
    };
    loadPhone();
  }, []);

  const handleRegister = async () => {
    if (!storeName.trim()) {
      Alert.alert("Required", "Please enter your store name");
      return;
    }
    if (!storeDescription.trim()) {
      Alert.alert("Required", "Please enter a business description");
      return;
    }
    if (!businessGoal.trim()) {
      Alert.alert("Required", "Please enter your business goal");
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      Alert.alert("Required", "Please enter a valid phone number");
      return;
    }
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      Alert.alert("Required", "Please fill in all payout / bank details");
      return;
    }
    if (!marketplaceRegion) {
      Alert.alert("Required", "Please select your marketplace region");
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();

      const res = await api.post(
        "/seller/apply",
        {
          storeName: storeName.trim(),
          storeDescription: storeDescription.trim(),
          businessGoal: businessGoal.trim(),
          phone: phone.trim().replace(/\s+/g, ""),
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          marketplaceRegion,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data.success) {
        await user?.reload();

        Alert.alert(
          "Store Created",
          "Your seller account is now active. Welcome to the Plazore Seller Lounge.",
          [
            {
              text: "Go to Dashboard",
              onPress: () => router.replace("/seller" as any),
            },
          ]
        );
      }
    } catch (error: any) {
      console.log("Full error:", error.response?.data || error.message);
      Alert.alert(
        "Registration Failed",
        error.response?.data?.message || error.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedRegion = REGION_LIST.find((r) => r.code === marketplaceRegion);

  return (
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={["top"]}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="px-5 pt-3 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
            <Ionicons name="arrow-back" size={24} color="#DCEBFF" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Become a Seller</Text>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 50, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={["#152A3F", "#0E1C2C"]}
            className="rounded-[28px] border border-[#243B55] p-6 mb-8"
          >
            <View className="w-16 h-16 rounded-2xl bg-[#1C334D] items-center justify-center mb-4">
              <Ionicons name="storefront" size={32} color="#DCEBFF" />
            </View>
            <Text className="text-white text-2xl font-extrabold">
              Open Your Store
            </Text>
            <Text className="text-[#8EA4B8] mt-2 leading-6 text-[15px]">
              Create your seller profile. You get instant access to the Seller
              Lounge after registration.
            </Text>
          </LinearGradient>

          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Business / Store Name *
          </Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            placeholder="e.g. Midnight Atelier"
            placeholderTextColor="#5A7088"
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
            autoCapitalize="words"
          />

          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Business Description *
          </Text>
          <TextInput
            value={storeDescription}
            onChangeText={setStoreDescription}
            placeholder="Tell buyers what you sell..."
            placeholderTextColor="#5A7088"
            multiline
            numberOfLines={4}
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
            style={{ textAlignVertical: "top", minHeight: 100 }}
          />

          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Business Goal *
          </Text>
          <TextInput
            value={businessGoal}
            onChangeText={setBusinessGoal}
            placeholder="e.g. Reach 100 monthly orders"
            placeholderTextColor="#5A7088"
            multiline
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
            style={{ textAlignVertical: "top", minHeight: 80 }}
          />

          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Phone Number *
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 08012345678"
            placeholderTextColor="#5A7088"
            keyboardType="phone-pad"
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
          />

          {/* Marketplace Region */}
          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Marketplace Region *
          </Text>
          <TouchableOpacity
            onPress={() => setShowRegions(!showRegions)}
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 mb-3 flex-row items-center"
          >
            <Text className="text-2xl mr-3">{selectedRegion?.flag}</Text>
            <View className="flex-1">
              <Text className="text-white text-[16px]">
                {selectedRegion?.name}
              </Text>
              <Text className="text-[#7A93A8] text-[13px]">
                Currency will be {selectedRegion?.currency.symbol}
              </Text>
            </View>
            <Ionicons
              name={showRegions ? "chevron-up" : "chevron-down"}
              size={18}
              color="#7A93A8"
            />
          </TouchableOpacity>

          {showRegions && (
            <View className="bg-[#0B1625] border border-[#1E334A] rounded-2xl overflow-hidden mb-5">
              {REGION_LIST.map((r) => (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => {
                    setMarketplaceRegion(r.code);
                    setShowRegions(false);
                  }}
                  className={`px-4 py-3.5 flex-row items-center ${
                    marketplaceRegion === r.code ? "bg-[#13263B]" : ""
                  }`}
                >
                  <Text className="text-xl mr-3">{r.flag}</Text>
                  <Text className="text-white flex-1">{r.name}</Text>
                  {marketplaceRegion === r.code && (
                    <Ionicons name="checkmark" size={18} color="#7EC8FF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text className="text-white font-bold text-base mb-3 mt-2">
            Payout / Bank Details *
          </Text>

          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Bank Name *
          </Text>
          <TextInput
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g. GTBank"
            placeholderTextColor="#5A7088"
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
          />

          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Account Name *
          </Text>
          <TextInput
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Name on the account"
            placeholderTextColor="#5A7088"
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-5 text-[16px]"
          />

          <Text className="text-[#AFC3D6] text-sm mb-2 font-medium">
            Account Number *
          </Text>
          <TextInput
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="0123456789"
            placeholderTextColor="#5A7088"
            keyboardType="number-pad"
            className="bg-[#0B1625] border border-[#1E334A] rounded-2xl px-4 py-4 text-white mb-8 text-[16px]"
          />

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.9}
            className="bg-[#DCEBFF] rounded-2xl py-4 items-center"
          >
            {loading ? (
              <ActivityIndicator color="#07111F" />
            ) : (
              <Text className="text-[#07111F] font-extrabold text-[16px]">
                Launch My Store
              </Text>
            )}
          </TouchableOpacity>

          <Text className="text-[#6B8299] text-center text-[12px] mt-6 leading-5 px-4">
            By continuing, your store and payout information will be saved to
            your Plazore account. You can update details later from Seller
            Lounge.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}