/**
 * Отправка сообщений через Telegram Bot API.
 * Токен: TELEGRAM_BOT_TOKEN (из @BotFather).
 */

export async function sendTelegramMessage(
  telegramId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const id = telegramId.trim();
  if (!token || !id) {
    return { ok: false, error: "missing_token_or_chat_id" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: id,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error("[telegram] sendMessage failed", res.status, errBody);
      return { ok: false, error: errBody.slice(0, 200) };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[telegram] sendMessage", msg);
    return { ok: false, error: msg };
  }
}
