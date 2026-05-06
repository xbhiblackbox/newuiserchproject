import { getAdminChatIds } from "./rapidapi";

export async function sendToAllAdmins(
  botToken: string,
  chatIds: string[],
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<void> {
  await Promise.allSettled(
    chatIds.map((id) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id.trim(), text, parse_mode: parseMode }),
      }).catch(() => null)
    )
  );
}

export async function broadcastToAdmins(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getAdminChatIds();
  if (!botToken || chatIds.length === 0) return;
  await sendToAllAdmins(botToken, chatIds, text);
}

export { getAdminChatIds };
