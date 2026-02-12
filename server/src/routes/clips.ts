import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { clips } from "../db/schema.js";
import { applyRules } from "../engine/rule-engine.js";
import { persistDataUrl } from "../services/blob-storage.js";
import type { AuthedRequest } from "../middleware/auth.js";

const router = Router();

const createClip = z.object({
  content_type: z.string(),
  text_content: z.string().optional(),
  data_url: z.string().optional(),
  tags: z.array(z.string()).optional(),
  device_id: z.string().uuid().optional(),
  folder_id: z.string().uuid().optional(),
  source: z.string().optional(),
  hotkey_slot: z.number().int().min(1).max(12).optional()
});

router.post("/", async (req: AuthedRequest, res) => {
  const input = createClip.parse(req.body);
  const transformed = await applyRules({ userId: req.userId!, contentType: input.content_type, textContent: input.text_content, tags: input.tags, folderId: input.folder_id, source: input.source });
  const id = crypto.randomUUID();
  const blobUrl = input.data_url ? await persistDataUrl(input.data_url, id) : null;
  const [clip] = await db.insert(clips).values({
    id,
    userId: req.userId!,
    deviceId: input.device_id,
    contentType: transformed.contentType,
    textContent: transformed.textContent,
    blobUrl,
    tags: transformed.tags ?? [],
    folderId: transformed.folderId,
    source: input.source ?? "manual",
    hotkeySlot: input.hotkey_slot
  }).returning();
  res.status(201).json(clip);
});

router.get("/", async (req: AuthedRequest, res) => {
  const limit = Number(req.query.limit ?? 50);
  const search = req.query.search ? String(req.query.search) : undefined;
  let where = and(eq(clips.userId, req.userId!), eq(clips.isDeleted, false));
  if (search) where = and(where, ilike(clips.textContent, `%${search}%`));
  if (req.query.before) where = and(where, lt(clips.createdAt, new Date(String(req.query.before))));

  const rows = await db.select().from(clips).where(where).orderBy(desc(clips.createdAt)).limit(limit);
  res.json({ clips: rows });
});

router.get("/hotkeys", async (req: AuthedRequest, res) => {
  const rows = await db.select().from(clips).where(and(eq(clips.userId, req.userId!), sql`${clips.hotkeySlot} is not null`));
  const slots = Object.fromEntries(rows.map((c) => [String(c.hotkeySlot), c]));
  res.json({ slots });
});

router.post("/hotkeys", async (req: AuthedRequest, res) => {
  const body = z.object({ clip_id: z.string().uuid(), slot: z.number().int().min(1).max(12) }).parse(req.body);
  await db.update(clips).set({ hotkeySlot: body.slot, updatedAt: new Date() }).where(and(eq(clips.id, body.clip_id), eq(clips.userId, req.userId!)));
  res.status(204).send();
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const [clip] = await db.select().from(clips).where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!))).limit(1);
  if (!clip) return res.status(404).json({ error: "Not found" });
  res.json(clip);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const patch = z.object({ tags: z.array(z.string()).optional(), is_pinned: z.boolean().optional(), is_starred: z.boolean().optional(), folder_id: z.string().uuid().nullable().optional(), hotkey_slot: z.number().int().min(1).max(12).nullable().optional() }).parse(req.body);
  const [updated] = await db.update(clips).set({ tags: patch.tags, isPinned: patch.is_pinned, isStarred: patch.is_starred, folderId: patch.folder_id ?? undefined, hotkeySlot: patch.hotkey_slot ?? undefined, updatedAt: new Date() }).where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!))).returning();
  res.json(updated);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  await db.update(clips).set({ isDeleted: true, updatedAt: new Date() }).where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!)));
  res.status(204).send();
});

router.post("/:id/copy", async (_req, res) => res.status(204).send());

export default router;
