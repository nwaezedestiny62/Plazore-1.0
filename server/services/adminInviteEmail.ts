/**
 * Uses Resend if RESEND_API_KEY is set.
 * Without it, invite is still created; accept URL is returned to the inviter
 * (dev only / logged server-side).
 */

type InviteEmailPayload = {
  to: string;
  inviteeName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
};

function roleLabel(role: string) {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function sendAdminInviteEmail(
  payload: InviteEmailPayload
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.ADMIN_INVITE_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    "Plazore Admin <onboarding@resend.dev>";

  const subject = "Plazore Admin invitation";
  const role = roleLabel(payload.role);
  const expires = payload.expiresAt.toUTCString();

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="margin-bottom:8px">You're invited to Plazore Admin</h2>
    <p style="color:#444;line-height:1.5">
      <strong>${escapeHtml(payload.inviterName)}</strong> invited
      <strong>${escapeHtml(payload.inviteeName)}</strong>
      to join the Plazore Admin Web as
      <strong>${escapeHtml(role)}</strong>.
    </p>
    <p style="color:#444;line-height:1.5">
      This grants access to the Plazore Admin dashboard according to that role.
      Do not forward this email — the link is single-use and tied to
      <strong>${escapeHtml(payload.to)}</strong>.
    </p>
    <p style="margin:28px 0">
      <a href="${payload.acceptUrl}"
         style="display:inline-block;background:#00E575;color:#041412;font-weight:700;
                text-decoration:none;padding:12px 20px;border-radius:10px">
        Accept Invitation
      </a>
    </p>
    <p style="color:#666;font-size:13px">Expires: ${expires}</p>
    <p style="color:#999;font-size:12px;margin-top:24px">
      If you did not expect this, ignore this email. The invitation will expire automatically.
    </p>
  </div>`;

  if (!apiKey) {
    console.warn(
      "[admin-invite] RESEND_API_KEY not set. Invite URL:",
      payload.acceptUrl
    );
    return { sent: false, error: "Email provider not configured (RESEND_API_KEY)" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[admin-invite] Resend error:", res.status, body);
      return { sent: false, error: `Email failed (${res.status})` };
    }
    return { sent: true };
  } catch (e: any) {
    console.error("[admin-invite] send failed:", e?.message || e);
    return { sent: false, error: e?.message || "Email send failed" };
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}