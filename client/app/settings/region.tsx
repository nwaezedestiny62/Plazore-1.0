import api from '@/constants/api'
import { getRegion, REGION_LIST } from '@/constants/regions'
import { useMarketplace } from '@/context/MarketplaceContext'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

export default function MarketplaceRegionScreen() {
  const router = useRouter()
  const { getToken } = useAuth()
  const { colors } = useTheme()
  const { region: appRegion, setRegionLocal, refreshRegion } = useMarketplace()

  const [region, setRegion] = useState(appRegion || 'NG')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken()
        if (!token) {
          setRegion(appRegion || 'NG')
          return
        }
        const res = await api.get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data.success) {
          const code =
            res.data.data.marketplaceRegion || appRegion || 'NG'
          setRegion(code)
          setRegionLocal(code)
        }
      } catch {
        setRegion(appRegion || 'NG')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSelect = async (code: string) => {
    if (code === region || saving) return

    setRegion(code)
    setRegionLocal(code) // instant UI / currency

    try {
      setSaving(true)
      const token = await getToken()
      if (!token) {
        Toast.show({
          type: 'error',
          text1: 'Sign in required',
          text2: 'Region saved on this device only.',
        })
        return
      }

      const res = await api.patch(
        '/users/me',
        { marketplaceRegion: code },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data.success) {
        const saved =
          res.data.data?.marketplaceRegion || code
        setRegion(saved)
        setRegionLocal(saved)
        await refreshRegion()
        Toast.show({
          type: 'success',
          text1: 'Marketplace updated',
          text2: `${getRegion(saved).name} · prices refresh across the app`,
        })
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not save region',
        text2: 'Your local selection still applies for now.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.bg }}
      edges={['top']}
    >
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            Marketplace Region
          </Text>
          <Text className="text-[12px] mt-0.5" style={{ color: colors.muted }}>
            Choose the marketplace you want to shop in.
          </Text>
        </View>
        {saving && <ActivityIndicator color={colors.accent} />}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="text-[13px] leading-5 mb-5 ml-1"
            style={{ color: colors.muted }}
          >
            Prices and currency update across Plazore when you switch.
          </Text>

          <View
            className="rounded-[22px] overflow-hidden border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            {REGION_LIST.map((r, index) => {
              const selected = region === r.code
              return (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => handleSelect(r.code)}
                  activeOpacity={0.8}
                  disabled={saving}
                  className={`px-4 py-3.5 flex-row items-center ${
                    index < REGION_LIST.length - 1 ? 'border-b' : ''
                  }`}
                  style={{
                    borderBottomColor: colors.border,
                    backgroundColor: selected
                      ? colors.iconBg
                      : 'transparent',
                  }}
                >
                  <Text className="text-xl mr-3">{r.flag}</Text>
                  <View className="flex-1">
                    <Text
                      className="text-[15px] font-medium"
                      style={{ color: colors.text }}
                    >
                      {r.name}
                    </Text>
                    <Text
                      className="text-[12px] mt-0.5"
                      style={{ color: colors.muted }}
                    >
                      {r.currency.symbol} · {r.currency.code}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.accent}
                    />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}