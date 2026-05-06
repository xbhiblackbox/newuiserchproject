import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const traceId = (req as any).traceId || "unknown";
  console.error(
    JSON.stringify({
      t: new Date().toISOString(),
      level: "error",
      trace: traceId,
      event: "unhandled_error",
      path: req.path,
      err: err.message,
      stack: err.stack?.slice(0, 500),
    })
  );
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error", traceId });
  }
}
