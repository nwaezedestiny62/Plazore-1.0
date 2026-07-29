import { BANNERS, dummyProducts } from '@/assets/assets'
import CategoryItem from '@/components/CategoryItem'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import { CATEGORIES } from '@/constants'
import { Product } from '@/constants/types'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Dimensions, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import api from '@/constants/api'

const {width} = Dimensions.get('window')

export default function Home() {
  const router = useRouter()
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const categories = [{ id: 'all', name: 'All', icon: 'grid' }, ...CATEGORIES]

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/products?limit=8')
      if (res.data.success) {
        setProducts(res.data.data)
      }
    } catch (error) {
      console.log('Home products error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

    return (
      <SafeAreaView className='flex-1' edges={['top']}>
        <Header title='Plazore' showMenu showCart showLogo/>

        <ScrollView className='flex-1 px-4' showsVerticalScrollIndicator={false}>
          {/* Banner Slide */}
          <View className='mb-6'>

           <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} className='w-full h-48 rounded-xl' scrollEventThrottle={16}
           onScroll={(e)=> {
            const slide = Math.ceil(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width)
            if(slide !== activeBannerIndex) {
              setActiveBannerIndex(slide)
            }
           }}
           >
            {BANNERS.map((banner, index)=>(
              <View key={index} className='w-full h-48 relative bg-gray-200 overflow-hidden' style={{width: width - 32 }}>
                <Image source={{uri: banner.image}} className='w-full h-full' resizeMode='cover' />

                <View className='absolute inset-0 bg-black/40'></View>

                <View className='absolute bottom-4 left-4 z-10'>
                  <Text className='text-white text-2xl font-bold'>{banner.title}</Text>
                  <Text className='text-white text-sm font-medium'>{banner.subtitle}</Text>
                  <TouchableOpacity className='mt-2 bg-white px-4 py-3 rounded-xl self-start'>
                    <Text className='text-primary font-bold text-xs'>Get Now</Text>
                  </TouchableOpacity>
                  
                </View>
                <View className='absolute inset-0 bg-black/40'/>
              </View>
            ))}
           </ScrollView>
           {/* Pagination Dots */}
           <View className='flex-row justify-center mt-3 gap-2'>
            {BANNERS.map((_, index)=>(
              <View key={index} className={`h-2 rounded-xl ${index === activeBannerIndex ? 'w-6 bg-primary' : 'w-2 bg-gray-300'}`}/>
            ))}
           </View>

           </View>

           {/*Categories*/}
           <View className='mb-6'>
            <View className='flex-row justify-between items-center mb-4'>
              <Text className='text-xl font-bold text-primary'>Categories</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((cat: any)=> (
                <CategoryItem key={cat.id} item={cat} isSelected={false} onPress={()=> router.push({pathname: '/shop' as any, params: {category: cat.id === 'all' ? '' : cat.name}})}/>
              ))}
            </ScrollView>
           </View>
           {/* Popular Products */}
           <View className='mb-8'>
            <View className='flex-row justify-between items-center mb-4'>
              <Text className='text-xl font-bold text-primary'>Popular</Text>
              <TouchableOpacity onPress={()=> router.push('/shop' as any)}>
              <Text className='text-sm text-secondary'>See All</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator size='large'/>
            ) : (
              <View className='flex-row flex-wrap justify-between'>
                {products.slice(0,4).map((product)=>(
                  <ProductCard key={product._id} product={product}/>
                ))}
              </View>
            )}
           </View>

           {/* Newsletter CTA */}
           <View className='bg-gray-100 p-6 rounded-2xl mb-20 items-center'>
            <Text className='text-2xl font-bold text-primary mb-2 text-center'>Enter the Plazore Showroom</Text>
           <Text className='text-secondary text-center mb-4'>Bask in Plazore's world of discovery & Innovation 2026 Style. Shop with Confidence and Trust</Text>
           <TouchableOpacity className='bg-primary w-4/5 py-3 rounded-xl items-center'>
            <Text className='text-white font-medium text-base'>Subscribe Now</Text>
           </TouchableOpacity>
           </View>
           
        </ScrollView>
      </SafeAreaView>
    )
  }
