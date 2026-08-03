import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native'

export type ConfigOption = {
  id: string
  label: string
  icon?: keyof typeof Ionicons.glyphMap
  destructive?: boolean
  selected?: boolean
  onPress: () => void
}

type Props = {
  visible: boolean
  onClose: () => void
  title?: string
  options: ConfigOption[]
}

export function ScreenConfigMenu({
  visible,
  onClose,
  title = 'Options',
  options,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-[#0B1625] rounded-t-[28px] border-t border-[#1E334A] px-5 pt-5 pb-10"
        >
          <View className="w-10 h-1 rounded-full bg-[#2A4560] self-center mb-4" />
          <Text className="text-white font-bold text-lg mb-4">{title}</Text>

          {options.map((opt, i) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => {
                opt.onPress()
                onClose()
              }}
              activeOpacity={0.8}
              className={`flex-row items-center py-3.5 ${
                i < options.length - 1 ? 'border-b border-[#152030]' : ''
              }`}
            >
              {opt.icon ? (
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={opt.destructive ? '#FF8A9A' : '#DCEBFF'}
                  style={{ marginRight: 12 }}
                />
              ) : null}
              <Text
                className={`flex-1 text-[15px] font-medium ${
                  opt.destructive ? 'text-[#FF8A9A]' : 'text-white'
                }`}
              >
                {opt.label}
              </Text>
              {opt.selected ? (
                <Ionicons name="checkmark" size={18} color="#7EC8FF" />
              ) : null}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  )
}