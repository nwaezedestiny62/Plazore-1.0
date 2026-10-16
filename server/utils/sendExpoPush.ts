/**
 * server/utils/sendExpoPush.ts
 * Always logs Expo ticket so Render shows why a popup did or did not send.
 */

type PushPayload = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  sound?: "default" | null;
};

export async function sendPushToToken(opts: PushPayload): Promise<boolean> {
  const token = String(opts.token || "").trim();
  if (
    !token.startsWith("ExponentPushToken[") &&
    !token.startsWith("ExpoPushToken[")
  ) {
    console.warn("[sendExpoPush] invalid token shape", token.slice(0, 24));
    return false;
  }

  const message: Record<string, unknown> = {
    to: token,
    title: opts.title,
    body: opts.body,
    data: opts.data || {},
    sound: "default",
    priority: "high",
    // Must match the MAX-importance channel created in the app.
    // Old plazore_default was created broken and Android will not upgrade it.
    channelId: "plazore_popup",
  };

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      console.error("[sendExpoPush] HTTP", res.status, text.slice(0, 500));
      return false;
    }

    const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;
    if (ticket?.status === "error") {
      console.error("[sendExpoPush] ticket error", JSON.stringify(ticket));
      return false;
    }

    console.log(
      "[sendExpoPush] ok",
      ticket?.status || "sent",
      ticket?.id || "",
      "token",
      token.slice(0, 28)
    );
    return true;
  } catch (e) {
    console.error("[sendExpoPush] failed", e);
    return false;
  }
}

export async function sendPushToMany(
  tokens: string[],
  opts: Omit<PushPayload, "token">
): Promise<void> {
  await Promise.all(
    tokens.filter(Boolean).map((token) => sendPushToToken({ ...opts, token }))
  );
}