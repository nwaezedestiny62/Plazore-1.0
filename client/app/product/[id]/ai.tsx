import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/constants/api";
import { PlazoreAIData } from "@/constants/plazoreAI";

export default function PlazoreAIScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<PlazoreAIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchAI = async () => {
      try {
        const res = await api.get(`/ai/product/${id}`);
        if (res.data.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.log("Failed to load Plazore AI");
      } finally {
        setLoading(false);
      }
    };

    fetchAI();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!data || data.status !== "ready") {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-gray-500 text-center text-base leading-6">
          A thoughtful interpretation of this listing isn’t available just yet.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 px-5 py-3 bg-gray-100 rounded-full"
        >
          <Text className="text-gray-700 font-medium">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="pt-14 pb-4 px-5 flex-row items-center border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-gray-900">
          Plazore AI
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary – the first impression */}
        {data.summary ? (
          <Section title="A closer look">
            <Text className="text-gray-700 text-[15px] leading-6">
              {data.summary}
            </Text>
          </Section>
        ) : null}

        {/* Overview */}
        <Section title="Understanding the listing">
          <Text className="text-gray-700 text-[15px] leading-6">
            {data.overview}
          </Text>
        </Section>

        {/* Highlights */}
        <Section title="What stands out">
          {data.highlights.map((item, index) => (
            <Bullet key={index} text={item} />
          ))}
        </Section>

        {/* Best For */}
        <Section title="Often appreciated for">
          {data.bestFor.map((item, index) => (
            <Bullet key={index} text={item} />
          ))}
        </Section>

        {/* Shipping Summary */}
        <Section title="Shipping">
          <Text className="text-gray-700 text-[15px] leading-6">
            {data.shippingSummary}
          </Text>
        </Section>

        {/* Buyer Confidence */}
        <Section title="Buyer confidence">
          <View className="mb-2">
            <Text className="text-base font-medium text-gray-900">
              {data.buyerConfidence.level}
            </Text>
          </View>
          <Text className="text-gray-700 text-[15px] leading-6 mb-3">
            {data.confidenceExplanation}
          </Text>
          {data.buyerConfidence.factors?.length > 0 && (
            <View className="mt-1">
              {data.buyerConfidence.factors.map((factor, index) => (
                <Text key={index} className="text-gray-500 text-sm mb-1">
                  • {factor}
                </Text>
              ))}
            </View>
          )}
        </Section>

        {/* Things to Consider */}
        <Section title="Things worth noting">
          {data.thingsToConsider.map((item, index) => (
            <Bullet key={index} text={item} />
          ))}
        </Section>

        {/* Footer */}
        <View className="mt-10 pt-6 border-t border-gray-100">
          <Text className="text-center text-gray-400 text-sm leading-5">
            This interpretation is based only on the information shared by the
            seller. Plazore AI exists to help you understand — not decide.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- Helper Components ----------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-8">
      <Text className="text-lg font-semibold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View className="flex-row mb-2">
      <Text className="text-gray-400 mr-2">•</Text>
      <Text className="flex-1 text-gray-700 text-[15px] leading-6">{text}</Text>
    </View>
  );
}