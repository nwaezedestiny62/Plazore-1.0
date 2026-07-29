import Header from '@/components/Header'
import { PROFILE_MENU } from '@/constants'
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
    <SafeAreaView className="flex-1 bg-[#07111F]" edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Header title="Plazore Lounge" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {!user ? (
          <View className="flex-1 items-center justify-center px-6 pt-20">
            <LinearGradient
              colors={['#102033', '#0B1727']}
              className="w-full rounded-[34px] border border-[#1B314B] p-8 items-center"
            >
              <View className="w-28 h-28 rounded-full bg-[#13263C] items-center justify-center border border-[#28435F]">
                <Ionicons name="person-outline" size={52} color="#C6D4E1" />
              </View>
              <Text className="text-white text-[28px] font-extrabold mt-6">Welcome to Plazore</Text>
              <Text className="text-[#94A7BB] text-center mt-3 text-[15px] leading-6 px-2">
                Your commerce lounge for buyers and sellers.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/sign-in')}
                activeOpacity={0.9}
                className="bg-[#DCEBFF] mt-8 w-full py-4 rounded-2xl items-center"
              >
                <Text className="text-[#07111F] font-bold text-[16px]">Enter Lounge</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          <>
            {/* Profile Hero */}
            <View className="px-5 mt-2">
              <LinearGradient
                colors={['#12243A', '#0A1422']}
                className="rounded-[34px] border border-[#1E334A] overflow-hidden"
              >
                <View className="px-6 pt-7 pb-6">
                  <View className="flex-row items-center">
                    <Image
                      source={{ uri: user.imageUrl }}
                      className="w-22 h-22 rounded-full"
                      style={{ width: 88, height: 88 }}
                    />
                    <View className="ml-4 flex-1">
                      <View className="flex-row items-center gap-2">
                        <View className="bg-[#13263B] px-3 py-1 rounded-full border border-[#21374D]">
                          <Text className="text-[#AFC3D6] text-[11px] font-semibold tracking-widest uppercase">
                            {role === 'seller' ? 'Seller' : 'Member'}
                          </Text>
                        </View>
                        {role === 'seller' && (
                          <View className="bg-[#1A2F28] px-2.5 py-1 rounded-full border border-[#2A4A3A] flex-row items-center">
                            <Ionicons name="shield-checkmark" size={12} color="#8FE3B0" />
                            <Text className="text-[#8FE3B0] text-[10px] font-semibold ml-1">VERIFIED</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-white text-[24px] font-extrabold mt-2">
                        {user.firstName}
                      </Text>
                      <Text className="text-[#8EA4B8] text-[13px] mt-0.5">
                        {user.emailAddresses[0]?.emailAddress}
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* BECOME A SELLER / SELLER LOUNGE SECTION */}
            <View className="px-5 mt-6">
              {role === 'buyer' ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/seller-register' as any)}
                >
                  <LinearGradient
                    colors={['#152A3F', '#0E1C2C']}
                    className="rounded-[28px] border border-[#243B55] p-6"
                  >
                    <View className="flex-row items-center">
                      <View className="w-14 h-14 rounded-2xl bg-[#1C334D] items-center justify-center">
                        <Ionicons name="storefront-outline" size={28} color="#DCEBFF" />
                      </View>
                      <View className="ml-4 flex-1">
                        <Text className="text-white text-[18px] font-bold">Become a Seller</Text>
                        <Text className="text-[#8EA4B8] text-[13px] mt-1 leading-5">
                          Open your store in the Plazore lounge and start selling
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#DCEBFF" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/seller' as any)}
                >
                  <LinearGradient
                    colors={['#DCEBFF', '#C5D9F0']}
                    className="rounded-[28px] p-6"
                  >
                    <View className="flex-row items-center">
                      <View className="w-14 h-14 rounded-2xl bg-white/40 items-center justify-center">
                        <Ionicons name="storefront" size={28} color="#07111F" />
                      </View>
                      <View className="ml-4 flex-1">
                        <Text className="text-[#07111F] text-[18px] font-extrabold">
                          Open Seller Lounge
                        </Text>
                        <Text className="text-[#3A5068] text-[13px] mt-1">
                          Manage products, orders & analytics
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={20} color="#07111F" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Access */}
            <View className="px-5 mt-8">
              <Text className="text-white text-[18px] font-bold mb-4">Quick Access</Text>
              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() => router.push('/orders')}
                  className="flex-1 bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5"
                >
                  <Ionicons name="cube-outline" size={26} color="#DCEBFF" />
                  <Text className="text-white font-bold mt-4 text-[15px]">Orders</Text>
                  <Text className="text-[#7F93A8] text-[12px] mt-1">Track purchases</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/favorites')}
                  className="flex-1 bg-[#0B1625] border border-[#1E334A] rounded-[24px] p-5"
                >
                  <Ionicons name="bookmark-outline" size={26} color="#DCEBFF" />
                  <Text className="text-white font-bold mt-4 text-[15px]">Wishlist</Text>
                  <Text className="text-[#7F93A8] text-[12px] mt-1">Saved items</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Lounge Sections */}
            <View className="px-5 mt-9">
              <Text className="text-white text-[18px] font-bold mb-4">Lounge Sections</Text>
              <View className="bg-[#0B1625] border border-[#182B3F] rounded-[28px] overflow-hidden">
                {PROFILE_MENU.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(item.route as any)}
                    className={`px-5 py-5 flex-row items-center ${
                      index !== PROFILE_MENU.length - 1 ? 'border-b border-[#132436]' : ''
                    }`}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-[#13263B] items-center justify-center">
                      <Ionicons name={item.icon as any} size={22} color="#DCEBFF" />
                    </View>
                    <Text className="text-white font-semibold text-[15px] ml-4 flex-1">
                      {item.title}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#6B8299" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Logout */}
            <View className="px-5 mt-10">
              <TouchableOpacity
                onPress={handleLogout}
                className="bg-[#1A1218] border border-[#3A1F2A] rounded-2xl py-4 items-center"
              >
                <Text className="text-[#FF8A9A] font-bold text-[15px]">Sign Out</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}