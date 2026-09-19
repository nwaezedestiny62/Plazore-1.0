"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  Check,
  Copy,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/api";
import { OrbLoader } from "@/components/OrbLoader";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Input,
  Panel,
  Select,
  cn,
} from "@/components/ui";

const GATE_KEY = "plazore.admin.teamGate.v1";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_TEAM_PASSWORD || "";
const Z_MODAL = 9999;

type EnvKind = "development" | "production" | "unknown";

type AdminRole =
  | "super_admin"
  | "operations_admin"
  | "moderation_admin"
  | "marketing_admin"
  | "finance_admin"
  | "support_admin";

type Administrator = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
  status: string;
  activatedAt?: string;
  lastActiveAt?: string | null;
};

type Invitation = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: string;
  invitedAt?: string;
  expiresAt?: string;
  invitedByName?: string;
  invitedByEmail?: string;
  lastSentAt?: string;
  sendCount?: number;
};

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations",
  moderation_admin: "Moderation",
  marketing_admin: "Marketing",
  finance_admin: "Finance",
  support_admin: "Support",
};

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "operations_admin", label: "Operations Admin" },
  { value: "moderation_admin", label: "Moderation Admin" },
  { value: "marketing_admin", label: "Marketing Admin" },
  { value: "finance_admin", label: "Finance Admin" },
  { value: "support_admin", label: "Support Admin" },
  { value: "super_admin", label: "Super Admin" },
];

function detectEnvFromApi(): EnvKind {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL ||
    "";
  const lower = base.toLowerCase();
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes(":3000")
  )
    return "development";
  if (lower.includes("plazore") || lower.startsWith("https://"))
    return "production";
  if (process.env.NODE_ENV === "development") return "development";
  if (process.env.NODE_ENV === "production") return "production";
  return "unknown";
}

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function roleBadgeTone(
  role: string
): "green" | "warn" | "blue" | "neutral" | "error" {
  if (role === "super_admin") return "green";
  if (role === "moderation_admin") return "warn";
  if (role === "finance_admin") return "blue";
  if (role === "marketing_admin") return "blue";
  return "neutral";
}

