/**
 * server/utils/sendExpoPush.ts
 * Posts to Expo Push API. No third-party SDK required.
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
    console.warn("[sendExpoPush] invalid token shape");
    return false;
  }

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title: opts.title,
        body: opts.body,
        data: opts.data || {},
        sound: opts.sound === null ? null : "default",
        priority: opts.priority === "high" ? "high" : "default",
        channelId: opts.channelId || "plazore_default",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[sendExpoPush] HTTP", res.status, text);
      return false;
    }

    const json: any = await res.json().catch(() => null);
    const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;
    if (ticket?.status === "error") {
      console.error("[sendExpoPush] ticket error", ticket);
      return false;
    }
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
