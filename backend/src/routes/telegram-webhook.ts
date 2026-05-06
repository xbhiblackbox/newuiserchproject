import { Router, Request, Response } from "express";
import { query, queryOne, execute } from "../lib/db";
import { sendToAllAdmins, getAdminChatIds } from "../lib/telegram";

const router = Router();

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}-${part()}`;
}

function parseDuration(input: string): { days: number; label: string } | null {
  if (/^\d+$/.test(input)) {
    const days = parseInt(input);
    if (days <= 0) return null;
    return { days, label: `${days} day${days > 1 ? "s" : ""}` };
  }
  const map: Record<string, { days: number; label: string }> = {
    lifetime: { days: 0, label: "Lifetime" },
    lt: { days: 0, label: "Lifetime" },
  };
  const match = input.toLowerCase().match(/^(\d+)d$/);
  if (match) {
    const days = parseInt(match[1]);
    if (days <= 0) return null;
    return { days, label: `${days} day${days > 1 ? "s" : ""}` };
  }
  return map[input.toLowerCase()] || null;
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  // Always return 200 to Telegram immediately
  res.status(200).send("ok");

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatIds = getAdminChatIds();
  if (!botToken || adminChatIds.length === 0) return;

  try {
    const update = req.body;
    const message = update?.message;
    if (!message?.text) return;

    const chatId = String(message.chat.id);
    const text: string = message.text.trim();

    console.log(JSON.stringify({ t: new Date().toISOString(), event: "tg_update", chatId, text: text.slice(0, 80) }));

    if (!adminChatIds.includes(chatId)) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "⛔ Unauthorized.", parse_mode: "HTML" }),
      });
      return;
    }

    // /gen or /generate <name> <duration> [devices]
    if (text.startsWith("/gen") || text.startsWith("/generate")) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendToAllAdmins(botToken, adminChatIds,
          `❌ <b>Usage:</b>\n<code>/gen &lt;name&gt; &lt;days&gt;</code>\n\n<b>Examples:</b>\n<code>/gen Ahmed 7</code> → 7 din\n<code>/gen Ali 30</code> → 30 din\n<code>/gen VIP lifetime</code> → permanent`);
        return;
      }
      const userName = parts[1];
      const durationInput = parts[2];
      const maxDevices = parseInt(parts[3] || "1") || 1;
      const duration = parseDuration(durationInput);
      if (!duration) {
        await sendToAllAdmins(botToken, adminChatIds, `❌ Invalid: <code>${durationInput}</code>\n\nSirf number daalo (1, 2, 7, 30...) ya "lifetime"`);
        return;
      }
      const key = generateKey();
      const now = new Date();
      const expiresAt = duration.days > 0
        ? new Date(now.getTime() + duration.days * 24 * 60 * 60 * 1000).toISOString()
        : null;
      await execute(
        "INSERT INTO access_keys (key, label, active, expires_at, max_devices) VALUES ($1, $2, true, $3, $4)",
        [key, userName, expiresAt, maxDevices]
      );
      const expLine = expiresAt
        ? `📅 <b>Exp:</b> ${new Date(expiresAt).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
        : `📅 <b>Exp:</b> Never (Lifetime)`;
      await sendToAllAdmins(botToken, adminChatIds,
        `✅ <b>Key Generated for [${userName}]</b>\n\n🔑 <code>${key}</code>\n⏳ <b>Duration:</b> ${duration.label}\n${expLine}\n📱 <b>Max Devices:</b> ${maxDevices}\n\n<i>Key is ready to use!</i>`);
      return;
    }

    // /list
    if (text.startsWith("/list")) {
      const keys = await query<{ key: string; label: string; active: boolean; expires_at: string | null; device_fingerprints: string[] }>(
        "SELECT key, label, active, expires_at, device_fingerprints FROM access_keys ORDER BY created_at DESC LIMIT 30"
      );
      if (!keys.length) { await sendToAllAdmins(botToken, adminChatIds, "📭 No keys found."); return; }
      const active = keys.filter((k) => k.active);
      const revoked = keys.filter((k) => !k.active);
      const fmt = (k: any, i: number) => {
        const devices = k.device_fingerprints?.length || 0;
        const exp = k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Lifetime";
        return `${i + 1}. ${k.active ? "✅" : "🚫"} <b>${k.label}</b>\n   <code>${k.key}</code>\n   📅 ${exp} | 📱 ${devices} device(s)`;
      };
      let msg = `📋 <b>All Keys (${keys.length})</b>\n\n`;
      if (active.length) msg += `<b>✅ Active (${active.length})</b>\n\n${active.map(fmt).join("\n\n")}\n\n`;
      if (revoked.length) msg += `<b>🚫 Revoked (${revoked.length})</b>\n\n${revoked.map(fmt).join("\n\n")}`;
      await sendToAllAdmins(botToken, adminChatIds, msg.trim());
      return;
    }

    // /revoke <key>
    if (text.startsWith("/revoke")) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) { await sendToAllAdmins(botToken, adminChatIds, "❌ Usage: <code>/revoke KEY-CODE</code>"); return; }
      const targetKey = parts[1].toUpperCase();
      const existing = await queryOne<{ key: string; label: string; active: boolean; expires_at: string | null }>(
        "SELECT key, label, active, expires_at FROM access_keys WHERE key = $1", [targetKey]
      );
      if (!existing) { await sendToAllAdmins(botToken, adminChatIds, `❌ Key <code>${targetKey}</code> not found.`); return; }
      if (!existing.active) { await sendToAllAdmins(botToken, adminChatIds, `⚠️ Key <code>${targetKey}</code> (${existing.label}) is already revoked.`); return; }
      await execute("UPDATE access_keys SET active=false, updated_at=now() WHERE key=$1", [targetKey]);
      const expLine = existing.expires_at ? `📅 Expiry: ${new Date(existing.expires_at).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}` : `📅 Expiry: Lifetime`;
      await sendToAllAdmins(botToken, adminChatIds,
        `🚫 <b>Key Revoked!</b>\n\n🔑 <code>${targetKey}</code>\n👤 ${existing.label}\n${expLine}\n\n<i>This key is now deactivated.</i>`);
      return;
    }

    // /setapi <key>
    if (text.startsWith("/setapi")) {
      const parts = text.split(/\s+/);
      if (parts.length < 2 || !parts[1]) {
        await sendToAllAdmins(botToken, adminChatIds, `❌ <b>Usage:</b>\n<code>/setapi YOUR_NEW_RAPIDAPI_KEY</code>`);
        return;
      }
      const newKey = parts.slice(1).join("").trim();
      if (newKey.length < 20) { await sendToAllAdmins(botToken, adminChatIds, `❌ Key bahut chhoti lag rahi hai. Sahi RapidAPI key bhejo.`); return; }
      await execute(
        "UPDATE api_settings SET current_key=$1, used_count=0, alerted_warning=false, alerted_urgent=false, period_start=now(), updated_at=now() WHERE id=1",
        [newKey]
      );
      // Invalidate the in-memory active key cache
      const { invalidateActiveKeyCache } = await import("../lib/rapidapi");
      invalidateActiveKeyCache();
      const masked = newKey.length > 10 ? `${newKey.slice(0, 6)}••••${newKey.slice(-4)}` : "••••";
      await sendToAllAdmins(botToken, adminChatIds,
        `✅ <b>NEW RAPIDAPI KEY ACTIVATED!</b>\n\n🔑 <b>Key:</b> <code>${masked}</code>\n📊 <b>Quota:</b> Reset to 0 / 500\n🚀 <b>Status:</b> Live\n\n<i>Within ~30 sec sab instances naya key use karenge.</i>`);
      return;
    }

    // /quota or /status
    if (text.startsWith("/quota") || text.startsWith("/status")) {
      const data = await queryOne<{ monthly_limit: number; used_count: number; period_start: string; current_key: string | null; alerted_warning: boolean; alerted_urgent: boolean; updated_at: string }>(
        "SELECT monthly_limit, used_count, period_start, current_key, alerted_warning, alerted_urgent, updated_at FROM api_settings WHERE id=1"
      );
      if (!data) { await sendToAllAdmins(botToken, adminChatIds, "❌ Status fetch failed."); return; }
      const remaining = Math.max(0, (data.monthly_limit || 0) - (data.used_count || 0));
      const hasCustom = !!(data.current_key && data.current_key.length > 0);
      const keyMasked = hasCustom ? `${data.current_key!.slice(0, 6)}••••${data.current_key!.slice(-4)}` : "Default (env)";
      const pct = Math.round(((data.used_count || 0) / (data.monthly_limit || 1)) * 100);
      const bar = "█".repeat(Math.min(10, Math.round(pct / 10))) + "░".repeat(10 - Math.min(10, Math.round(pct / 10)));
      const warnFlag = data.alerted_urgent ? "🚨 URGENT SENT" : data.alerted_warning ? "⚠️ WARNING SENT" : "✅ Normal";
      await sendToAllAdmins(botToken, adminChatIds,
        `📊 <b>DARKSIDEX • API STATUS</b>\n━━━━━━━━━━━━━━━━━━━━\n🔑 <b>Active Key:</b> <code>${keyMasked}</code>\n📦 <b>Source:</b> ${hasCustom ? "Custom (via /setapi)" : "Default env"}\n\n🔢 <b>Used:</b> ${data.used_count} / ${data.monthly_limit} (${pct}%)\n🟢 <b>Remaining:</b> ${remaining} searches\n📈 <code>${bar}</code>\n\n🚦 <b>Alert State:</b> ${warnFlag}\n📅 <b>Period start:</b> ${new Date(data.period_start).toLocaleString()}\n🕒 <b>Last update:</b> ${new Date(data.updated_at).toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━\n<i>Naya key: </i><code>/setapi NEW_KEY</code>`);
      return;
    }

    // /help or /start
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await sendToAllAdmins(botToken, adminChatIds,
        `🚀🚀🚀 <b>WELCOME TO DARKSIDEX</b> 🚀🚀🚀\n━━━━━━━━━━━━━━━━━━━━\n\n🤖 <b>DARKSIDEX KEY MANAGER</b>\n\n<b>📌 Commands:</b>\n\n🔑 <code>/gen name days [devices]</code>\n   Generate a new key\n\n📋 <code>/list</code>\n   List all keys\n\n🚫 <code>/revoke KEY-CODE</code>\n   Deactivate a key\n\n🔁 <code>/setapi NEW_RAPIDAPI_KEY</code>\n   Replace RapidAPI key\n\n📊 <code>/quota</code>\n   Show RapidAPI usage\n\n<b>💡 Examples:</b>\n<code>/gen Ahmed 7</code> → 7 days\n<code>/gen Ali 30 2</code> → 30 days, 2 devices\n<code>/gen VIP lifetime</code> → permanent\n\n━━━━━━━━━━━━━━━━━━━━\n💎 <b>DARKSIDEX — TO THE MOON!</b> 🚀🌙`);
      return;
    }

    await sendToAllAdmins(botToken, adminChatIds, "🤔 Unknown command. Send /help for usage.");
  } catch (err: any) {
    console.error("[telegram-webhook] error:", err.message);
  }
});

export default router;
