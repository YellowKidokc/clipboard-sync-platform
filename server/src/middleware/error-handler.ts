import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/** Postgres unique_violation. */
const PG_UNIQUE_VIOLATION = "23505";

function statusOf(error: unknown): number {
  if (error instanceof ZodError) return 400;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
    if (candidate.code === PG_UNIQUE_VIOLATION) return 409;
    const explicit = candidate.status ?? candidate.statusCode;
    if (typeof explicit === "number" && explicit >= 400 && explicit <= 599) return explicit;
  }
  return 500;
}

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  // Headers already flushed (e.g. a stream failed mid-response): only Express can
  // tear the socket down cleanly from here.
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = statusOf(error);

  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    });
    return;
  }

  if (status === 409) {
    res.status(409).json({ error: "Already exists" });
    return;
  }

  if (status >= 500) {
    // Driver errors carry connection strings, host:port and query text. Log them,
    // never ship them to the client.
    console.error("[error]", error);
    res.status(status).json({ error: "Internal server error" });
    return;
  }

  const message = error instanceof Error ? error.message : "Request failed";
  res.status(status).json({ error: message });
}
