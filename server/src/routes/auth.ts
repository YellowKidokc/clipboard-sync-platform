import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { jwtSecret } from "../config.js";
import { generateApiKey } from "../services/api-key.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();
const authSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

router.post("/register", asyncHandler(async (req, res) => {
  const input = authSchema.parse(req.body);
  const hashedPassword = await bcrypt.hash(input.password, 10);
  const [user] = await db.insert(users).values({ email: input.email, hashedPassword }).returning({ id: users.id, email: users.email });
  const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "7d" });
  res.status(201).json({ user, token });
}));

router.post("/login", asyncHandler(async (req, res) => {
  const input = authSchema.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user || !(await bcrypt.compare(input.password, user.hashedPassword))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "7d" });
  res.json({ token });
}));

/**
 * Issues an API key for the desktop agent and hotkey script. The plaintext key
 * is returned once and only its SHA-256 digest is stored, so a lost key is
 * replaced rather than recovered. Calling this again invalidates the previous
 * key.
 */
router.post("/api-key", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const { key, hash } = generateApiKey();
  await db.update(users).set({ apiKeyHash: hash }).where(eq(users.id, req.userId!));
  res.status(201).json({ api_key: key, note: "Store this now - it is not shown again." });
}));

router.delete("/api-key", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  await db.update(users).set({ apiKeyHash: null }).where(eq(users.id, req.userId!));
  res.status(204).send();
}));

export default router;
