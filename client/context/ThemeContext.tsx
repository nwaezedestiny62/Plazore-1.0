import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useColorScheme } from 'react-native'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeContextType = {
  preference: ThemePreference
  isDark: boolean
  setPreference: (p: ThemePreference) => void
  colors: typeof darkColors
}

const STORAGE_KEY = 'plazore_theme_preference'

const darkColors = {
  bg: '#070B12',
  card: '#0C1520',
  border: '#1A2A3A',
  text: '#FFFFFF',
  muted: '#7A93A8',
  subtle: '#5A7088',
  accent: '#DCEBFF',
  iconBg: '#13263B',
}

const lightColors = {
  bg: '#EEF3F8',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  accent: '#0284C7',
  iconBg: '#F1F5F9',
}

const ThemeContext = createContext<ThemeContextType>({
  preference: 'system',
  isDark: true,
  setPreference: () => {},
  colors: darkColors,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') {
        setPreferenceState(v)
      }
    })
  }, [])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {})
  }, [])

  const isDark =
    preference === 'system' ? system !== 'light' : preference === 'dark'

  const value = useMemo(
    () => ({
      preference,
      isDark,
      setPreference,
      colors: isDark ? darkColors : lightColors,
    }),
    [preference, isDark, setPreference]
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}