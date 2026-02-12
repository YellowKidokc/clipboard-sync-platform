import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, lt, sql, type InferSelectModel } from "drizzle-orm";
import { db } from "../db/client.js";
import { aiConversations, clips, devices } from "../db/schema.js";
import { applyRules, type RuleAction } from "../engine/rule-engine.js";
import { persistDataUrl } from "../services/blob-storage.js";
import { runWorkflow, suggestTags } from "../services/ai-service.js";
import { resolveLatestPrediction } from "../engine/predictor.js";
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

type ClipRow = InferSelectModel<typeof clips>;

async function handleRuleActions(actions: RuleAction[], clip: ClipRow): Promise<void> {
  for (const action of actions) {
    if (action.type === "webhook" && action.url) {
      fetch(action.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clip })
      }).catch(() => undefined);
    }
    if (action.type === "ai_call" && clip.textContent) {
      if (action.workflow === "summarize") {
        const output = await runWorkflow("summarize", clip.textContent);
        await db.insert(clips).values({
          userId: clip.userId,
          contentType: "text/plain",
          textContent: output,
          tags: [...new Set([...(clip.tags ?? []), "summary"])],
          folderId: clip.folderId,
          source: "ai_generated"
        });
      } else if (action.workflow === "classify" || action.workflow === "tags") {
        const tags = await suggestTags(clip.textContent);
        await db.update(clips).set({ tags: [...new Set([...(clip.tags ?? []), ...tags])], updatedAt: new Date() }).where(eq(clips.id, clip.id));
      } else {
        const output = await runWorkflow(action.workflow, clip.textContent);
        await db.insert(aiConversations).values([
          { userId: clip.userId, clipId: clip.id, role: "system", content: `Workflow ${action.workflow}`, workflow: action.workflow },
          { userId: clip.userId, clipId: clip.id, role: "assistant", content: output, workflow: action.workflow }
        ]);
      }
    }
  }
}

router.post("/", async (req: AuthedRequest, res) => {
  const input = createClip.parse(req.body);
  const [device] = input.device_id
    ? await db.select().from(devices).where(and(eq(devices.id, input.device_id), eq(devices.userId, req.userId!))).limit(1)
    : [];
  const transformed = await applyRules(
    {
      userId: req.userId!,
      contentType: input.content_type,
      textContent: input.text_content,
      tags: input.tags,
      folderId: input.folder_id,
      source: input.source
    },
    device?.name
  );
  const id = crypto.randomUUID();
  const blobUrl = input.data_url ? await persistDataUrl(input.data_url, id) : null;
  const [clip] = await db
    .insert(clips)
    .values({
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
    })
    .returning();

  await handleRuleActions(transformed.ruleActions, clip);

  if (clip.textContent && (input.source ?? "manual") === "clipboard_monitor") {
    await resolveLatestPrediction(req.userId!, clip.textContent);
  }

  res.status(201).json(clip);
});

router.get("/", async (req: AuthedRequest, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  const search = req.query.search ? String(req.query.search) : undefined;
  const folder = req.query.folder ? String(req.query.folder) : undefined;
  const tag = req.query.tag ? String(req.query.tag) : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const deletedFilter = req.query.deleted ? String(req.query.deleted) : "false";

  let where = eq(clips.userId, req.userId!);
  if (deletedFilter === "true") {
    where = and(where, eq(clips.isDeleted, true));
  } else if (deletedFilter !== "all") {
    where = and(where, eq(clips.isDeleted, false));
  }
  if (search) where = and(where, ilike(clips.textContent, `%${search}%`));
  if (folder) where = and(where, eq(clips.folderId, folder));
  if (type) where = and(where, eq(clips.contentType, type));
  if (tag) where = and(where, sql`${clips.tags} @> ${JSON.stringify([tag])}::jsonb`);
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
  await db.update(clips).set({ hotkeySlot: null, updatedAt: new Date() }).where(and(eq(clips.userId, req.userId!), eq(clips.hotkeySlot, body.slot)));
  await db.update(clips).set({ hotkeySlot: body.slot, updatedAt: new Date() }).where(and(eq(clips.id, body.clip_id), eq(clips.userId, req.userId!)));
  res.status(204).send();
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const [clip] = await db.select().from(clips).where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!))).limit(1);
  if (!clip) return res.status(404).json({ error: "Not found" });
  res.json(clip);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const patch = z
    .object({
      tags: z.array(z.string()).optional(),
      is_pinned: z.boolean().optional(),
      is_starred: z.boolean().optional(),
      is_deleted: z.boolean().optional(),
      folder_id: z.string().uuid().nullable().optional(),
      hotkey_slot: z.number().int().min(1).max(12).nullable().optional(),
      text_content: z.string().optional()
    })
    .parse(req.body);

  const updates: Partial<typeof clips.$inferInsert> = { updatedAt: new Date() };
  if (patch.tags) updates.tags = patch.tags;
  if (typeof patch.is_pinned === "boolean") updates.isPinned = patch.is_pinned;
  if (typeof patch.is_starred === "boolean") updates.isStarred = patch.is_starred;
  if (typeof patch.is_deleted === "boolean") updates.isDeleted = patch.is_deleted;
  if (patch.folder_id !== undefined) updates.folderId = patch.folder_id;
  if (patch.hotkey_slot !== undefined) updates.hotkeySlot = patch.hotkey_slot;
  if (patch.text_content !== undefined) updates.textContent = patch.text_content;

  const [updated] = await db
    .update(clips)
    .set(updates)
    .where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!)))
    .returning();
  res.json(updated);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  if (req.query.hard === "true") {
    await db.delete(clips).where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!)));
  } else {
    await db.update(clips).set({ isDeleted: true, updatedAt: new Date() }).where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!)));
  }
  res.status(204).send();
});

router.post("/:id/copy", async (req: AuthedRequest, res) => {
  const [clip] = await db.select().from(clips).where(and(eq(clips.id, req.params.id), eq(clips.userId, req.userId!))).limit(1);
  if (!clip?.textContent) return res.status(204).send();
  const result = await resolveLatestPrediction(req.userId!, clip.textContent);
  res.json(result);
});

export default router;
