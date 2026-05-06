import { Request, Response, NextFunction } from "express";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-trace-id, x-replay-of, x-access-key, x-device-fp",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PATCH, DELETE",
  "Access-Control-Expose-Headers":
    "x-trace-id, x-cache, x-cache-age, x-duration-ms, x-cache-heatmap, x-cache-stats",
};

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Apply all CORS headers to every response
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") {
    res.status(200).send("ok");
    return;
  }
  next();
}
