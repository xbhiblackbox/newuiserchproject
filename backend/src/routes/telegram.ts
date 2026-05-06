import { Router, Request, Response } from "express";
import { z } from "zod";
import { broadcastToAdmins, getAdminChatIds } from "../lib/telegram";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getAdminChatIds();

  if (!botToken || chatIds.length === 0) {
    res.status(500).json({ error: "Telegram not configured" });
    return;
  }

  try {
    await broadcastToAdmins(parsed.data.text);
    res.status(200).json({ ok: true, sent_to: chatIds.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
