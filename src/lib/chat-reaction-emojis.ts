/** Должен совпадать с проверкой в `/api/messages/[id]/reactions`. */
export const CHAT_REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🔥",
  "👀",
  "🙏",
] as const;

export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number];

export function isAllowedChatReactionEmoji(s: string): s is ChatReactionEmoji {
  return (CHAT_REACTION_EMOJIS as readonly string[]).includes(s);
}
