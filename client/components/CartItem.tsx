import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useCart } from '@/context/CartContext'

export default function CartItems({ item, onRemove, onUpdateQuantity }: any) {
  const { updateItemNote } = useCart()

  const note = item.note || ''
  const remaining = 120 - note.length

  return (
    <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100">
      {/* Product row */}
      <View className="flex-row">
        <Image
          source={{ uri: item.product?.images?.[0] || item.image }}
          className="w-20 h-20 rounded-xl bg-gray-100"
        />

        <View className="flex-1 ml-3">
          <Text className="text-primary font-semibold" numberOfLines={2}>
            {item.product?.name || item.name}
          </Text>
          <Text className="text-primary font-bold mt-1">
            ${Number(item.price).toFixed(2)}
          </Text>

          {/* Quantity controls */}
          <View className="flex-row items-center mt-2">
            <TouchableOpacity
              onPress={() => onUpdateQuantity(item.quantity - 1)}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="remove" size={16} color="#111" />
            </TouchableOpacity>
            <Text className="mx-3 font-medium">{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => onUpdateQuantity(item.quantity + 1)}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="add" size={16} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onRemove} className="ml-auto">
              <Ionicons name="trash-outline" size={20} color="#FF4C3B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ========== BUYER NOTE ========== */}
      <View className="mt-4 pt-3 border-t border-gray-100">
        <TextInput
          value={note}
          onChangeText={(text) => updateItemNote(item.id, text)}
          placeholder="Optional note for this product..."
          placeholderTextColor="#999"
          multiline
          maxLength={120}
          className="bg-gray-50 rounded-xl px-3 py-2.5 text-primary text-[14px] min-h-[60]"
          style={{ textAlignVertical: 'top' }}
        />

        <View className="flex-row justify-between items-center mt-1.5">
          <Text className="text-[11px] text-gray-400 flex-1 pr-2">
            Use this to tell the seller anything important about this product, such as packaging or delivery preferences.
          </Text>
          <Text className={`text-[11px] font-medium ${remaining < 20 ? 'text-orange-500' : 'text-gray-400'}`}>
            {note.length} / 120
          </Text>
        </View>
      </View>
    </View>
  )
}