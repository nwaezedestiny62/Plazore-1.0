import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d11] px-4">
      <div className="w-full max-w-md">
        <p className="mb-2 text-center text-xs font-semibold tracking-[0.2em] text-[#00E575] uppercase">
          Plazore Admin
        </p>
        <SignIn path="/sign-in" routing="path" forceRedirectUrl="/overview" />
      </div>
    </div>
  );
}