import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) {
    console.warn("[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — announcement media uploads will fail until set.");
}
/** Service-role client (server only — never expose this key to the browser) */
export const supabaseAdmin = url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
export const ANNOUNCEMENTS_BUCKET = process.env.SUPABASE_ANNOUNCEMENTS_BUCKET || "announcements";
