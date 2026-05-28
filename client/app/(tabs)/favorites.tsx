import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { useWishlist } from '@/context/WishlistContext'
import { useRouter } from 'expo-router';
import React from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Favorites() {

    const {wishlist} = useWishlist();
    const router = useRouter()

    return (
      <SafeAreaView className='flex-1 bg-surface' edges={['top']}>
        <Header title='Wishlist' showMenu showCart/>

        {wishlist.length > 0 ? (
          <ScrollView className='px-4 mt-4 flex-1' showsVerticalScrollIndicator={false}>
             <View className='flex-row flex-wrap justify-between'>
              {wishlist.map((product)=> (
                <ProductCard key={product._id} product={product}/>
              ))}
             </View>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-secondary text-lg text-center">
                      Your wishlist is currently empty.{'\n'}
                      Items you heart on from Plazore mall will be displayed here
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/')}
                      className="mt-6 bg-primary px-8 py-3.5 rounded-2xl"
                    >
                      <Text className="text-white font-bold">Start Shopping</Text>
                    </TouchableOpacity>
                  </View>
        )}
      </SafeAreaView>
    )
  }

