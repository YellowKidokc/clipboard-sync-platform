import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();
const authSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

router.post("/register", async (req, res) => {
  const input = authSchema.parse(req.body);
  const hashedPassword = await bcrypt.hash(input.password, 10);
  const [user] = await db.insert(users).values({ email: input.email, hashedPassword }).returning({ id: users.id, email: users.email });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET ?? "dev-secret", { expiresIn: "7d" });
  res.status(201).json({ user, token });
});

router.post("/login", async (req, res) => {
  const input = authSchema.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user || !(await bcrypt.compare(input.password, user.hashedPassword))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET ?? "dev-secret", { expiresIn: "7d" });
  res.json({ token });
});

export default router;
