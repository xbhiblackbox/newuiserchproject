import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}-${part()}`;
}

function parseDuration(input: string): { days: number; label: string } | null {
  const map: Record<string, { days: number; label: string }> = {
    "1d": { days: 1, label: "1 day" },
    "24h": { days: 1, label: "24 hours" },
    "2d": { days: 2, label: "2 days" },
    "3d": { days: 3, label: "3 days" },
    "7d": { days: 7, label: "7 days" },
    "1w": { days: 7, label: "1 week" },
    "14d": { days: 14, label: "14 days" },
    "2w": { days: 14, label: "2 weeks" },
    "30d": { days: 30, label: "30 days" },
    "1m": { days: 30, label: "1 month" },
    "90d": { days: 90, label: "90 days" },
    "3m": { days: 90, label: "3 months" },
    "365d": { days: 365, label: "1 year" },
    "1y": { days: 365, label: "1 year" },
    "lifetime": { days: 0, label: "Lifetime" },
    "lt": { days: 0, label: "Lifetime" },
  };
  return map[input.toLowerCase()] || null;
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const adminChatIds = (Deno.env.get("TELEGRAM_CHAT_ID") || "").split(",").map(id => id.trim()).filter(Boolean);

  try {
    const update = await req.json();
    const message = update?.message;
    if (!message?.text) {
      return new Response("ok", { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Only allow commands from admins (supports multiple comma-separated IDs)
    if (!adminChatIds.includes(String(chatId))) {
      await sendTelegramMessage(botToken, chatId, "⛔ Unauthorized.");
      return new Response("ok", { status: 200 });
    }

    // /gen <name> <duration>
    // Example: /gen JohnDoe 7d
    if (text.startsWith("/gen") || text.startsWith("/generate")) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `❌ <b>Usage:</b>\n<code>/gen &lt;name&gt; &lt;duration&gt;</code>\n\n<b>Durations:</b> 1d, 2d, 3d, 7d, 14d, 30d, 90d, 365d, lifetime\n\n<b>Example:</b>\n<code>/gen Ahmed 7d</code>`
        );
        return new Response("ok", { status: 200 });
      }

      const userName = parts[1];
      const durationInput = parts[2];
      const maxDevices = parseInt(parts[3] || "1") || 1;

      const duration = parseDuration(durationInput);
      if (!duration) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `❌ Invalid duration: <code>${durationInput}</code>\n\nValid: 1d, 2d, 3d, 7d, 14d, 30d, 90d, 365d, lifetime`
        );
        return new Response("ok", { status: 200 });
      }

      const key = generateKey();
      const now = new Date();
      const expiresAt = duration.days > 0
        ? new Date(now.getTime() + duration.days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error } = await supabase.from("access_keys").insert({
        key,
        label: userName,
        active: true,
        expires_at: expiresAt,
        max_devices: maxDevices,
      });

      if (error) {
        await sendTelegramMessage(botToken, chatId, `❌ DB Error: ${error.message}`);
        return new Response("ok", { status: 200 });
      }

      const expLine = expiresAt
        ? `📅 <b>Exp:</b> ${new Date(expiresAt).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
        : `📅 <b>Exp:</b> Never (Lifetime)`;

      await sendTelegramMessage(
        botToken,
        chatId,
        `✅ <b>Key Generated for [${userName}]</b>\n\n🔑 <code>${key}</code>\n⏳ <b>Duration:</b> ${duration.label}\n${expLine}\n📱 <b>Max Devices:</b> ${maxDevices}\n\n<i>Key is ready to use!</i>`
      );

      return new Response("ok", { status: 200 });
    }

    // /list — show active keys
    if (text.startsWith("/list")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: keys, error } = await supabase
        .from("access_keys")
        .select("key, label, active, expires_at, device_fingerprints")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        await sendTelegramMessage(botToken, chatId, `❌ Error: ${error.message}`);
        return new Response("ok", { status: 200 });
      }

      if (!keys || keys.length === 0) {
        await sendTelegramMessage(botToken, chatId, "📭 No active keys found.");
        return new Response("ok", { status: 200 });
      }

      const lines = keys.map((k, i) => {
        const devices = k.device_fingerprints?.length || 0;
        const exp = k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Lifetime";
        return `${i + 1}. <b>${k.label}</b>\n   <code>${k.key}</code>\n   📅 ${exp} | 📱 ${devices} device(s)`;
      });

      await sendTelegramMessage(
        botToken,
        chatId,
        `📋 <b>Active Keys (${keys.length})</b>\n\n${lines.join("\n\n")}`
      );

      return new Response("ok", { status: 200 });
    }

    // /revoke <key>
    if (text.startsWith("/revoke")) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendTelegramMessage(botToken, chatId, "❌ Usage: <code>/revoke KEY-CODE</code>");
        return new Response("ok", { status: 200 });
      }

      const targetKey = parts[1];
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error } = await supabase
        .from("access_keys")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("key", targetKey);

      if (error) {
        await sendTelegramMessage(botToken, chatId, `❌ Error: ${error.message}`);
      } else {
        await sendTelegramMessage(botToken, chatId, `🚫 Key <code>${targetKey}</code> has been revoked.`);
      }
      return new Response("ok", { status: 200 });
    }

    // /help or /start
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `🤖 <b>DarkSideX Key Manager</b>\n\n` +
        `<b>Commands:</b>\n` +
        `📌 <code>/gen name duration [devices]</code>\n   Generate a new key\n\n` +
        `📋 <code>/list</code>\n   List all active keys\n\n` +
        `🚫 <code>/revoke KEY-CODE</code>\n   Deactivate a key\n\n` +
        `<b>Duration options:</b>\n` +
        `1d, 2d, 3d, 7d, 14d, 30d, 90d, 365d, lifetime\n\n` +
        `<b>Example:</b>\n` +
        `<code>/gen Ahmed 30d 2</code>\n` +
        `→ Creates 30-day key for Ahmed with 2 devices`
      );
      return new Response("ok", { status: 200 });
    }

    // Unknown command
    await sendTelegramMessage(botToken, chatId, "🤔 Unknown command. Send /help for usage.");
    return new Response("ok", { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("ok", { status: 200 });
  }
});
