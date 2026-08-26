"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";
const GOOGLE_G = "https://developers.google.com/identity/images/g-logo.png";

type Mode = "login" | "signup";
type Flow = "auth" | "verify-signup" | "verify-2fa" | "forgot" | "forgot-code" | "reset-pw";

function clerkMsg(err: unknown, fallback: string) {
  const e = (err as { errors?: { code?: string; longMessage?: string; message?: string }[] })?.errors?.[0];
  const code = e?.code || "";
  const msg = e?.longMessage || e?.message || (err as Error)?.message || fallback;
  if (code.includes("form_identifier_not_found") || /not found|couldn't find|no account/i.test(String(msg)))
    return "No account found with this email";
  if (code.includes("form_password_incorrect") || /password is incorrect|wrong password|invalid credentials/i.test(String(msg)))
    return "Incorrect password";
  if (code.includes("form_identifier_exists") || /already exists|already been taken/i.test(String(msg)))
    return "An account with this email already exists. Try logging in.";
  if (code.includes("form_code_incorrect") || /incorrect|invalid code|verification code/i.test(String(msg)))
    return "Invalid or expired code";
  if (code.includes("form_password_pwned") || /breached|pwned/i.test(String(msg)))
    return "This password is too common. Choose a stronger one.";
  if (/at least|too short|password/i.test(String(msg)) && /8|length/i.test(String(msg)))
    return "Password must be at least 8 characters";
  return String(msg);
}

export function AuthScreen({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : initialMode);
  const [flow, setFlow] = useState<Flow>("auth");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showSignupPass, setShowSignupPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      setExiting(true);
      router.replace("/auth/continue");
    }
  }, [authLoaded, isSignedIn, router]);

  const finish = () => {
    setExiting(true);
    router.replace("/auth/continue");
  };

  const onLogin = async () => {
    if (!signInLoaded || !signIn) return;
    setFieldError(null);
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPassword) {
      setFieldError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password: loginPassword });
      if (result.status === "complete") {
        await setSignInActive?.({ session: result.createdSessionId });
        finish();
        return;
      }
      if (result.status === "needs_second_factor") {
        await signIn.prepareSecondFactor({ strategy: "email_code" });
        setFlow("verify-2fa");
        return;
      }
      setFieldError("Could not complete sign-in. Try again.");
    } catch (err) {
      setFieldError(clerkMsg(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  const onLogin2fa = async () => {
    if (!signInLoaded || !signIn || !code.trim()) return;
    setLoading(true);
    setFieldError(null);
    try {
      const attempt = await signIn.attemptSecondFactor({ strategy: "email_code", code: code.trim() });
      if (attempt.status === "complete") {
        await setSignInActive?.({ session: attempt.createdSessionId });
        finish();
      } else setFieldError("Verification incomplete");
    } catch (err) {
      setFieldError(clerkMsg(err, "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
    if (!signUpLoaded || !signUp) return;
    setFieldError(null);
    const email = signupEmail.trim().toLowerCase();
    if (!email || !signupPassword) {
      setFieldError("Email and password are required");
      return;
    }
    if (signupPassword.length < 8) {
      setFieldError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password: signupPassword });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setFlow("verify-signup");
    } catch (err) {
      setFieldError(clerkMsg(err, "Sign up failed"));
    } finally {
      setLoading(false);
    }
  };

  const onSignUpVerify = async () => {
    if (!signUpLoaded || !signUp || !code.trim()) return;
    setLoading(true);
    setFieldError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === "complete") {
        await setSignUpActive?.({ session: attempt.createdSessionId });
        finish();
      } else setFieldError("Verification incomplete");
    } catch (err) {
      setFieldError(clerkMsg(err, "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  const onForgotSend = async () => {
    if (!signInLoaded || !signIn) return;
    setFieldError(null);
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setFieldError("Enter the email for your account");
      return;
    }
    setLoading(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email });
      setFlow("forgot-code");
      setCode("");
    } catch (err) {
      setFieldError(clerkMsg(err, "Could not send reset code"));
    } finally {
      setLoading(false);
    }
  };

  const onForgotVerifyCode = async () => {
    if (!signInLoaded || !signIn || !code.trim()) return;
    setLoading(true);
    setFieldError(null);
    try {
      await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code: code.trim() });
      setFlow("reset-pw");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = clerkMsg(err, "Invalid code");
      if (/new password|needs_new_password/i.test(msg)) setFlow("reset-pw");
      else setFieldError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (!signInLoaded || !signIn) return;
    setFieldError(null);
    if (newPassword.length < 8) {
      setFieldError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.resetPassword({ password: newPassword });
      if (result.status === "complete") {
        await setSignInActive?.({ session: result.createdSessionId });
        finish();
        return;
      }
      setLoginPassword("");
      setFlow("auth");
      setMode("login");
    } catch (err) {
      setFieldError(clerkMsg(err, "Could not update password"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (!signInLoaded || !signIn) return;
    setOauthLoading(true);
    setFieldError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/auth/continue",
      });
    } catch (err) {
      const msg = clerkMsg(err, "Could not complete");
      if (!/cancel|dismiss/i.test(msg)) setFieldError(msg);
      setOauthLoading(false);
    }
  };

  if (exiting || !authLoaded) {
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center bg-bg ${poppins.className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="mb-5 h-24 w-24 animate-pulse object-contain" />
        <p className="text-[15px] text-white/72">Taking you in…</p>
      </div>
    );
  }

  const masked = flow === "verify-signup" ? signupEmail.trim() || "your email" : loginEmail.trim() || "your email";
  const heroTitle =
    flow === "verify-signup" || flow === "verify-2fa"
      ? "Verify email"
      : flow === "forgot" || flow === "forgot-code"
        ? "Reset password"
        : flow === "reset-pw"
          ? "New password"
          : mode === "login"
            ? "Login to Plazore"
            : "Join Plazore";
  const heroSub =
    flow === "verify-signup" || flow === "verify-2fa"
      ? `Enter the code we sent to ${masked}`
      : flow === "forgot"
        ? "Enter your account email. We’ll send a reset code."
        : flow === "forgot-code"
          ? `Enter the code sent to ${masked}`
          : flow === "reset-pw"
            ? "Choose a strong password (min. 8 characters)."
            : mode === "login"
              ? "Email, password, or Google — enter the showroom."
              : "Create your account and enter the showroom.";

  const fieldClass = "flex h-[54px] items-center border border-white/14 bg-white/10 px-3.5 focus-within:border-green focus-within:bg-green/6";

  return (
    <div className={`relative min-h-screen bg-bg text-white ${poppins.className}`}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/auth-logo.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-bg/72 to-[#061412]/88" />

      <div className="relative mx-auto max-w-md px-6 pb-16 pt-8">
        <div className="mb-2 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-4.png" alt="Plazore" className="h-10 w-40 object-contain" />
        </div>

        <div className="mb-6 mt-3 text-center">
          <div className="mx-auto mb-3.5 flex h-[88px] w-[88px] items-center justify-center rounded-full">
            <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#17181c]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-[38px] w-[38px] object-contain" />
            </div>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight">{heroTitle}</h1>
          <p className="mt-2 px-2 text-sm leading-[21px] text-white/78">{heroSub}</p>
        </div>

        {fieldError && (
          <div className="mb-3.5 flex items-center gap-2 border border-red-500/40 bg-red-500/18 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-300" />
            <p className="text-[13px] leading-[18px] text-red-200">{fieldError}</p>
          </div>
        )}

        {flow === "auth" && (
          <>
            <div className="relative mb-5 flex h-[54px] bg-white/12 p-1">
              <span
                className="absolute top-1 h-[46px] w-[calc(50%-6px)] bg-white transition-transform duration-300"
                style={{ transform: mode === "signup" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
              />
              <button onClick={() => { setMode("login"); setFieldError(null); setFlow("auth"); }} className={`relative z-10 flex-1 text-base font-semibold ${mode === "login" ? "text-[#0B1220]" : "text-white/65"}`}>
                Login
              </button>
              <button onClick={() => { setMode("signup"); setFieldError(null); setFlow("auth"); }} className={`relative z-10 flex-1 text-base font-semibold ${mode === "signup" ? "text-[#0B1220]" : "text-white/65"}`}>
                Sign Up
              </button>
            </div>

            {mode === "login" ? (
              <div>
                <label className={fieldClass}>
                  <Mail className="mr-2.5 h-[18px] w-[18px] text-white/50" />
                  <input
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); setFieldError(null); }}
                    placeholder="Enter your email"
                    autoComplete="email"
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
                  />
                </label>
                <label className={`${fieldClass} mt-3`}>
                  <Lock className="mr-2.5 h-[18px] w-[18px] text-white/50" />
                  <input
                    type={showLoginPass ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setFieldError(null); }}
                    placeholder="Password"
                    autoComplete="current-password"
                    onKeyDown={(e) => e.key === "Enter" && onLogin()}
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
                  />
                  <button type="button" onClick={() => setShowLoginPass((v) => !v)} className="p-1.5">
                    {showLoginPass ? <EyeOff className="h-5 w-5 text-white/50" /> : <Eye className="h-5 w-5 text-white/50" />}
                  </button>
                </label>
                <button onClick={() => { setFieldError(null); setFlow("forgot"); }} className="mb-3.5 mt-1 ml-auto block text-[13px] font-medium text-green">
                  Forgot password?
                </button>
                <button onClick={onLogin} disabled={loading} className="flex h-14 w-full items-center justify-center text-[17px] font-bold text-[#041412]" style={{ backgroundImage: GRAD }}>
                  {loading ? "…" : "Log in"}
                </button>
              </div>
            ) : (
              <div>
                <label className={fieldClass}>
                  <Mail className="mr-2.5 h-[18px] w-[18px] text-white/50" />
                  <input
                    value={signupEmail}
                    onChange={(e) => { setSignupEmail(e.target.value); setFieldError(null); }}
                    placeholder="Enter your email"
                    autoComplete="email"
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
                  />
                </label>
                <label className={`${fieldClass} mt-3 mb-[18px]`}>
                  <Lock className="mr-2.5 h-[18px] w-[18px] text-white/50" />
                  <input
                    type={showSignupPass ? "text" : "password"}
                    value={signupPassword}
                    onChange={(e) => { setSignupPassword(e.target.value); setFieldError(null); }}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    onKeyDown={(e) => e.key === "Enter" && onSignUp()}
                    className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
                  />
                  <button type="button" onClick={() => setShowSignupPass((v) => !v)} className="p-1.5">
                    {showSignupPass ? <EyeOff className="h-5 w-5 text-white/50" /> : <Eye className="h-5 w-5 text-white/50" />}
                  </button>
                </label>
                <button onClick={onSignUp} disabled={loading} className="flex h-14 w-full items-center justify-center text-[17px] font-bold text-[#041412]" style={{ backgroundImage: GRAD }}>
                  {loading ? "…" : "Continue"}
                </button>
              </div>
            )}

            <div className="my-[18px] flex items-center gap-3">
              <span className="h-px flex-1 bg-white/18" />
              <span className="text-xs text-white/78">{mode === "login" ? "Or continue with" : "Or sign up with"}</span>
              <span className="h-px flex-1 bg-white/18" />
            </div>
            <button
              onClick={onGoogle}
              disabled={oauthLoading}
              className="flex h-[54px] w-full items-center justify-center gap-3 border border-[#E0E0E0] bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={GOOGLE_G} alt="" className="h-5 w-5" />
              <span className="text-[15px] font-semibold text-[#3C4043]">Continue with Google</span>
            </button>
          </>
        )}

        {(flow === "verify-signup" || flow === "verify-2fa") && (
          <>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setFieldError(null); }}
              maxLength={6}
              placeholder="123456"
              className="mb-5 w-full border border-white/14 bg-white/10 py-[18px] text-center text-[26px] font-bold tracking-[0.4em] outline-none"
            />
            <button
              onClick={flow === "verify-signup" ? onSignUpVerify : onLogin2fa}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center text-[17px] font-bold text-[#041412]"
              style={{ backgroundImage: GRAD }}
            >
              {loading ? "…" : flow === "verify-signup" ? "Verify & continue" : "Verify"}
            </button>
            <button onClick={() => { setFlow("auth"); setCode(""); setFieldError(null); }} className="mt-4 w-full text-sm font-medium text-green">
              Back
            </button>
          </>
        )}

        {flow === "forgot" && (
          <>
            <label className={fieldClass}>
              <Mail className="mr-2.5 h-[18px] w-[18px] text-white/50" />
              <input
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); setFieldError(null); }}
                placeholder="Account email"
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
              />
            </label>
            <button onClick={onForgotSend} disabled={loading} className="mt-3 flex h-14 w-full items-center justify-center text-[17px] font-bold text-[#041412]" style={{ backgroundImage: GRAD }}>
              {loading ? "…" : "Send reset code"}
            </button>
            <button onClick={() => { setFlow("auth"); setFieldError(null); }} className="mt-4 w-full text-sm font-medium text-green">
              Back to login
            </button>
          </>
        )}

        {flow === "forgot-code" && (
          <>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setFieldError(null); }}
              maxLength={6}
              placeholder="123456"
              className="mb-5 w-full border border-white/14 bg-white/10 py-[18px] text-center text-[26px] font-bold tracking-[0.4em] outline-none"
            />
            <button onClick={onForgotVerifyCode} disabled={loading} className="flex h-14 w-full items-center justify-center text-[17px] font-bold text-[#041412]" style={{ backgroundImage: GRAD }}>
              {loading ? "…" : "Verify code"}
            </button>
            <button onClick={() => setFlow("forgot")} className="mt-4 w-full text-sm font-medium text-green">
              Resend / change email
            </button>
          </>
        )}

        {flow === "reset-pw" && (
          <>
            <label className={fieldClass}>
              <Lock className="mr-2.5 h-[18px] w-[18px] text-white/50" />
              <input
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setFieldError(null); }}
                placeholder="New password (min. 8)"
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
              />
              <button type="button" onClick={() => setShowNewPass((v) => !v)} className="p-1.5">
                {showNewPass ? <EyeOff className="h-5 w-5 text-white/50" /> : <Eye className="h-5 w-5 text-white/50" />}
              </button>
            </label>
            <label className={`${fieldClass} mt-3 mb-[18px]`}>
              <Lock className="mr-2.5 h-[18px] w-[18px] text-white/50" />
              <input
                type={showNewPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldError(null); }}
                placeholder="Confirm new password"
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
              />
            </label>
            <button onClick={onResetPassword} disabled={loading} className="flex h-14 w-full items-center justify-center text-[17px] font-bold text-[#041412]" style={{ backgroundImage: GRAD }}>
              {loading ? "…" : "Update password"}
            </button>
            <button onClick={() => { setFlow("auth"); setFieldError(null); }} className="mt-4 w-full text-sm font-medium text-green">
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}