function initials(name?: string, email?: string) {
  const n = (name || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
      return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return (email || "?").slice(0, 2).toUpperCase();
}

/* ─── Password gate (same pattern as Currency) ─── */

function TeamGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const env = detectEnvFromApi();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === "1") setUnlocked(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EXPECTED_PASSWORD) {
      setErr("Set NEXT_PUBLIC_ADMIN_TEAM_PASSWORD in .env");
      return;
    }
    if (password === EXPECTED_PASSWORD) {
      try {
        sessionStorage.setItem(GATE_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setErr("");
      return;
    }
    setErr("Incorrect password.");
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  };

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/35">
        <div
          className="h-7 w-7 animate-spin rounded-full border border-white/15 border-t-[#00E575]"
          aria-hidden
        />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 text-[#F5F7FA]">
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-white/10 bg-[#0E1116]/95 p-6 sm:p-8",
            shake && "animate-[plazore-shake_0.4s_ease-in-out]"
          )}
        >
          <div className="h-px bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
          <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <Lock className="h-5 w-5 text-[#00E575]" />
          </div>
          <p className="mt-5 text-[11px] font-semibold tracking-[0.22em] text-[#00E575]">
            RESTRICTED
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Administrators
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            Team management is locked. Enter the access password to invite,
            resend, or revoke administrator access.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge
              tone={
                env === "production"
                  ? "green"
                  : env === "development"
                    ? "warn"
                    : "neutral"
              }
            >
              {env}
            </Badge>
            <Badge tone="neutral">invitation only</Badge>
          </div>
          <form onSubmit={submit} className="mt-7 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access password"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-white/12 bg-[#14181F] px-4 text-sm text-[#F5F7FA] outline-none transition focus:border-[#00E575]/45"
            />
            {err ? <p className="text-xs text-red-400">{err}</p> : null}
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6] text-sm font-extrabold text-[#041412] transition hover:brightness-105"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/* ─── Invite modal ─── */

function InviteModal({
  open,
  onClose,
  busy,
  fullName,
  setFullName,
  email,
  setEmail,
  role,
  setRole,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  role: AdminRole;
  setRole: (v: AdminRole) => void;
  onSubmit: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "flex items-end justify-center sm:items-center sm:p-6",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      style={{ position: "fixed", inset: 0, zIndex: Z_MODAL }}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => !busy && onClose()}
        className={cn(
          "absolute inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full max-w-md flex-col overflow-hidden",
          "rounded-t-3xl border border-white/10 bg-[#0A0D12] shadow-[0_40px_100px_rgba(0,0,0,0.75)] sm:rounded-3xl",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-10 scale-[0.97] opacity-0"
        )}
      >
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />

        <div className="flex items-start justify-between gap-3 px-5 py-5">
          <div className="min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00E575]/10 ring-1 ring-[#00E575]/20">
              <UserPlus className="h-4 w-4 text-[#00E575]" />
            </div>
            <p className="mt-4 text-[10px] font-semibold tracking-[0.22em] text-[#00E575]">
              TEAM
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#F5F7FA]">
              Invite administrator
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#A7ADB8]">
              Access is granted only after they accept while signed in with this
              exact email. The link is single-use and expires.
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/45 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-6">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Full name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Okonkwo"
              disabled={busy}
              className="h-11 rounded-xl border-white/12 bg-[#14181F]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Work email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ada@company.com"
              disabled={busy}
              className="h-11 rounded-xl border-white/12 bg-[#14181F]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Role
            </label>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              disabled={busy}
              className="h-11 w-full rounded-xl border-white/12 bg-[#14181F]"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-[11px] leading-relaxed text-white/35">
              Super Admin can only be assigned by an existing Super Admin.
              Permissions are enforced on the server.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              tone="ghost"
              className="h-11 flex-1 rounded-xl"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="h-11 flex-1 rounded-xl"
              disabled={
                busy ||
                !fullName.trim() ||
                !email.trim() ||
                !email.includes("@")
              }
              onClick={onSubmit}
            >
              {busy ? "Sending…" : "Send invitation"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Main content ─── */

function TeamInner() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [lastAcceptUrl, setLastAcceptUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [admins, setAdmins] = useState<Administrator[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support_admin");

  const load = useCallback(async () => {
    setError("");
    try {
      const token = await getToken();
      if (!token) {
        setError("Session expired. Sign in again.");
        return;
      }
      const res = await adminFetch<{
        success: boolean;
        data: {
          administrators: Administrator[];
          invitations: Invitation[];
        };
      }>("/admin/team", token);
      setAdmins(res.data?.administrators || []);
      setInvites(res.data?.invitations || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load team");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 5000);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const submitInvite = async () => {
    setBusy(true);
    setError("");
    setLastAcceptUrl("");
    try {
      const token = await getToken();
      if (!token) {
        setError("Session expired.");
        return;
      }
      const res = await adminFetch<{
        success: boolean;
        message?: string;
        data?: { acceptUrl?: string; emailSent?: boolean };
      }>("/admin/team/invitations", token, {
        method: "POST",
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
        }),
      });

      if (res.data?.acceptUrl) {
        setLastAcceptUrl(res.data.acceptUrl);
        console.info("[plazore] invite acceptUrl:", res.data.acceptUrl);
        flash(
          res.data.emailSent
            ? "Invitation sent"
            : "Invitation created — email not delivered. Copy the accept link below."
        );
      } else {
        flash(res.message || "Invitation created");
      }
      setInviteOpen(false);
      setFullName("");
      setEmail("");
      setRole("support_admin");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  const resend = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const res = await adminFetch<{
        success: boolean;
        data?: { acceptUrl?: string };
      }>(`/admin/team/invitations/${id}/resend`, token, { method: "POST" });
      if (res.data?.acceptUrl) {
        setLastAcceptUrl(res.data.acceptUrl);
        console.info("[plazore] resent acceptUrl:", res.data.acceptUrl);
        flash("Resent — copy accept link if email did not send");
      } else {
        flash("Invitation resent");
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Revoke this invitation?")) return;
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      await adminFetch(`/admin/team/invitations/${id}/revoke`, token, {
        method: "POST",
      });
      flash("Invitation revoked");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: string, label: string) => {
    if (
      !window.confirm(
        `Deactivate administrator access for ${label}? They will lose admin API access immediately.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      await adminFetch(`/admin/team/members/${id}/deactivate`, token, {
        method: "POST",
      });
      flash("Administrator deactivated");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Deactivate failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <OrbLoader />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-10">
      {/* Header band */}
      <div className="mb-8 overflow-hidden border border-white/[0.08] bg-[#0E1116]/80">
        <div className="h-[2px] bg-gradient-to-r from-[#00E575] via-[#14B8A6] to-[#3B82F6]" />
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00E575]">
              Plazore Admin · Team
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F5F7FA] sm:text-3xl">
              Administrators
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#A7ADB8]">
              Invitation-only access. Members authenticate with their own Clerk
              account; roles and permissions are enforced on the server.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                <Users className="h-3.5 w-3.5 text-[#00E575]" />
                <span className="text-[11px] tabular-nums text-[#A7ADB8]">
                  <span className="font-semibold text-[#F5F7FA]">
                    {admins.length}
                  </span>{" "}
                  active
                </span>
              </div>
              <div className="flex items-center gap-2 border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                <Mail className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] tabular-nums text-[#A7ADB8]">
                  <span className="font-semibold text-[#F5F7FA]">
                    {invites.length}
                  </span>{" "}
                  pending
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              tone="ghost"
              className="h-11 rounded-xl"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              className="h-11 rounded-xl"
              disabled={busy}
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Invite Administrator
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      {msg ? (
        <p className="mb-4 border border-[#00E575]/25 bg-[#00E575]/10 px-4 py-3 text-sm text-[#00E575]">
          {msg}
        </p>
      ) : null}

      {/* Dev accept link when email fails */}
      {lastAcceptUrl ? (
        <Panel className="mb-6 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">
                Accept link
              </p>
              <p className="mt-1 text-[12px] text-[#A7ADB8]">
                Email may not have sent (Resend test mode). Share this only with
                the invitee — single use.
              </p>
              <p className="mt-2 truncate font-mono text-[11px] text-[#F5F7FA]/80">
                {lastAcceptUrl}
              </p>
            </div>
            <Button
              tone="ghost"
              className="h-10 shrink-0 rounded-xl"
              onClick={() => void copyUrl(lastAcceptUrl)}
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#00E575]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </Panel>
      ) : null}

      {/* Active members */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#00E575]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A7ADB8]">
            Active administrators
          </h2>
          <Badge tone="green">{admins.length}</Badge>
        </div>

        {admins.length === 0 ? (
          <EmptyState
            title="No active administrators"
            body="Invite someone, or ensure ADMIN_EMAIL was promoted on server start."
          />
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <Panel
                key={a.id}
                className="group p-0 transition hover:border-white/15"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00E575]/20 via-[#14B8A6]/15 to-[#3B82F6]/20 text-[12px] font-bold text-[#00E575] ring-1 ring-white/10">
                      {initials(a.name, a.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[#F5F7FA]">
                        {a.name || "—"}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-[#A7ADB8]">
                        {a.email}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Badge tone={roleBadgeTone(a.role)}>
                          {ROLE_LABELS[a.role] || a.role}
                        </Badge>
                        <Badge tone="green">Active</Badge>
                        <span className="text-[11px] text-[#737A86]">
                          Added {fmt(a.activatedAt)}
                        </span>
                        <span className="text-[11px] text-[#737A86]">
                          · Last active {fmt(a.lastActiveAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {a.role !== "super_admin" ? (
                    <Button
                      tone="ghost"
                      className="h-10 shrink-0 rounded-xl self-start sm:self-center"
                      disabled={busy}
                      onClick={() =>
                        void deactivate(a.id, a.name || a.email)
                      }
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Deactivate
                    </Button>
                  ) : (
                    <span className="hidden text-[11px] text-white/30 sm:block">
                      Protected
                    </span>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>

      {/* Pending invites */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#A7ADB8]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A7ADB8]">
            Pending invitations
          </h2>
          <Badge tone="warn">{invites.length}</Badge>
        </div>

        {invites.length === 0 ? (
          <EmptyState
            title="No pending invitations"
            body="Use Invite Administrator to send a secure, single-use invite."
          />
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <Panel
                key={inv.id}
                className="p-0 transition hover:border-white/15"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[12px] font-bold text-amber-300 ring-1 ring-amber-500/20">
                      {initials(inv.name, inv.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[#F5F7FA]">
                        {inv.name}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-[#A7ADB8]">
                        {inv.email}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Badge tone={roleBadgeTone(inv.role)}>
                          {ROLE_LABELS[inv.role] || inv.role}
                        </Badge>
                        <Badge tone="warn">Pending</Badge>
                        <span className="text-[11px] text-[#737A86]">
                          Invited {fmt(inv.invitedAt)}
                        </span>
                        <span className="text-[11px] text-[#737A86]">
                          · Expires {fmt(inv.expiresAt)}
                        </span>
                        {inv.invitedByName ? (
                          <span className="text-[11px] text-[#737A86]">
                            · By {inv.invitedByName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-center">
                    <Button
                      tone="ghost"
                      className="h-10 rounded-xl"
                      disabled={busy}
                      onClick={() => void resend(inv.id)}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Resend
                    </Button>
                    <Button
                      tone="danger"
                      className="h-10 rounded-xl"
                      disabled={busy}
                      onClick={() => void revoke(inv.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        busy={busy}
        fullName={fullName}
        setFullName={setFullName}
        email={email}
        setEmail={setEmail}
        role={role}
        setRole={setRole}
        onSubmit={() => void submitInvite()}
      />
    </div>
  );
}

export default function TeamPage() {
  return (
    <TeamGate>
      <TeamInner />
    </TeamGate>
  );
}