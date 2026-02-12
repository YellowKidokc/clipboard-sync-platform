import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { clips, folders } from "../db/schema.js";
import type { AuthedRequest } from "../middleware/auth.js";

const router = Router();
const folderSchema = z.object({ name: z.string(), path_template: z.string() });

router.get("/", async (req: AuthedRequest, res) => {
  res.json({ folders: await db.select().from(folders).where(eq(folders.userId, req.userId!)) });
});
router.post("/", async (req: AuthedRequest, res) => {
  const input = folderSchema.parse(req.body);
  const [row] = await db.insert(folders).values({ userId: req.userId!, name: input.name, pathTemplate: input.path_template }).returning();
  res.status(201).json(row);
});
router.put("/:id", async (req: AuthedRequest, res) => {
  const input = folderSchema.partial().parse(req.body);
  const [row] = await db.update(folders).set({ name: input.name, pathTemplate: input.path_template }).where(and(eq(folders.id, req.params.id), eq(folders.userId, req.userId!))).returning();
  res.json(row);
});
router.delete("/:id", async (req: AuthedRequest, res) => {
  await db.delete(folders).where(and(eq(folders.id, req.params.id), eq(folders.userId, req.userId!)));
  res.status(204).send();
});
router.get("/:id/clips", async (req: AuthedRequest, res) => {
  res.json({ clips: await db.select().from(clips).where(and(eq(clips.userId, req.userId!), eq(clips.folderId, req.params.id))) });
});

export default router;
