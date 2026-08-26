"use client";

import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";

const GRAD = "linear-gradient(90deg,#00E575,#14B8A6,#3B82F6)";
const GOOGLE_G = "https://developers.google.com/identity/images/g-logo.png";
const BG = "#090B0F";
const GREEN = "#00E575";

type Mode = "login" | "signup";
type Flow = "auth" | "verify-signup" | "verify-2fa" | "forgot" | "forgot-code" | "reset-pw";

function clerkMsg(err: unknown, fallback: string) {
  const anyErr = err as { errors?: { code?: string; longMessage?: string; message?: string }[]; message?: string };
  const e = anyErr?.errors?.[0];
  const code = e?.code || "";
  const msg = e?.longMessage || e?.message || anyErr?.message || fallback;
  const s = String(msg);
  if (code.includes("form_identifier_not_found") || /not found|couldn't find|no account/i.test(s))
    return "No account found with this email";
  if (code.includes("form_password_incorrect") || /password is incorrect|wrong password|invalid credentials/i.test(s))
    return "Incorrect password";
  if (code.includes("form_identifier_exists") || /already exists|already been taken/i.test(s))
    return "An account with this email already exists. Try logging in.";
  if (code.includes("form_code_incorrect") || /incorrect|invalid code|verification code/i.test(s))
    return "Invalid or expired code";
  if (code.includes("form_password_pwned") || /breached|pwned/i.test(s))
    return "This password is too common. Choose a stronger one.";
  if (/at least|too short/i.test(s) && /8|length|password/i.test(s))
    return "Password must be at least 8 characters";
  return s;
}

export default function AuthScreen({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

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
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      } as Parameters<typeof signIn.create>[0]);
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
      await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
      });
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

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    height: 54,
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.1)",
    padding: "0 14px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    color: "#fff",
    fontSize: 15,
    outline: "none",
    border: "none",
  };

  const ctaStyle: React.CSSProperties = {
    display: "flex",
    height: 56,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    fontWeight: 800,
    color: "#041412",
    backgroundImage: GRAD,
    border: "none",
    cursor: "pointer",
  };

  if (exiting || !authLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <img src="/logo.png" alt="" style={{ width: 96, height: 96, marginBottom: 20, objectFit: "contain" }} />
        <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 15 }}>Taking you in…</p>
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

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: BG, color: "#fff" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/auth-logo.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(5,8,12,0.55), rgba(9,11,15,0.72), rgba(6,20,18,0.88))",
        }}
      />

      <div style={{ position: "relative", maxWidth: 448, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <img src="/logo-4.png" alt="Plazore" style={{ height: 40, width: 160, objectFit: "contain" }} />
        </div>

        <div style={{ textAlign: "center", margin: "12px 0 24px" }}>
          <div style={{ width: 88, height: 88, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 68, height: 68, borderRadius: 34, background: "#17181c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/logo.png" alt="" style={{ width: 38, height: 38, objectFit: "contain" }} />
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4, margin: 0 }}>{heroTitle}</h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: "21px", color: "rgba(255,255,255,0.78)" }}>{heroSub}</p>
        </div>

        {fieldError && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, padding: "10px 12px", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.18)" }}>
            <AlertCircle size={16} color="#FCA5A5" />
            <p style={{ margin: 0, fontSize: 13, lineHeight: "18px", color: "#FECACA" }}>{fieldError}</p>
          </div>
        )}

        {flow === "auth" && (
          <>
            <div style={{ position: "relative", display: "flex", height: 54, background: "rgba(255,255,255,0.12)", padding: 4, marginBottom: 20 }}>
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  height: 46,
                  width: "calc(50% - 6px)",
                  background: "#fff",
                  transform: mode === "signup" ? "translateX(calc(100% + 4px))" : "translateX(0)",
                  transition: "transform 0.3s",
                }}
              />
              <button
                type="button"
                onClick={() => { setMode("login"); setFieldError(null); setFlow("auth"); }}
                style={{ flex: 1, position: "relative", zIndex: 2, background: "none", border: "none", fontSize: 16, fontWeight: 600, color: mode === "login" ? "#0B1220" : "rgba(255,255,255,0.65)", cursor: "pointer" }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setFieldError(null); setFlow("auth"); }}
                style={{ flex: 1, position: "relative", zIndex: 2, background: "none", border: "none", fontSize: 16, fontWeight: 600, color: mode === "signup" ? "#0B1220" : "rgba(255,255,255,0.65)", cursor: "pointer" }}
              >
                Sign Up
              </button>
            </div>

            {mode === "login" ? (
              <div>
                <label style={fieldStyle}>
                  <Mail size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
                  <input
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); setFieldError(null); }}
                    placeholder="Enter your email"
                    autoComplete="email"
                    style={inputStyle}
                  />
                </label>
                <label style={{ ...fieldStyle, marginTop: 12 }}>
                  <Lock size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
                  <input
                    type={showLoginPass ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setFieldError(null); }}
                    placeholder="Password"
                    autoComplete="current-password"
                    onKeyDown={(e) => e.key === "Enter" && onLogin()}
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowLoginPass((v) => !v)} style={{ background: "none", border: "none", padding: 6, cursor: "pointer" }}>
                    {showLoginPass ? <EyeOff size={20} color="rgba(255,255,255,0.5)" /> : <Eye size={20} color="rgba(255,255,255,0.5)" />}
                  </button>
                </label>
                <button
                  type="button"
                  onClick={() => { setFieldError(null); setFlow("forgot"); }}
                  style={{ display: "block", marginLeft: "auto", marginTop: 4, marginBottom: 14, background: "none", border: "none", color: GREEN, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                >
                  Forgot password?
                </button>
                <button type="button" onClick={onLogin} disabled={loading} style={ctaStyle}>
                  {loading ? "…" : "Log in"}
                </button>
              </div>
            ) : (
              <div>
                <label style={fieldStyle}>
                  <Mail size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
                  <input
                    value={signupEmail}
                    onChange={(e) => { setSignupEmail(e.target.value); setFieldError(null); }}
                    placeholder="Enter your email"
                    autoComplete="email"
                    style={inputStyle}
                  />
                </label>
                <label style={{ ...fieldStyle, marginTop: 12, marginBottom: 18 }}>
                  <Lock size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
                  <input
                    type={showSignupPass ? "text" : "password"}
                    value={signupPassword}
                    onChange={(e) => { setSignupPassword(e.target.value); setFieldError(null); }}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    onKeyDown={(e) => e.key === "Enter" && onSignUp()}
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowSignupPass((v) => !v)} style={{ background: "none", border: "none", padding: 6, cursor: "pointer" }}>
                    {showSignupPass ? <EyeOff size={20} color="rgba(255,255,255,0.5)" /> : <Eye size={20} color="rgba(255,255,255,0.5)" />}
                  </button>
                </label>
                <button type="button" onClick={onSignUp} disabled={loading} style={ctaStyle}>
                  {loading ? "…" : "Continue"}
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
              <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.18)" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.78)" }}>
                {mode === "login" ? "Or continue with" : "Or sign up with"}
              </span>
              <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.18)" }} />
            </div>
            <button
              type="button"
              onClick={onGoogle}
              disabled={oauthLoading}
              style={{ display: "flex", height: 54, width: "100%", alignItems: "center", justifyContent: "center", gap: 12, background: "#fff", border: "1px solid #E0E0E0", cursor: "pointer" }}
            >
              <img src={GOOGLE_G} alt="" width={20} height={20} />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#3C4043" }}>
                {oauthLoading ? "…" : "Continue with Google"}
              </span>
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
              style={{ width: "100%", marginBottom: 20, padding: "18px 14px", textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: 10, color: "#fff", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)" }}
            />
            <button type="button" onClick={flow === "verify-signup" ? onSignUpVerify : onLogin2fa} disabled={loading} style={ctaStyle}>
              {loading ? "…" : flow === "verify-signup" ? "Verify & continue" : "Verify"}
            </button>
            <button type="button" onClick={() => { setFlow("auth"); setCode(""); setFieldError(null); }} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: GREEN, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              Back
            </button>
          </>
        )}

        {flow === "forgot" && (
          <>
            <label style={fieldStyle}>
              <Mail size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
              <input
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); setFieldError(null); }}
                placeholder="Account email"
                style={inputStyle}
              />
            </label>
            <button type="button" onClick={onForgotSend} disabled={loading} style={{ ...ctaStyle, marginTop: 12 }}>
              {loading ? "…" : "Send reset code"}
            </button>
            <button type="button" onClick={() => { setFlow("auth"); setFieldError(null); }} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: GREEN, fontSize: 14, cursor: "pointer" }}>
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
              style={{ width: "100%", marginBottom: 20, padding: "18px 14px", textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: 10, color: "#fff", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)" }}
            />
            <button type="button" onClick={onForgotVerifyCode} disabled={loading} style={ctaStyle}>
              {loading ? "…" : "Verify code"}
            </button>
            <button type="button" onClick={() => setFlow("forgot")} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: GREEN, fontSize: 14, cursor: "pointer" }}>
              Resend / change email
            </button>
          </>
        )}

        {flow === "reset-pw" && (
          <>
            <label style={fieldStyle}>
              <Lock size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
              <input
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setFieldError(null); }}
                placeholder="New password (min. 8)"
                style={inputStyle}
              />
              <button type="button" onClick={() => setShowNewPass((v) => !v)} style={{ background: "none", border: "none", padding: 6, cursor: "pointer" }}>
                {showNewPass ? <EyeOff size={20} color="rgba(255,255,255,0.5)" /> : <Eye size={20} color="rgba(255,255,255,0.5)" />}
              </button>
            </label>
            <label style={{ ...fieldStyle, marginTop: 12, marginBottom: 18 }}>
              <Lock size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 10 }} />
              <input
                type={showNewPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldError(null); }}
                placeholder="Confirm new password"
                style={inputStyle}
              />
            </label>
            <button type="button" onClick={onResetPassword} disabled={loading} style={ctaStyle}>
              {loading ? "…" : "Update password"}
            </button>
            <button type="button" onClick={() => { setFlow("auth"); setFieldError(null); }} style={{ width: "100%", marginTop: 16, background: "none", border: "none", color: GREEN, fontSize: 14, cursor: "pointer" }}>
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}