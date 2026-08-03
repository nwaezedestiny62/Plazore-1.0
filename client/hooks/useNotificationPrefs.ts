import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

export type BuyerNotifPrefs = {
  orderUpdates: boolean
  shippingUpdates: boolean
  promotions: boolean
  wishlistUpdates: boolean
  announcements: boolean
}

export type SellerNotifPrefs = {
  newOrders: boolean
  shippingUpdates: boolean
  subscriptionUpdates: boolean
  announcements: boolean
}

const BUYER_KEY = 'plazore_notif_prefs_buyer'
const SELLER_KEY = 'plazore_notif_prefs_seller'

const defaultBuyer: BuyerNotifPrefs = {
  orderUpdates: true,
  shippingUpdates: true,
  promotions: true,
  wishlistUpdates: true,
  announcements: true,
}

const defaultSeller: SellerNotifPrefs = {
  newOrders: true,
  shippingUpdates: true,
  subscriptionUpdates: true,
  announcements: true,
}

export function useBuyerNotifPrefs() {
  const [prefs, setPrefs] = useState<BuyerNotifPrefs>(defaultBuyer)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(BUYER_KEY).then((raw) => {
      if (raw) {
        try {
          setPrefs({ ...defaultBuyer, ...JSON.parse(raw) })
        } catch {}
      }
      setLoaded(true)
    })
  }, [])

  const update = useCallback((patch: Partial<BuyerNotifPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      AsyncStorage.setItem(BUYER_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  return { prefs, update, loaded }
}

export function useSellerNotifPrefs() {
  const [prefs, setPrefs] = useState<SellerNotifPrefs>(defaultSeller)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(SELLER_KEY).then((raw) => {
      if (raw) {
        try {
          setPrefs({ ...defaultSeller, ...JSON.parse(raw) })
        } catch {}
      }
      setLoaded(true)
    })
  }, [])

  const update = useCallback((patch: Partial<SellerNotifPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      AsyncStorage.setItem(SELLER_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  return { prefs, update, loaded }
}