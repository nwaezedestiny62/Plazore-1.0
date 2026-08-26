import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthScreen initialMode="signup" />
    </Suspense>
  );
}