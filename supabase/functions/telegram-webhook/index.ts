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
  if (/^\d+$/.test(input)) {
    const days = parseInt(input);
    if (days <= 0) return null;
    return { days, label: `${days} day${days > 1 ? 's' : ''}` };
  }

  const map: Record<string, { days: number; label: string }> = {
    "lifetime": { days: 0, label: "Lifetime" },
    "lt": { days: 0, label: "Lifetime" },
  };

  const match = input.toLowerCase().match(/^(\d+)d$/);
  if (match) {
    const days = parseInt(match[1]);
    if (days <= 0) return null;
    return { days, label: `${days} day${days > 1 ? 's' : ''}` };
  }

  return map[input.toLowerCase()] || null;
}

// Send message to ALL admins
async function sendToAllAdmins(botToken: string, adminChatIds: string[], text: string) {
  await Promise.allSettled(
    adminChatIds.map(id =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id.trim(), text, parse_mode: "HTML" }),
      })
    )
  );
}

function getAdminChatIds() {
  return (Deno.env.get("TELEGRAM_CHAT_ID") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const adminChatIds = getAdminChatIds();

  try {
    if (!botToken || adminChatIds.length === 0) {
      console.error("Telegram bot is not configured with admin chat IDs");
      return new Response("ok", { status: 200 });
    }

    const update = await req.json();
    const message = update?.message;
    if (!message?.text) {
      return new Response("ok", { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    console.log("Chat ID:", chatId, "Admin IDs:", adminChatIds, "Text:", text);

    // Only allow commands from admins
    if (!adminChatIds.includes(String(chatId))) {
      console.log("Unauthorized - chatId not in adminChatIds");
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "⛔ Unauthorized.", parse_mode: "HTML" }),
      });
      return new Response("ok", { status: 200 });
    }

    // /gen <name> <duration>
    if (text.startsWith("/gen") || text.startsWith("/generate")) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) {
        await sendToAllAdmins(
          botToken,
          adminChatIds,
          `❌ <b>Usage:</b>\n<code>/gen &lt;name&gt; &lt;days&gt;</code>\n\n<b>Examples:</b>\n<code>/gen Ahmed 7</code> → 7 din\n<code>/gen Ali 30</code> → 30 din\n<code>/gen VIP lifetime</code> → permanent`
        );
        return new Response("ok", { status: 200 });
      }

      const userName = parts[1];
      const durationInput = parts[2];
      const maxDevices = parseInt(parts[3] || "1") || 1;

      const duration = parseDuration(durationInput);
      if (!duration) {
        await sendToAllAdmins(botToken, adminChatIds,
          `❌ Invalid: <code>${durationInput}</code>\n\nSirf number daalo (1, 2, 7, 30...) ya "lifetime"`
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
        await sendToAllAdmins(botToken, adminChatIds, `❌ DB Error: ${error.message}`);
        return new Response("ok", { status: 200 });
      }

      const expLine = expiresAt
        ? `📅 <b>Exp:</b> ${new Date(expiresAt).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
        : `📅 <b>Exp:</b> Never (Lifetime)`;

      // Send key info to ALL admins
      await sendToAllAdmins(
        botToken,
        adminChatIds,
        `✅ <b>Key Generated for [${userName}]</b>\n\n🔑 <code>${key}</code>\n⏳ <b>Duration:</b> ${duration.label}\n${expLine}\n📱 <b>Max Devices:</b> ${maxDevices}\n\n<i>Key is ready to use!</i>`
      );

      return new Response("ok", { status: 200 });
    }

    // /list — show ALL keys (active + revoked)
    if (text.startsWith("/list")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: keys, error } = await supabase
        .from("access_keys")
        .select("key, label, active, expires_at, device_fingerprints")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        await sendToAllAdmins(botToken, adminChatIds, `❌ Error: ${error.message}`);
        return new Response("ok", { status: 200 });
      }

      if (!keys || keys.length === 0) {
        await sendToAllAdmins(botToken, adminChatIds, "📭 No keys found.");
        return new Response("ok", { status: 200 });
      }

      const activeKeys = keys.filter(k => k.active);
      const revokedKeys = keys.filter(k => !k.active);

      const formatKey = (k: any, i: number) => {
        const devices = k.device_fingerprints?.length || 0;
        const exp = k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Lifetime";
        const status = k.active ? "✅" : "🚫";
        return `${i + 1}. ${status} <b>${k.label}</b>\n   <code>${k.key}</code>\n   📅 ${exp} | 📱 ${devices} device(s)`;
      };

      let msg = `📋 <b>All Keys (${keys.length})</b>\n\n`;
      
      if (activeKeys.length > 0) {
        msg += `<b>✅ Active (${activeKeys.length})</b>\n\n${activeKeys.map(formatKey).join("\n\n")}\n\n`;
      }
      
      if (revokedKeys.length > 0) {
        msg += `<b>🚫 Revoked (${revokedKeys.length})</b>\n\n${revokedKeys.map(formatKey).join("\n\n")}`;
      }

      await sendToAllAdmins(
        botToken,
        adminChatIds,
        msg.trim()
      );

      return new Response("ok", { status: 200 });
    }

    // /revoke <key>
    if (text.startsWith("/revoke")) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendToAllAdmins(botToken, adminChatIds, "❌ Usage: <code>/revoke KEY-CODE</code>");
        return new Response("ok", { status: 200 });
      }

      const targetKey = parts[1].toUpperCase();
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: existing } = await supabase
        .from("access_keys")
        .select("key, label, active, expires_at")
        .eq("key", targetKey)
        .maybeSingle();

      if (!existing) {
        await sendToAllAdmins(botToken, adminChatIds, `❌ Key <code>${targetKey}</code> not found.`);
        return new Response("ok", { status: 200 });
      }

      if (!existing.active) {
        await sendToAllAdmins(botToken, adminChatIds, `⚠️ Key <code>${targetKey}</code> (${existing.label}) is already revoked.`);
        return new Response("ok", { status: 200 });
      }

      const { error } = await supabase
        .from("access_keys")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("key", targetKey);

      if (error) {
        await sendToAllAdmins(botToken, adminChatIds, `❌ Error: ${error.message}`);
      } else {
        const expLine = existing.expires_at 
          ? `📅 Expiry: ${new Date(existing.expires_at).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`
          : `📅 Expiry: Lifetime`;
        // Send revoke notification to ALL admins
        await sendToAllAdmins(
          botToken,
          adminChatIds,
          `🚫 <b>Key Revoked!</b>\n\n🔑 <code>${targetKey}</code>\n👤 ${existing.label}\n${expLine}\n\n<i>This key is now deactivated.</i>`
        );
      }
      return new Response("ok", { status: 200 });
    }

    // /help or /start
    if (text.startsWith("/start") || text.startsWith("/help")) {
      const welcomeMsg =
        `🚀🚀🚀 <b>WELCOME TO DARKSIDEX</b> 🚀🚀🚀\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🔥 <b>A NEW BEGINNING STARTS TODAY!</b> 🔥\n\n` +
        `👑 <b>BOTH ADMINS ARE NOW CONNECTED</b> 👑\n` +
        `💎 Every message, every key, every action —\n` +
        `   <b>BOTH OF YOU WILL SEE EVERYTHING.</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ <b>THE MISSION</b> ⚡\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💪 <b>WORK HARD. STAY UNITED. DOMINATE.</b>\n\n` +
        `🌟 With this hustle, by <b>2026</b> we will become\n` +
        `   <b>MILLIONAIRES TOGETHER!</b> 💰💰💰\n\n` +
        `🎯 Every key sold = one step closer\n` +
        `🎯 Every customer = one brick in our empire\n` +
        `🎯 Every day = a chance to grow stronger\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🤖 <b>DARKSIDEX KEY MANAGER</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<b>📌 Commands:</b>\n\n` +
        `🔑 <code>/gen name days [devices]</code>\n   Generate a new key\n\n` +
        `📋 <code>/list</code>\n   List all keys (active + revoked)\n\n` +
        `🚫 <code>/revoke KEY-CODE</code>\n   Deactivate a key\n\n` +
        `<b>💡 Examples:</b>\n` +
        `<code>/gen Ahmed 7</code> → 7 days\n` +
        `<code>/gen Ali 30 2</code> → 30 days, 2 devices\n` +
        `<code>/gen VIP lifetime</code> → permanent\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔥 <b>LET'S BUILD THE EMPIRE!</b> 🔥\n` +
        `💎 <b>DARKSIDEX — TO THE MOON!</b> 🚀🌙\n` +
        `━━━━━━━━━━━━━━━━━━━━`;

      await sendToAllAdmins(botToken, adminChatIds, welcomeMsg);
      return new Response("ok", { status: 200 });
    }

    // Unknown command
    await sendToAllAdmins(botToken, adminChatIds, "🤔 Unknown command. Send /help for usage.");
    return new Response("ok", { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("ok", { status: 200 });
  }
});
