import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";

export default function SignInPage() {
  return (
    <Suspense>
      <AuthScreen initialMode="login" />
    </Suspense>
  );
}