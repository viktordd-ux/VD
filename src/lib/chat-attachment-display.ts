import type { ChatAttachment } from "@/lib/chat-attachments";
import { isProbablyChatImageFileName } from "@/lib/chat-image-file";

export function isChatImageAttachment(a: ChatAttachment): boolean {
  const m = a.mime?.trim();
  if (m && m.toLowerCase().startsWith("image/")) return true;
  return isProbablyChatImageFileName(a.name);
}
