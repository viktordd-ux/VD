import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import path from "path";

const BUCKET = "order-files";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Sanitize a filename for safe storage path usage. */
function safeName(originalName: string): string {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 60);
  return `${base}${ext}`;
}

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path (stored in DB as `filePath`).
 */
export async function saveOrderFile(
  orderId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const supabase = getClient();
  const storagePath = `orders/${orderId}/${randomUUID()}_${safeName(originalName)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return storagePath;
}

/**
 * Generate a short-lived signed URL for downloading a file.
 * Expires in 1 hour.
 */
export async function getFileSignedUrl(filePath: string): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);
  if (error || !data) throw new Error(`Signed URL error: ${error?.message}`);
  return data.signedUrl;
}

/**
 * Download a file from Supabase Storage as a Buffer (used for ZIP archive).
 */
export async function downloadFileBuffer(filePath: string): Promise<Buffer> {
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
  if (error || !data) throw new Error(`Download error: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteStorageFile(filePath: string): Promise<void> {
  const supabase = getClient();
  await supabase.storage.from(BUCKET).remove([filePath]);
}

/**
 * Extract the human-readable display name from a storage path.
 * Storage path format: orders/{orderId}/{uuid}_{originalName}
 */
export function displayFilename(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const match = base.match(/^[0-9a-f-]{36}_(.+)$/i);
  return match ? match[1] : base;
}
