import api from '@/constants/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SESSION_KEY = 'plazore_showroom_session'

export async function getShowroomSessionId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(SESSION_KEY)
    if (existing) return existing
  } catch {
    // ignore storage errors
  }

  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  try {
    await AsyncStorage.setItem(SESSION_KEY, id)
  } catch {
    // ignore storage errors
  }

  return id
}

export async function saveShowroomSessionId(id: string) {
  if (!id) return
  try {
    await AsyncStorage.setItem(SESSION_KEY, id)
  } catch {
    // ignore storage errors
  }
}

export async function trackShowroomEvent(opts: {
  productId: string
  type: 'impression' | 'open' | 'cart' | 'wishlist' | 'purchase' | 'skip'
  room?: number
  position?: number
  region?: string
}) {
  try {
    if (!opts.productId || !opts.type) return

    const sessionId = await getShowroomSessionId()

    await api.post('/products/showroom/event', {
      sessionId,
      productId: opts.productId,
      type: opts.type,
      room: opts.room,
      position: opts.position ?? 0,
      region: opts.region || 'NG',
    })
  } catch {
    // never block UI for analytics
  }
}