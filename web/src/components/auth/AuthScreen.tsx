"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";
const GOOGLE_G = "https://developers.google.com/identity/images/g-logo.png";

type Mode = "login" | "signup";
type Flow = "auth" | "verify-signup" | "verify-2fa" | "forgot" | "forgot-code" | "reset-pw";

function clerkMsg(err: unknown, fallback: string) {
  const anyErr = err as {
    errors?: { code?: string; longMessage?: string; message?: string }[];
    message?: string;
    longMessage?: string;
    code?: string;
  };
  const e = anyErr?.errors?.[0] || anyErr;
  const code = String(e?.code || "");
  const msg = String(e?.longMessage || e?.message || anyErr?.message || fallback);
  if (code.includes("form_identifier_not_found") || /not found|couldn't find|no account/i.test(msg))
    return "No account found with this email";
  if (code.includes("form_password_incorrect") || /incorrect password|invalid credentials/i.test(msg))
    return "Incorrect password";
  if (code.includes("form_identifier_exists") || /already exists|already been taken/i.test(msg))
    return "An account with this email already exists.";
  if (code.includes("form_code_incorrect") || /invalid code|verification code/i.test(msg))
    return "Invalid or expired code";
  if (code.includes("form_password_pwned") || /breached|pwned/i.test(msg))
    return "This password is too common. Choose a stronger one.";
  if (/at least|too short/i.test(msg) && /8|length|password/i.test(msg))
    return "Password must be at least 8 characters";
  return msg;
}

function isExistingAccount(err: unknown) {
  const s = clerkMsg(err, "");
  return /already exists|already been taken|identifier_exists/i.test(s);
}

function isMissingAccount(err: unknown) {
  const s = clerkMsg(err, "");
  return /no account found|identifier_not_found|couldn't find/i.test(s);
}

export function AuthScreen({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const leaving = useRef(false);

  const [mode, setMode] = useState<Mode>(initialMode);
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
  const [showPass, setShowPass] = useState(false);
  const [keepIn, setKeepIn] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);

  const leaveToPlazore = async (kind?: "in" | "up") => {
    if (leaving.current) return;
    leaving.current = true;
    setExiting(true);
    try {
      if (kind === "up") {
        await signUp?.finalize?.({ navigate: async () => undefined });
      } else {
        await signIn?.finalize?.({ navigate: async () => undefined });
      }
    } catch {
      /* session may already be active — still leave */
    }
    router.replace("/auth/continue");
  };

  useEffect(() => {
    if (authLoaded && isSignedIn) leaveToPlazore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, isSignedIn]);

  const busy = loading || oauthLoading || signInStatus === "fetching" || signUpStatus === "fetching";

  const tryLogin = async (email: string, password: string) => {
    if (!signIn) throw new Error("Clerk did not start. Check web/.env.local and restart.");
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) throw error;
    if (signIn.status === "complete") {
      await leaveToPlazore("in");
      return "done";
    }
    if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      try {
        await signIn.mfa?.sendEmailCode?.();
      } catch {}
      setFlow("verify-2fa");
      return "2fa";
    }
    throw new Error("Could not complete sign-in. Try again.");
  };

  const onLogin = async () => {
    setFieldError(null);
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPassword) {
      setFieldError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const result = await tryLogin(email, loginPassword);
      if (result === "done") return;
    } catch (err) {
      if (isMissingAccount(err)) {
        setSignupEmail(email);
        setSignupPassword(loginPassword);
        setMode("signup");
        setFieldError("No account with this email. Create one below.");
      } else {
        setFieldError(clerkMsg(err, "Invalid email or password"));
      }
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
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
    if (!signUp) {
      setFieldError("Clerk did not start. Check web/.env.local and restart.");
      return;
    }
    setLoading(true);
    try {
      const created = await signUp.password({ emailAddress: email, password: signupPassword });
      if (created?.error) throw created.error;
      if (signUp.status === "complete") {
        await leaveToPlazore("up");
        return;
      }
      await signUp.verifications?.sendEmailCode?.();
      setFlow("verify-signup");
    } catch (err) {
      if (isExistingAccount(err)) {
        setLoginEmail(email);
        setLoginPassword(signupPassword);
        setMode("login");
        try {
          const result = await tryLogin(email, signupPassword);
          if (result === "done") return;
        } catch {
          setFieldError("You already have an account. Sign in with your password.");
        }
      } else {
        setFieldError(clerkMsg(err, "Sign up failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const onLogin2fa = async () => {
    if (!signIn) return;
    if (!code.trim()) {
      setFieldError("Enter the code");
      return;
    }
    setLoading(true);
    setFieldError(null);
    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (error) throw error;
      if (signIn.status === "complete") await leaveToPlazore("in");
      else setFieldError("Verification incomplete");
    } catch (err) {
      setFieldError(clerkMsg(err, "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  const onSignUpVerify = async () => {
    if (!signUp) return;
    if (!code.trim()) {
      setFieldError("Enter the code");
      return;
    }
    setLoading(true);
    setFieldError(null);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (error) throw error;
      if (signUp.status === "complete") await leaveToPlazore("up");
      else setFieldError("Verification incomplete");
    } catch (err) {
      setFieldError(clerkMsg(err, "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  const onForgotSend = async () => {
    if (!signIn) {
      setFieldError("Clerk did not start. Check web/.env.local and restart.");
      return;
    }
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setFieldError("Enter the email for your account");
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      const si = signIn as unknown as {
        resetPasswordEmailCode?: { sendCode: (a: { emailAddress: string }) => Promise<{ error?: unknown }> };
      };
      if (si.resetPasswordEmailCode?.sendCode) {
        const { error } = await si.resetPasswordEmailCode.sendCode({ emailAddress: email });
        if (error) throw error;
      }
      setFlow("forgot-code");
      setCode("");
    } catch (err) {
      setFieldError(clerkMsg(err, "Could not send reset code"));
    } finally {
      setLoading(false);
    }
  };

  const onForgotVerifyCode = async () => {
    if (!signIn) return;
    if (!code.trim()) {
      setFieldError("Enter the code");
      return;
    }
    setLoading(true);
    setFieldError(null);
    try {
      const si = signIn as unknown as {
        resetPasswordEmailCode?: { verifyCode: (a: { code: string }) => Promise<{ error?: unknown }> };
      };
      if (si.resetPasswordEmailCode?.verifyCode) {
        const { error } = await si.resetPasswordEmailCode.verifyCode({ code: code.trim() });
        if (error) throw error;
      }
      setFlow("reset-pw");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setFieldError(clerkMsg(err, "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (!signIn) return;
    if (newPassword.length < 8) {
      setFieldError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("Passwords do not match");
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      const si = signIn as unknown as {
        resetPassword?: (a: { password: string }) => Promise<{ error?: unknown }>;
      };
      const result = await si.resetPassword?.({ password: newPassword });
      if (result?.error) throw result.error;
      if (signIn.status === "complete") {
        await leaveToPlazore("in");
        return;
      }
      setLoginPassword("");
      setFlow("auth");
      setMode("login");
      setFieldError(null);
    } catch (err) {
      setFieldError(clerkMsg(err, "Could not update password"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (!signIn) {
      setFieldError("Clerk did not start. Check web/.env.local and restart.");
      return;
    }
    setOauthLoading(true);
    setFieldError(null);
    try {
      const { error } = await signIn.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: "/sso-callback",
        redirectUrl: "/auth/continue",
      });
      if (error) {
        setFieldError(clerkMsg(error, "Could not complete Google sign-in"));
        setOauthLoading(false);
      }
    } catch (err) {
      const msg = clerkMsg(err, "Could not complete");
      if (!/cancel|dismiss/i.test(msg)) setFieldError(msg);
      setOauthLoading(false);
    }
  };

  if (exiting || !authLoaded || isSignedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090B0F]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="mb-5 h-20 w-20 object-contain" />
        <p className="text-[15px] text-white/72">Entering Plazore…</p>
      </div>
    );
  }

  const email = mode === "login" ? loginEmail : signupEmail;
  const password = mode === "login" ? loginPassword : signupPassword;
  const setEmail = mode === "login" ? setLoginEmail : setSignupEmail;
  const setPassword = mode === "login" ? setLoginPassword : setSignupPassword;
  const submit = mode === "login" ? onLogin : onSignUp;

  const masked = flow === "verify-signup" ? signupEmail.trim() || "your email" : loginEmail.trim() || "your email";

  const title =
    flow === "verify-signup" || flow === "verify-2fa"
      ? "Verify email"
      : flow === "forgot" || flow === "forgot-code"
        ? "Reset password"
        : flow === "reset-pw"
          ? "New password"
          : mode === "login"
            ? "Sign In"
            : "Sign Up";

  const inputLine =
    "w-full border-0 border-b border-white/20 bg-transparent py-2.5 px-2 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-[#00E575]";

  return (
    <div className="grid min-h-screen bg-[#090B0F] text-white lg:grid-cols-2">
      <div className="relative hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/auth-logo.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-[#090B0F]/80" />
        <div className="absolute bottom-10 left-10 right-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-4.png" alt="Plazore" className="h-9 w-auto object-contain opacity-90" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            A quieter way to discover what matters.
          </p>
        </div>
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            backgroundImage: "url(/auth-logo.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[#090B0F]/88 lg:bg-transparent" />

        <div className="relative z-10 w-full max-w-[380px]">
          <div className="mb-10 flex justify-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-4.png" alt="Plazore" className="h-9 w-auto object-contain" />
          </div>

          {flow === "auth" && (
            <div className="mb-10 flex items-end justify-center gap-10">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setFlow("auth");
                  setFieldError(null);
                }}
                className={`pb-2 text-[22px] font-semibold tracking-tight ${
                  mode === "login" ? "border-b-2 border-[#00E575] text-white" : "text-white/35"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setFlow("auth");
                  setFieldError(null);
                }}
                className={`pb-2 text-[22px] font-semibold tracking-tight ${
                  mode === "signup" ? "border-b-2 border-[#00E575] text-white" : "text-white/35"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {flow !== "auth" && (
            <h1 className="mb-8 text-center text-[22px] font-semibold tracking-tight">{title}</h1>
          )}

          {fieldError ? (
            <div className="mb-6 flex items-start gap-2 border border-red-500/35 bg-red-500/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <p className="text-[13px] leading-[18px] text-red-200">{fieldError}</p>
            </div>
          ) : null}

          {flow === "auth" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="space-y-6"
            >
              <label className="block">
                <span className="text-[12px] text-white/45">Your email</span>
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldError(null);
                  }}
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  className={inputLine}
                />
              </label>

              <label className="block">
                <span className="text-[12px] text-white/45">Your password</span>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldError(null);
                    }}
                    type={showPass ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    className={`${inputLine} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white/40"
                    aria-label="Toggle password"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {mode === "login" && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setKeepIn((v) => !v)}
                    className="flex items-center gap-2 text-[13px] text-white/55"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        keepIn ? "border-[#00E575] bg-[#00E575]" : "border-white/30"
                      }`}
                    >
                      {keepIn ? <span className="h-1.5 w-1.5 rounded-full bg-[#041412]" /> : null}
                    </span>
                    Keep me logged in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFieldError(null);
                      setFlow("forgot");
                    }}
                    className="text-[13px] text-white/55 hover:text-[#00E575]"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === "signup" && (
                <p className="text-[12px] leading-5 text-white/40">
                  Min. 8 characters. Same account works on the Plazore app.
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-full text-[13px] font-extrabold tracking-[0.14em] text-[#041412] disabled:opacity-60"
                style={{ backgroundImage: GRAD }}
              >
                {busy ? "…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
              </button>
            </form>
          )}

          {flow === "auth" && (
            <>
              <div className="my-7 flex items-center gap-4">
                <span className="h-px flex-1 bg-white/12" />
                <span className="text-[12px] uppercase tracking-[0.18em] text-white/35">or</span>
                <span className="h-px flex-1 bg-white/12" />
              </div>
              <button
                type="button"
                onClick={onGoogle}
                disabled={oauthLoading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white text-[13px] font-extrabold tracking-[0.08em] text-[#3C4043] disabled:opacity-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={GOOGLE_G} alt="" className="h-5 w-5" />
                {oauthLoading ? "…" : "CONTINUE WITH GOOGLE"}
              </button>
            </>
          )}

          {(flow === "verify-signup" || flow === "verify-2fa") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                flow === "verify-signup" ? onSignUpVerify() : onLogin2fa();
              }}
            >
              <p className="mb-6 text-center text-sm text-white/55">
                Enter the code we sent to {masked}
              </p>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setFieldError(null);
                }}
                maxLength={6}
                placeholder="123456"
                className="mb-6 w-full border-0 border-b border-white/20 bg-transparent py-3 text-center text-[26px] font-bold tracking-[0.4em] outline-none focus:border-[#00E575]"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-full text-[13px] font-extrabold tracking-[0.14em] text-[#041412]"
                style={{ backgroundImage: GRAD }}
              >
                {busy ? "…" : "VERIFY"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlow("auth");
                  setCode("");
                  setFieldError(null);
                }}
                className="mt-5 w-full text-sm text-[#00E575]"
              >
                Back
              </button>
            </form>
          )}

          {flow === "forgot" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onForgotSend();
              }}
            >
              <label className="block">
                <span className="text-[12px] text-white/45">Your email</span>
                <input
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    setFieldError(null);
                  }}
                  type="email"
                  className={inputLine}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-8 flex h-12 w-full items-center justify-center rounded-full text-[13px] font-extrabold tracking-[0.14em] text-[#041412]"
                style={{ backgroundImage: GRAD }}
              >
                {busy ? "…" : "SEND RESET CODE"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlow("auth");
                  setFieldError(null);
                }}
                className="mt-5 w-full text-sm text-[#00E575]"
              >
                Back to sign in
              </button>
            </form>
          )}

          {flow === "forgot-code" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onForgotVerifyCode();
              }}
            >
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setFieldError(null);
                }}
                maxLength={6}
                placeholder="123456"
                className="mb-6 w-full border-0 border-b border-white/20 bg-transparent py-3 text-center text-[26px] font-bold tracking-[0.4em] outline-none focus:border-[#00E575]"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-full text-[13px] font-extrabold tracking-[0.14em] text-[#041412]"
                style={{ backgroundImage: GRAD }}
              >
                {busy ? "…" : "VERIFY CODE"}
              </button>
              <button type="button" onClick={() => setFlow("forgot")} className="mt-5 w-full text-sm text-[#00E575]">
                Resend / change email
              </button>
            </form>
          )}

          {flow === "reset-pw" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onResetPassword();
              }}
              className="space-y-6"
            >
              <label className="block">
                <span className="text-[12px] text-white/45">New password</span>
                <input
                  type={showPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputLine}
                />
              </label>
              <label className="block">
                <span className="text-[12px] text-white/45">Confirm password</span>
                <input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputLine}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-full text-[13px] font-extrabold tracking-[0.14em] text-[#041412]"
                style={{ backgroundImage: GRAD }}
              >
                {busy ? "…" : "UPDATE PASSWORD"}
              </button>
            </form>
          )}

          <p className="mt-14 text-center text-[11px] tracking-wide text-white/30">
            Privacy · Terms · About
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;