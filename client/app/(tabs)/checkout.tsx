import { dummyAddress } from '@/assets/assets';
import Header from '@/components/Header';
import { COLORS } from '@/constants';
import { Address } from '@/constants/types';
import { useCart } from '@/context/CartContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function Checkout() {
    const { cartTotal } = useCart();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "stripe">('cash');

    const shipping = 2.0;
    const tax = 0;
    const total = cartTotal + shipping + tax;

    const fetchAddress = async () => {
        const addrList = dummyAddress;
        if (addrList.length > 0) {
            const def = addrList.find((a: any) => a.isDefault) || addrList[0];
            setSelectedAddress(def as Address);
        }
        setPageLoading(false);
    };

    const handlePlaceOrder = async () => {
        if (!selectedAddress) {
            Toast.show({
                type: "error",
                text1: "Error",
                text2: "Please add a shipping address"
            });
            return;
        }

        if (paymentMethod === 'stripe') {
            return Toast.show({
                type: "error",
                text1: "Error",
                text2: "Stripe not implemented yet"
            });
        }

        // Cash on Delivery
        setLoading(true);
        setTimeout(() => {
            router.replace('/orders');
        }, 800);
    };

    useEffect(() => {
        fetchAddress();
    }, []);

    if (pageLoading) {
        return (
            <SafeAreaView className='flex-1 bg-surface justify-center items-center'>
                <ActivityIndicator size='large' color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
      <SafeAreaView className='flex-1 bg-surface' edges={['top']}>
        <Header title='Checkout' showBack />

        <ScrollView className='flex-1 px-4 pt-2'>
            {/* Shipping Address */}
            <Text className='text-xl font-bold text-primary mb-3'>Shipping Address</Text>
            
            {selectedAddress ? (
                <View className='bg-white p-5 rounded-3xl mb-8 shadow-sm'>
                    <View className='flex-row items-start justify-between'>
                        <View>
                            <Text className='text-base font-bold text-primary'>{selectedAddress.type}</Text>
                            <Text className='text-secondary leading-5 mt-1'>
                                {selectedAddress.street}, {selectedAddress.city}{'\n'}
                                {selectedAddress.state} {selectedAddress.zipCode}{'\n'}
                                {selectedAddress.country}
                            </Text>
                        </View>
                     <TouchableOpacity 
    onPress={() => router.push('/addresses')}
    className="flex-row items-center -ml-20"
>
    <Text className='text-accent text-sm font-medium'>Change</Text>
    <Ionicons 
        name="chevron-forward" 
        size={16} 
        color={COLORS.accent} 
    />
</TouchableOpacity>
                    </View>
                </View>
            ) : (
                <TouchableOpacity 
                    className='bg-white p-8 rounded-3xl mb-8 items-center justify-center border-2 border-dashed border-gray-200'
                    onPress={() => router.push('/addresses')}
                >
                    <Ionicons name='location-outline' size={32} color={COLORS.secondary} />
                    <Text className='text-primary font-bold mt-3'>Add Shipping Address</Text>
                </TouchableOpacity>
            )}

            {/* Payment Method */}
            <Text className='text-xl font-bold text-primary mb-4'>Payment Method</Text>

            {/* Cash on Delivery */}
            <TouchableOpacity 
                onPress={() => setPaymentMethod('cash')} 
                className={`bg-white p-5 rounded-3xl mb-4 flex-row items-center border-2 ${paymentMethod === 'cash' ? 'border-primary' : 'border-transparent'}`}
            >
                <View className='w-12 h-12 bg-green-50 rounded-2xl items-center justify-center'>
                    <Ionicons name='cash-outline' size={28} color="#10b981" />
                </View>
                <View className='ml-4 flex-1'>
                    <Text className='text-base font-bold text-primary'>Cash on Delivery</Text>
                    <Text className='text-secondary text-sm'>Pay when you receive the order</Text>
                </View>
                {paymentMethod === 'cash' && <Ionicons name='checkmark-circle' size={26} color={COLORS.primary} />}
            </TouchableOpacity>

            {/* Card Payment */}
            <TouchableOpacity 
                onPress={() => setPaymentMethod('stripe')} 
                className={`bg-white p-5 rounded-3xl mb-8 flex-row items-center border-2 ${paymentMethod === 'stripe' ? 'border-primary' : 'border-transparent'}`}
            >
                <View className='w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center'>
                    <Ionicons name='card-outline' size={28} color="#3b82f6" />
                </View>
                <View className='ml-4 flex-1'>
                    <Text className='text-base font-bold text-primary'>Pay with Card</Text>
                    <Text className='text-secondary text-sm'>Credit or Debit Card</Text>
                </View>
                {paymentMethod === 'stripe' && <Ionicons name='checkmark-circle' size={26} color={COLORS.primary} />}
            </TouchableOpacity>
        </ScrollView>

        {/* Fixed Order Summary */}
        <View className='bg-white p-5 border-t border-gray-100 shadow-lg'>
            <Text className='text-lg font-bold text-primary mb-4'>Order Summary</Text>

            <View className='space-y-3 mb-6'>
                <View className='flex-row justify-between'>
                    <Text className='text-secondary'>Subtotal</Text>
                    <Text className='font-medium'>${cartTotal.toFixed(2)}</Text>
                </View>
                <View className='flex-row justify-between'>
                    <Text className='text-secondary'>Shipping</Text>
                    <Text className='font-medium'>${shipping.toFixed(2)}</Text>
                </View>
                <View className='flex-row justify-between'>
                    <Text className='text-secondary'>Tax</Text>
                    <Text className='font-medium'>${tax.toFixed(2)}</Text>
                </View>
            </View>

            <View className='flex-row justify-between items-center mb-6'>
                <Text className='text-xl font-bold text-primary'>Total</Text>
                <Text className='text-2xl font-bold text-primary'>${total.toFixed(2)}</Text>
            </View>

            <TouchableOpacity 
                className={`py-4 rounded-2xl items-center ${loading ? 'bg-gray-400' : 'bg-primary'}`} 
                onPress={handlePlaceOrder} 
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color='white' />
                ) : (
                    <Text className='text-white font-bold text-lg'>Place Order</Text>
                )}
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
}