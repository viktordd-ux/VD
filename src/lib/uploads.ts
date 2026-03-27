import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

function uploadRoot(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
}

export async function ensureUploadRoot() {
  await fs.mkdir(path.join(uploadRoot(), "orders"), { recursive: true });
}

export async function saveOrderFile(
  orderId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  await ensureUploadRoot();
  const dir = path.join(uploadRoot(), "orders", orderId);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(originalName) || ".bin";
  const name = `${randomUUID()}${ext}`;
  const full = path.join(dir, name);
  await fs.writeFile(full, buffer);
  return path.join("uploads", "orders", orderId, name).replace(/\\/g, "/");
}

export function absoluteFilePath(filePath: string): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
}
