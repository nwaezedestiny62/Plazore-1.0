import { useClerk, useUser } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React from 'react'
import {
  Image,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'

const LOUNGE_MENU = [
  {
    id: 'orders',
    title: 'My Orders',
    subtitle: 'Track purchases & deliveries',
    icon: 'cube-outline',
    route: '/orders',
  },
  {
    id: 'addresses',
    title: 'Shipping Addresses',
    subtitle: 'Manage delivery locations',
    icon: 'location-outline',
    route: '/addresses',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Orders, updates & alerts',
    icon: 'notifications-outline',
    route: '/notifications',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Profile, region & preferences',
    icon: 'settings-outline',
    route: '/settings',
  },
]

export default function Profile() {
  const { user, signOut } = useClerk()
  const { user: clerkUser } = useUser()
  const router = useRouter()

  const role = (clerkUser?.publicMetadata?.role as string) || 'buyer'

  const handleLogout = async () => {
    await signOut()
    router.replace('/sign-in')
  }

  return (
    <SafeAreaView className="flex-1 bg-[#060B14]" edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Top bar — cool, minimal, open */}
      <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[#6B8299] text-[11px] font-semibold tracking-[3px] uppercase">
            Plazore
          </Text>
          <Text className="text-white text-[22px] font-extrabold mt-0.5">
            Lounge
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.8}
            className="w-11 h-11 rounded-2xl bg-[#0C1520] border border-[#1A2A3A] items-center justify-center"
          >
            <Ionicons name="notifications-outline" size={22} color="#DCEBFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/settings' as any)}
            activeOpacity={0.8}
            className="w-11 h-11 rounded-2xl bg-[#0C1520] border border-[#1A2A3A] items-center justify-center"
          >
            <Ionicons name="settings-outline" size={22} color="#DCEBFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {!user ? (
          /* ─── Guest state ─── */
          <View className="flex-1 items-center justify-center px-6 pt-16">
            <LinearGradient
              colors={['#0F1C2E', '#0A1420']}
              className="w-full rounded-[36px] border border-[#1B314B] p-8 items-center"
            >
              <View className="w-28 h-28 rounded-full bg-[#13263C] items-center justify-center border border-[#28435F]">
                <Ionicons name="person-outline" size={48} color="#A8C0D4" />
              </View>
              <Text className="text-white text-[26px] font-extrabold mt-6">
                Welcome to Plazore
              </Text>
              <Text className="text-[#8EA4B8] text-center mt-3 text-[15px] leading-6 px-2">
                Step into the digital mall. Bright aisles, cool air, and everything
                you need in one place.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/sign-in')}
                activeOpacity={0.9}
                className="bg-[#DCEBFF] mt-8 w-full py-4 rounded-2xl items-center"
              >
                <Text className="text-[#07111F] font-bold text-[16px]">
                  Enter the Lounge
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          <>
            {/* ─── Profile Hero ─── */}
            <View className="px-5 mt-1">
              <LinearGradient
                colors={['#0F1C2E', '#0A1420']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="rounded-[32px] border border-[#1E334A] overflow-hidden"
              >
                <View className="px-6 pt-7 pb-6">
                  <View className="flex-row items-center">
                    <View className="relative">
                      <Image
                        source={{ uri: user.imageUrl }}
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: '#2A4560',
                        }}
                      />
                      {role === 'seller' && (
                        <View className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1A2F28] border border-[#2A4A3A] items-center justify-center">
                          <Ionicons
                            name="shield-checkmark"
                            size={14}
                            color="#8FE3B0"
                          />
                        </View>
                      )}
                    </View>

                    <View className="ml-4 flex-1">
                      <View className="flex-row items-center gap-2 mb-1.5">
                        <View className="bg-[#13263B] px-3 py-1 rounded-full border border-[#21374D]">
                          <Text className="text-[#AFC3D6] text-[10px] font-semibold tracking-widest uppercase">
                            {role === 'seller' ? 'Seller' : 'Member'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-white text-[22px] font-extrabold">
                        {user.firstName || 'Member'}
                      </Text>
                      <Text className="text-[#7A93A8] text-[13px] mt-0.5" numberOfLines={1}>
                        {user.emailAddresses[0]?.emailAddress}
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* ─── Seller CTA ─── */}
            <View className="px-5 mt-5">
              {role === 'buyer' ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/seller-register' as any)}
                >
                  <LinearGradient
                    colors={['#12243A', '#0C1A2A']}
                    className="rounded-[28px] border border-[#243B55] p-5"
                  >
                    <View className="flex-row items-center">
                      <View className="w-13 h-13 rounded-2xl bg-[#1C334D] items-center justify-center"
                        style={{ width: 52, height: 52 }}
                      >
                        <Ionicons
                          name="storefront-outline"
                          size={26}
                          color="#DCEBFF"
                        />
                      </View>
                      <View className="ml-4 flex-1">
                        <Text className="text-white text-[17px] font-bold">
                          Become a Seller
                        </Text>
                        <Text className="text-[#7A93A8] text-[13px] mt-0.5 leading-5">
                          Open your store and start selling
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#7A93A8"
                      />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/seller' as any)}
                >
                  <LinearGradient
                    colors={['#DCEBFF', '#B8D4F0']}
                    className="rounded-[28px] p-5"
                  >
                    <View className="flex-row items-center">
                      <View
                        className="rounded-2xl bg-white/40 items-center justify-center"
                        style={{ width: 52, height: 52 }}
                      >
                        <Ionicons
                          name="storefront"
                          size={26}
                          color="#07111F"
                        />
                      </View>
                      <View className="ml-4 flex-1">
                        <Text className="text-[#07111F] text-[17px] font-extrabold">
                          Seller Lounge
                        </Text>
                        <Text className="text-[#3A5068] text-[13px] mt-0.5">
                          Products, orders & analytics
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={20}
                        color="#07111F"
                      />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* ─── Quick Access ─── */}
            <View className="px-5 mt-8">
              <Text className="text-[#6B8299] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
                Quick Access
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => router.push('/orders')}
                  activeOpacity={0.85}
                  className="flex-1 bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-5"
                >
                  <View className="w-11 h-11 rounded-2xl bg-[#13263B] items-center justify-center mb-3">
                    <Ionicons name="cube-outline" size={22} color="#DCEBFF" />
                  </View>
                  <Text className="text-white font-bold text-[15px]">Orders</Text>
                  <Text className="text-[#6B8299] text-[12px] mt-0.5">
                    Track purchases
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/favorites')}
                  activeOpacity={0.85}
                  className="flex-1 bg-[#0C1520] border border-[#1A2A3A] rounded-[24px] p-5"
                >
                  <View className="w-11 h-11 rounded-2xl bg-[#13263B] items-center justify-center mb-3">
                    <Ionicons
                      name="heart-outline"
                      size={22}
                      color="#DCEBFF"
                    />
                  </View>
                  <Text className="text-white font-bold text-[15px]">
                    Wishlist
                  </Text>
                  <Text className="text-[#6B8299] text-[12px] mt-0.5">
                    Saved items
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── Lounge Sections ─── */}
            <View className="px-5 mt-8">
              <Text className="text-[#6B8299] text-[11px] font-semibold tracking-[2.5px] uppercase mb-3">
                Lounge
              </Text>
              <View className="bg-[#0C1520] border border-[#1A2A3A] rounded-[28px] overflow-hidden">
                {LOUNGE_MENU.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.8}
                    className={`px-5 py-4.5 flex-row items-center ${
                      index !== LOUNGE_MENU.length - 1
                        ? 'border-b border-[#132030]'
                        : ''
                    }`}
                    style={{ paddingVertical: 18 }}
                  >
                    <View className="w-11 h-11 rounded-2xl bg-[#13263B] items-center justify-center">
                      <Ionicons
                        name={item.icon as any}
                        size={21}
                        color="#DCEBFF"
                      />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-white font-semibold text-[15px]">
                        {item.title}
                      </Text>
                      <Text className="text-[#5A7088] text-[12px] mt-0.5">
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#4A6078"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ─── Sign Out ─── */}
            <View className="px-5 mt-8">
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.85}
                className="bg-[#140E12] border border-[#3A1F2A] rounded-2xl py-4 items-center"
              >
                <Text className="text-[#FF8A9A] font-bold text-[15px]">
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}