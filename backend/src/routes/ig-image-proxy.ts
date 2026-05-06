import { Router, Request, Response } from "express";

const router = Router();
const ALLOWED = ["cdninstagram.com", "fbcdn.net", "instagram.com"];

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const target = req.query.url as string | undefined;
  if (!target) {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  const ok = ALLOWED.some((h) => parsed.hostname.endsWith(h));
  if (!ok) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(parsed.toString(), {
      headers: {
        Referer: "https://www.instagram.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: "Upstream fail", status: upstream.status });
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800, immutable"
    );
    res.setHeader("CDN-Cache-Control", "public, max-age=2592000, immutable");
    res.status(200).send(buf);
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
