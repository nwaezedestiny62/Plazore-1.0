import { dummyUser } from '@/assets/assets'
import Header from '@/components/Header'
import { COLORS, PROFILE_MENU } from '@/constants'
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
  const { user } = { user: dummyUser }
  const router = useRouter()

  const handleLogout = async () => {
    router.replace('/sign-in')
  }

  return (
    <SafeAreaView
      className='flex-1 bg-[#07111F]'
      edges={['top']}
    >
      <StatusBar barStyle='light-content' />

      <Header title='Plazore Lounge' />

      <ScrollView
        showsVerticalScrollIndicator={false}
        className='flex-1'
        contentContainerStyle={{
          paddingBottom: 140,
        }}
      >
        {!user ? (
          <View className='flex-1 items-center justify-center px-6 pt-20'>
            <LinearGradient
              colors={['#102033', '#0B1727']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className='w-full rounded-[34px] border border-[#1B314B] p-8 items-center'
            >
              <View className='w-28 h-28 rounded-full bg-[#13263C] items-center justify-center border border-[#28435F]'>
                <Ionicons
                  name='person-outline'
                  size={52}
                  color='#C6D4E1'
                />
              </View>

              <Text className='text-white text-[28px] font-extrabold mt-6'>
                Welcome to Plazore
              </Text>

              <Text className='text-[#94A7BB] text-center mt-3 text-[15px] leading-6 px-2'>
                Your futuristic commerce lounge for buyers,
                sellers, deals, inventory, and trusted
                marketplace activity.
              </Text>

              <TouchableOpacity
                onPress={() => router.push('/sign-in')}
                activeOpacity={0.9}
                className='bg-[#DCEBFF] mt-8 w-full py-4 rounded-2xl items-center'
              >
                <Text className='text-[#07111F] font-bold text-[16px]'>
                  Enter Lounge
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          <>
            {/* ================= HERO HUB ================= */}
            <View className='px-5 mt-2'>
              <LinearGradient
                colors={['#12243A', '#0A1422']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className='rounded-[34px] border border-[#1E334A] overflow-hidden'
              >
                {/* Ambient top glow */}
                <View className='absolute top-0 right-0 w-40 h-40 bg-[#294A6B]/20 rounded-full' />

                <View className='px-6 pt-7 pb-6'>
                  {/* top row */}
                  <View className='flex-row items-center justify-between'>
                    <View className='flex-row items-center'>
                      <View className='relative'>
                        <Image
                          source={{ uri: user.imageUrl }}
                          className='w-24 h-24 rounded-full'
                        />

                        <View className='absolute bottom-1 right-1 w-7 h-7 rounded-full bg-[#8FE3B0] border-2 border-[#0A1422] items-center justify-center'>
                          <Ionicons
                            name='checkmark'
                            size={14}
                            color='#07111F'
                          />
                        </View>
                      </View>

                      <View className='ml-4 flex-1'>
                        <View className='bg-[#13263B] self-start px-3 py-1 rounded-full border border-[#21374D]'>
                          <Text className='text-[#AFC3D6] text-[11px] font-semibold tracking-widest'>
                            PLAZORE MEMBER
                          </Text>
                        </View>

                        <Text className='text-white text-[25px] font-extrabold mt-3'>
                          {user.firstName}
                        </Text>

                        <Text className='text-[#8EA4B8] text-[13px] mt-1'>
                          {user.emailAddresses[0].emailAddress}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Stats strip */}
                  <View className='flex-row mt-8 bg-[#0C1827] border border-[#1B3045] rounded-[28px] p-4'>
                    <View className='flex-1 items-center'>
                      <Text className='text-[#DCEBFF] text-[20px] font-extrabold'>
                        24
                      </Text>
                      <Text className='text-[#7D93A8] text-[12px] mt-1'>
                        Orders
                      </Text>
                    </View>

                    <View className='w-[1px] bg-[#22384F]' />

                    <View className='flex-1 items-center'>
                      <Text className='text-[#DCEBFF] text-[20px] font-extrabold'>
                        12
                      </Text>
                      <Text className='text-[#7D93A8] text-[12px] mt-1'>
                        Deals
                      </Text>
                    </View>

                    <View className='w-[1px] bg-[#22384F]' />

                    <View className='flex-1 items-center'>
                      <Text className='text-[#DCEBFF] text-[20px] font-extrabold'>
                        4.9
                      </Text>
                      <Text className='text-[#7D93A8] text-[12px] mt-1'>
                        Trust
                      </Text>
                    </View>
                  </View>

                  {/* Admin */}
                  {user.publicMetadata?.role === 'admin' && (
                    <TouchableOpacity
                      onPress={() => router.push('/admin')}
                      activeOpacity={0.85}
                      className='mt-6 bg-[#DCEBFF] rounded-2xl py-4 px-5 flex-row items-center justify-center'
                    >
                      <Ionicons
                        name='shield-checkmark'
                        size={18}
                        color='#07111F'
                      />

                      <Text className='text-[#07111F] font-extrabold ml-2 text-[15px]'>
                        Access Control Center
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </View>

            {/* ================= QUICK ACCESS ================= */}
            <View className='px-5 mt-8'>
              <View className='flex-row items-center justify-between mb-4'>
                <Text className='text-white text-[20px] font-bold'>
                  Quick Access
                </Text>

                <Text className='text-[#7F93A8] text-[13px]'>
                  Commerce Hub
                </Text>
              </View>

              <View className='flex-row gap-4'>
                {/* Orders */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/orders')}
                  className='flex-1'
                >
                  <LinearGradient
                    colors={['#12263B', '#0A1421']}
                    className='rounded-[30px] border border-[#1D3349] p-5'
                  >
                    <View className='w-14 h-14 rounded-2xl bg-[#182D45] items-center justify-center'>
                      <Ionicons
                        name='cube-outline'
                        size={28}
                        color='#DCEBFF'
                      />
                    </View>

                    <Text className='text-white font-bold text-[17px] mt-5'>
                      Orders
                    </Text>

                    <Text className='text-[#8095AA] text-[13px] mt-1 leading-5'>
                      Track purchases, deliveries and active requests.
                    </Text>

                    <View className='mt-5 flex-row items-center'>
                      <Text className='text-[#DCEBFF] font-semibold'>
                        Open
                      </Text>

                      <Ionicons
                        name='arrow-forward'
                        size={16}
                        color='#DCEBFF'
                        style={{ marginLeft: 6 }}
                      />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Wishlist */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/(tabs)/favorites')}
                  className='flex-1'
                >
                  <LinearGradient
                    colors={['#12263B', '#0A1421']}
                    className='rounded-[30px] border border-[#1D3349] p-5'
                  >
                    <View className='w-14 h-14 rounded-2xl bg-[#182D45] items-center justify-center'>
                      <Ionicons
                        name='bookmark-outline'
                        size={28}
                        color='#DCEBFF'
                      />
                    </View>

                    <Text className='text-white font-bold text-[17px] mt-5'>
                      Wishlist
                    </Text>

                    <Text className='text-[#8095AA] text-[13px] mt-1 leading-5'>
                      Your saved products, brands and future deals.
                    </Text>

                    <View className='mt-5 flex-row items-center'>
                      <Text className='text-[#DCEBFF] font-semibold'>
                        Explore
                      </Text>

                      <Ionicons
                        name='arrow-forward'
                        size={16}
                        color='#DCEBFF'
                        style={{ marginLeft: 6 }}
                      />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* ================= PROFILE NAVIGATION ================= */}
            <View className='px-5 mt-9'>
              <View className='flex-row items-center justify-between mb-4'>
                <Text className='text-white text-[20px] font-bold'>
                  Lounge Sections
                </Text>

                <View className='px-3 py-1 rounded-full bg-[#101F31] border border-[#1F344B]'>
                  <Text className='text-[#9DB2C7] text-[11px] font-semibold'>
                    SMART ACCESS
                  </Text>
                </View>
              </View>

              <View className='bg-[#0B1625] border border-[#182B3F] rounded-[34px] overflow-hidden'>
                {PROFILE_MENU.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.82}
                    onPress={() =>
                      router.push(item.route as any)
                    }
                    className={`px-5 py-5 flex-row items-center ${
                      index !== PROFILE_MENU.length - 1
                        ? 'border-b border-[#132436]'
                        : ''
                    }`}
                  >
                    <View className='w-14 h-14 rounded-[20px] bg-[#13263B] border border-[#21374D] items-center justify-center'>
                      <Ionicons
                        name={item.icon as any}
                        size={24}
                        color='#DCEBFF'
                      />
                    </View>

                    <View className='flex-1 ml-4'>
                      <Text className='text-white font-bold text-[16px]'>
                        {item.title}
                      </Text>
                    </View>

                    <View className='w-10 h-10 rounded-full bg-[#101F31] items-center justify-center'>
                      <Ionicons
                        name='chevron-forward'
                        size={18}
                        color='#DCEBFF'
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ================= LOGOUT ================= */}
            <View className='px-5 mt-10'>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleLogout}
                className='bg-[#0B1625] border border-[#1A2D42] rounded-[28px] py-5 flex-row items-center justify-center'
              >
                <Ionicons
                  name='log-out-outline'
                  size={22}
                  color='#C9D7E4'
                />

                <Text className='text-[#DCEBFF] font-bold text-[16px] ml-3'>
                  Leave Lounge
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}