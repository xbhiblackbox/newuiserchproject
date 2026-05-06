import { Router, Request, Response } from "express";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || `https://${req.get("host")}`;

  if (!botToken) {
    res.status(500).json({ error: "TELEGRAM_BOT_TOKEN missing" });
    return;
  }

  const webhookUrl = `${publicBaseUrl}/functions/v1/telegram-webhook`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await r.json() as Record<string, unknown>;
    res.status(r.ok ? 200 : 502).json(data);
  } catch {
    res.status(500).json({ error: "Failed to set webhook" });
  }
});

export default router;
