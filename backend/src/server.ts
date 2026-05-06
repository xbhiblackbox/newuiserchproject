import express from "express";
import { pino } from "pino";
import { corsMiddleware } from "./middleware/cors";
import { traceIdMiddleware } from "./middleware/traceId";
import { errorHandler } from "./middleware/errorHandler";

// Routes
import checkKeyStatus from "./routes/check-key-status";
import igImageProxy from "./routes/ig-image-proxy";
import integrationCheck from "./routes/integration-check";
import setupWebhook from "./routes/setup-webhook";
import telegramWebhook from "./routes/telegram-webhook";
import telegramRoute from "./routes/telegram";
import instagramScraper from "./routes/instagram-scraper";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

const app = express();

// Middlewares
app.use(express.json());
app.use(corsMiddleware);
app.use(traceIdMiddleware);

// Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    logger.info(`[${req.method}] ${req.url} ${res.statusCode} - ${ms}ms - trace: ${(req as any).traceId}`);
  });
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

// Mount Routes (matching Supabase paths)
app.use("/functions/v1/check-key-status", checkKeyStatus);
app.use("/functions/v1/ig-image-proxy", igImageProxy);
app.use("/functions/v1/integration-check", integrationCheck);
app.use("/functions/v1/setup-webhook", setupWebhook);
app.use("/functions/v1/telegram-webhook", telegramWebhook);
app.use("/functions/v1/telegram", telegramRoute);
app.use("/functions/v1/instagram-scraper", instagramScraper);

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 DarksideX Backend running on port ${PORT}`);
});
