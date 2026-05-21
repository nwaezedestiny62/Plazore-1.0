import { COLORS } from '@/constants'
import { CartItemProps } from '@/constants/types'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'

export default function CartItems({ item, onRemove, onUpdateQuantity }: CartItemProps) {

    const imageUrl = item.product.images?.[0] || ''

    return (
      <View className='flex-row mb-4 p-3 bg-white rounded-xl'>
        <View className='w-20 h-20 bg-gray-100 rounded-lg overflow-hidden mr-3'>
            <Image 
                source={{ uri: imageUrl }} 
                className='w-full h-full' 
                resizeMode='cover' 
            />
        </View>

        <View className='flex-1 justify-between'>
            <View className='flex-row justify-between items-start'>
                <Text className='text-primary font-medium text-sm flex-1 pr-2'>
                    {item.product.name}
                </Text>
                <TouchableOpacity onPress={onRemove} hitSlop={8}>
                    <Ionicons name='close-circle-outline' size={20} color="#FF4C3B"/>
                </TouchableOpacity>
            </View>

            <View className='flex-row justify-between items-center mt-2'>
                <Text className='text-primary font-bold text-base'>
                    ${item.product.price.toFixed(2)}
                </Text>

                <View className='flex-row items-center bg-surface rounded-xl px-2 py-1'>
                    <TouchableOpacity 
                        className='p-1' 
                        onPress={() => onUpdateQuantity && onUpdateQuantity(Math.max(1, item.quantity - 1))}
                    >
                        <Ionicons name='remove' size={16} color={COLORS.primary}/>
                    </TouchableOpacity>

                    <Text className='text-primary font-medium mx-4 min-w-[24px] text-center'>
                        {item.quantity}
                    </Text>

                    <TouchableOpacity 
                        className='p-1' 
                        onPress={() => onUpdateQuantity && onUpdateQuantity(item.quantity + 1)}
                    >
                        <Ionicons name='add' size={16} color={COLORS.primary}/>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </View>
    )
}