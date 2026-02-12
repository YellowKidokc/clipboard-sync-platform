import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export type AuthedRequest = Request & { userId?: string };

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(auth.replace("Bearer ", ""), process.env.JWT_SECRET ?? "dev-secret") as { sub: string };
      req.userId = payload.sub;
      next();
      return;
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
  }

  const apiKeyHeader = req.headers["x-api-key"] ?? (auth?.startsWith("ApiKey ") ? auth.replace("ApiKey ", "") : undefined);
  if (apiKeyHeader) {
    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.apiKey, apiKey)).limit(1);
    if (user?.id) {
      req.userId = user.id;
      next();
      return;
    }
  }

  res.status(401).json({ error: "Missing or invalid credentials" });
}
