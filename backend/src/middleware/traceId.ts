import { Request, Response, NextFunction } from "express";

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId =
    (req.headers["x-trace-id"] as string) ||
    Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 8);
  (req as any).traceId = traceId;
  res.setHeader("X-Trace-Id", traceId);
  next();
}

export function newTraceId(): string {
  return Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 8);
}
