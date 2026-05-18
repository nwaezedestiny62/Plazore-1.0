import { dummyProducts } from '@/assets/assets';
import { COLORS } from '@/constants';
import { Product } from '@/constants/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToCart, cartItems, itemCount } = useCart();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // 🔥 Animated scroll value (key upgrade)
  const scrollX = useRef(new Animated.Value(0)).current;

  const fetchProduct = async () => {
    setProduct(dummyProducts.find((p) => p._id === id) as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchProduct();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView className="flex-1 justify-center">
        <Text>Product not found</Text>
      </SafeAreaView>
    );
  }

  const isLiked = isInWishlist(product._id);

const handleAddToCart = () => {
  addToCart(product, "")
}

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* IMAGE CAROUSEL */}
        <View className="relative h-[450px] bg-gray-100 mb-6">
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
          >
            {product.images?.map((img, index) => (
              <Image
                key={index}
                source={{ uri: img }}
                style={{ width, height: 450 }}
                resizeMode="cover"
              />
            ))}
          </Animated.ScrollView>

          {/* 🔥 SMOOTH PAGINATION DOTS */}
          <View className="absolute bottom-4 left-0 right-0 flex-row justify-center items-center">
            {product.images?.map((_, index) => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];

              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 18, 8],
                extrapolate: 'clamp',
              });

              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.4, 1, 0.4],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={index}
                  style={{
                    width: dotWidth,
                    opacity,
                    height: 8,
                    borderRadius: 8,
                    backgroundColor: COLORS.primary,
                    marginHorizontal: 4,
                  }}
                />
              );
            })}
          </View>
        </View>

        {/* Product Info */}
        <View className='px-5'>
          {/* Title & Rating */}
          <View className='flex-row justify-between items-start mb-2'>
            <Text className='text-2xl font-bold text-primary flex-1 mr-4'>{product.name}</Text>
          </View>
          {/* Price */}
          <Text className='text-2xl font-bold text-primary mb-6'>${product.price.toFixed(2)}</Text>
          {/* Description */}
          <Text className='text-base font-bold text-primary mb-2'>Description</Text>
          <Text className='text-secondary leading-6 mb-6'>
            {product.description}
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className='absolute bottom-0 left-0 flex-row right-0 p-4 bg-white border-gray-100'>
        <TouchableOpacity onPress={handleAddToCart} className='w-4/5 bg-primary py-4 rounded-xl items-center shadow-lg flex-row justify-center'>
          <Ionicons name='bag-outline' size={20} color='white' />
          <Text className='text-white font-bold text-base ml-2'>Add to Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={()=> router.push('/(tabs)/cart')} className='w-1/5 py-3 flex-row justify-center relative'>
          <Ionicons name='cart-outline' size={24} />
          <View className='absolute top-2 right-4 size-4 z-10 bg-black rounded-xl justify-center items-center'>
            <Text className='text-white text-[9px]'>{itemCount}</Text>
          </View>
          </TouchableOpacity>
      </View>

      {/* HEADER */}
      <View className="absolute top-12 left-4 right-4 flex-row justify-between items-center z-10">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 bg-white/80 h-10 rounded-xl items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => toggleWishlist(product)}
          className="w-10 bg-white/80 h-10 rounded-xl items-center justify-center"
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? COLORS.accent : COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}