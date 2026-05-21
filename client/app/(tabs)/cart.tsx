import CartItems from '@/components/CartItem';
import Header from '@/components/Header';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Cart() {
  const { cartItems, cartTotal, removeFromCart, updateQuantity } = useCart();
  const router = useRouter();

  const shipping = 2.00;
  const total = cartTotal + shipping;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <Header title="My Cart" showBack />

      {cartItems.length > 0 ? (
        <>
          <ScrollView
            className="flex-1 px-4 mt-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 220 }}   // ← Increased heavily
          >
            {cartItems.map((item: any) => (
              <CartItems
                key={item.id}
                item={item}
                onRemove={() => removeFromCart(item.id)}
                onUpdateQuantity={(q: number) => updateQuantity(item.id, q)}
              />
            ))}
          </ScrollView>

          {/* Bottom Summary - Extra margin added */}
          <View 
            className="p-4 bg-white rounded-t-3xl shadow-sm"
            style={{ marginBottom: 90 }}   // ← This pushes the whole box up
          >
            {/* Subtotal */}
            <View className="flex-row justify-between mb-2">
              <Text className="text-secondary">Subtotal</Text>
              <Text className="font-bold text-primary">
                ${cartTotal.toFixed(2)}
              </Text>
            </View>

            {/* Shipping */}
            <View className="flex-row justify-between mb-2">
              <Text className="text-secondary">Shipping</Text>
              <Text className="font-bold text-primary">
                ${shipping.toFixed(2)}
              </Text>
            </View>

            <View className="h-[1px] bg-border mb-4" />

            {/* Total */}
            <View className="flex-row justify-between mb-6">
              <Text className="text-primary font-bold text-lg">Total</Text>
              <Text className="font-bold text-primary text-lg">
                ${total.toFixed(2)}
              </Text>
            </View>

            {/* Checkout Button */}
            <TouchableOpacity
              className="bg-primary py-4 rounded-xl items-center"
              onPress={() => router.push('/checkout' as any)}
            >
              <Text className="text-white font-bold text-base">Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-secondary text-lg text-center">
            Your cart is currently empty{'\n'}
            Items you select from Plazore mall will be displayed here
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
  );
}