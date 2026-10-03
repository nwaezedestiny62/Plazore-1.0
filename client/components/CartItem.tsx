import { Ionicons } from '@expo/vector-icons'
import React, { useMemo } from 'react'
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useCart } from '@/context/CartContext'
import { useMarketplace } from '@/context/MarketplaceContext'
import { formatSelectedOptions } from '@/constants/types'

export default function CartItems({ item, onRemove, onUpdateQuantity }: any) {
  const { updateItemNote } = useCart()
  const { formatProduct } = useMarketplace()

  const note = item.note || ''
  const remaining = 120 - note.length

  const optionLine = useMemo(() => {
    if (item.selectedOptions) return formatSelectedOptions(item.selectedOptions)
    if (item.size) return `Size: ${item.size}`
    return ''
  }, [item.selectedOptions, item.size])

  const unitLabel = useMemo(() => {
    const n = Number(item.price) || 0
    const region =
      item.product?.region ||
      (typeof item.product?.seller === 'object'
        ? item.product.seller?.marketplaceRegion
        : undefined)
    try {
      return formatProduct(n, region)
    } catch {
      return `$${n.toFixed(2)}`
    }
  }, [item.price, item.product, formatProduct])

  const img =
    item.image ||
    item.product?.images?.[0] ||
    undefined

  return (
    <View
      style={{
        backgroundColor: '#11141A',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 14,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        <Image
          source={{ uri: img }}
          style={{
            width: 80,
            height: 80,
            backgroundColor: '#171B22',
          }}
        />

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              color: '#F5F7FA',
              fontWeight: '600',
              fontSize: 14,
            }}
            numberOfLines={2}
          >
            {item.product?.name || item.name}
          </Text>

          {!!optionLine && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 12,
                marginTop: 4,
              }}
              numberOfLines={2}
            >
              {optionLine}
            </Text>
          )}

          <Text
            style={{
              color: '#00E575',
              fontWeight: '700',
              fontSize: 14,
              marginTop: 6,
            }}
          >
            {unitLabel}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => onUpdateQuantity?.(item.quantity - 1)}
              style={{
                width: 32,
                height: 32,
                backgroundColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="remove" size={16} color="#F5F7FA" />
            </TouchableOpacity>
            <Text
              style={{
                marginHorizontal: 14,
                color: '#F5F7FA',
                fontWeight: '600',
                minWidth: 16,
                textAlign: 'center',
              }}
            >
              {item.quantity}
            </Text>
            <TouchableOpacity
              onPress={() => onUpdateQuantity?.(item.quantity + 1)}
              style={{
                width: 32,
                height: 32,
                backgroundColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={16} color="#F5F7FA" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onRemove} style={{ marginLeft: 'auto' }}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <TextInput
          value={note}
          onChangeText={(text) => updateItemNote(item.id, text)}
          placeholder="Optional note for this product..."
          placeholderTextColor="#5A606C"
          multiline
          maxLength={120}
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: '#F5F7FA',
            fontSize: 14,
            minHeight: 56,
            textAlignVertical: 'top',
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              flex: 1,
              paddingRight: 8,
            }}
          >
            Packaging or delivery preferences for the seller.
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: remaining < 20 ? '#F59E0B' : 'rgba(255,255,255,0.35)',
            }}
          >
            {note.length} / 120
          </Text>
        </View>
      </View>
    </View>
  )
}
