import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PlazoreAIData } from "@/constants/plazoreAI";

interface Props {
  productId: string;
  data: PlazoreAIData | null;
  loading?: boolean;
}

export default function PlazoreAICard({ productId, data, loading }: Props) {
  const router = useRouter();

  if (loading) {
    return (
      <View className="mt-6 bg-white rounded-2xl p-5 border border-gray-100">
        <View className="flex-row items-center mb-3">
          <Text className="text-lg font-semibold text-gray-900">
            🤖 Plazore AI
          </Text>
        </View>
        <ActivityIndicator size="small" color="#6B7280" />
      </View>
    );
  }

  // No AI yet or failed
  if (!data || data.status === "failed") {
    return null; // Quiet fallback – do not show anything
  }

  // Still generating
  if (data.status === "pending") {
    return (
      <View className="mt-6 bg-white rounded-2xl p-5 border border-gray-100">
        <View className="flex-row items-center mb-2">
          <Text className="text-lg font-semibold text-gray-900">
            🤖 Plazore AI
          </Text>
        </View>
        <Text className="text-gray-500 text-sm">
          Preparing product interpretation…
        </Text>
      </View>
    );
  }

  // Ready
  return (
    <View className="mt-6 bg-white rounded-2xl p-5 border border-gray-100">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Text className="text-lg font-semibold text-gray-900">
          🤖 Plazore AI
        </Text>
      </View>

      {/* Quick Insights */}
      <Text className="text-gray-700 text-[15px] leading-6 mb-4">
        {data.summary}
      </Text>

      {/* See More */}
      <TouchableOpacity
        onPress={() => router.push(`/product/${productId}/ai`)}
        className="flex-row items-center"
        activeOpacity={0.7}
      >
        <Text className="text-primary font-medium text-[15px] mr-1">
          See More
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#2563EB" />
      </TouchableOpacity>
    </View>
  );
}