import { randomUUID } from "crypto";
import { supabaseAdmin, ANNOUNCEMENTS_BUCKET } from "../config/supabase.js";

export type UploadKind = "image" | "video";

/**
 * Upload announcement media to Supabase Storage.
 * Bucket must exist and be public (or you serve signed URLs later).
 */
export async function uploadAnnouncementMedia(
  file: Express.Multer.File,
  kind: UploadKind
): Promise<{ publicUrl: string; path: string }> {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const ext =
    (file.originalname.split(".").pop() || (kind === "video" ? "mp4" : "jpg"))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || (kind === "video" ? "mp4" : "jpg");

  const path = `${kind}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(ANNOUNCEMENTS_BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype || (kind === "video" ? "video/mp4" : "image/jpeg"),
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(ANNOUNCEMENTS_BUCKET)
    .getPublicUrl(path);

  return { publicUrl: data.publicUrl, path };
}