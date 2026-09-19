"use client";

import { useAuth, useUser, SignInButton } from "@clerk/nextjs";
import { Poppins } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import { Button, cn } from "@/components/ui";
import { markAdminSessionLive } from "@/components/auth/AdminSessionGate";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type Preview = {
  name: string;
  email: string;
  role: string;
  invitedByName?: string;
  expiresAt?: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  moderation_admin: "Moderation Admin",
  marketing_admin: "Marketing Admin",
  finance_admin: "Finance Admin",
  support_admin: "Support Admin",
};

function AcceptInner() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  const signedEmail =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";

  const loadPreview = useCallback(async () => {
    if (!token) {
      setError("Missing invitation token.");
      setLoading(false);
      return;
    }
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const t = await getToken();
      const res = await adminFetch<{ success: boolean; data: Preview }>(
        `/admin/team/invitations/preview?token=${encodeURIComponent(token)}`,
        t
      );
      setPreview(res.data);
    } catch (e: any) {
      setError(e?.message || "Invalid or expired invitation");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [token, isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void loadPreview();
  }, [isLoaded, loadPreview]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const t = await getToken();
      await adminFetch("/admin/team/invitations/accept", t, {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      markAdminSessionLive();
      setDone(true);
      window.setTimeout(() => {
        router.replace("/overview");
      }, 1200);
    } catch (e: any) {
      setError(e?.message || "Could not accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  const emailMatch =
    preview &&
    signedEmail &&
    signedEmail === preview.email.toLowerCase();

  return (
    <div
      className={cn(
        "flex min-h-dvh items-center justify-center bg-[#090B0F] px-4 py-10",
        poppins.className
      )}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#0E1117] p-6 shadow-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
          Plazore Admin
        </p>
        <h1 className="mt-2 text-xl font-semibold text-white">
          Accept invitation
        </h1>

        {!isLoaded || loading ? (
          <div className="flex justify-center py-16">
            <OrbLoader />
          </div>
        ) : done ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#00E575]" />
            <p className="mt-4 font-semibold text-white">Access activated</p>
            <p className="mt-1 text-sm text-[#A7ADB8]">
              Redirecting to the admin dashboard…
            </p>
          </div>
        ) : !isSignedIn ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-relaxed text-[#A7ADB8]">
              Sign in with the <strong className="text-white">exact email</strong>{" "}
              this invitation was sent to. A different account cannot accept it.
            </p>
            <SignInButton mode="redirect" forceRedirectUrl={typeof window !== "undefined" ? window.location.href : "/invite/accept"}>
              <Button className="h-12 w-full rounded-xl bg-[#00E575] font-semibold text-[#041412]">
                Sign in to continue
              </Button>
            </SignInButton>
          </div>
        ) : error && !preview ? (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="flex gap-2 text-red-200">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : preview ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm">
              <Row label="Invitee" value={preview.name} />
              <Row label="Email" value={preview.email} />
              <Row
                label="Role"
                value={ROLE_LABELS[preview.role] || preview.role}
              />
              {preview.invitedByName ? (
                <Row label="Invited by" value={preview.invitedByName} />
              ) : null}
              {preview.expiresAt ? (
                <Row
                  label="Expires"
                  value={new Date(preview.expiresAt).toLocaleString()}
                />
              ) : null}
            </div>

            {!emailMatch ? (
              <div className="flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  You are signed in as <strong>{signedEmail || "unknown"}</strong>.
                  Switch to <strong>{preview.email}</strong> to accept this
                  invitation.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : null}

            <Button
              className="h-12 w-full rounded-xl bg-[#00E575] font-semibold text-[#041412] disabled:opacity-40"
              disabled={!emailMatch || accepting}
              onClick={() => void accept()}
            >
              {accepting ? "Activating…" : "Accept invitation"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-white/40">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#090B0F]">
          <OrbLoader />
        </div>
      }
    >
      <AcceptInner />
    </Suspense>
  );
}