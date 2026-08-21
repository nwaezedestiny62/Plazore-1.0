// client/app/(auth)/sign-up.tsx
import { Redirect } from 'expo-router'
export default function SignUpRedirect() {
  return <Redirect href="/sign-in?mode=signup" />
}