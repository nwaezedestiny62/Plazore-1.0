// client/app/(auth)/_layout.tsx
import { Stack } from 'expo-router'

export default function AuthRoutesLayout() {
  // Do not redirect when signed in.
  // afterAuthNavigate decides: /complete-profile vs /(tabs)
  return <Stack screenOptions={{ headerShown: false }} />
}