import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { aiConversations, clips } from "../db/schema.js";
import { runWorkflow } from "../services/ai-service.js";
import type { AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.post("/chat", async (req: AuthedRequest, res) => {
  const body = z.object({ message: z.string(), clip_id: z.string().uuid().optional(), workflow: z.string().optional() }).parse(req.body);
  const reply = await runWorkflow(body.workflow ?? "chat", body.message);
  await db.insert(aiConversations).values([
    { userId: req.userId!, clipId: body.clip_id, role: "user", content: body.message, workflow: body.workflow },
    { userId: req.userId!, clipId: body.clip_id, role: "assistant", content: reply, workflow: body.workflow }
  ]);
  res.json({ reply });
});

for (const workflow of ["summarize", "classify", "improve"]) {
  router.post(`/${workflow}`, async (req: AuthedRequest, res) => {
    const body = z.object({ clip_id: z.string().uuid() }).parse(req.body);
    const [clip] = await db.select().from(clips).where(and(eq(clips.id, body.clip_id), eq(clips.userId, req.userId!))).limit(1);
    if (!clip?.textContent) return res.status(404).json({ error: "Clip not found" });
    const output = await runWorkflow(workflow, clip.textContent);
    res.json({ workflow, output });
  });
}

router.post("/workflow", async (req: AuthedRequest, res) => {
  const body = z.object({ clip_id: z.string().uuid(), workflow: z.enum(["summarize", "improve", "tags", "code", "email", "ideas"]) }).parse(req.body);
  const [clip] = await db.select().from(clips).where(and(eq(clips.id, body.clip_id), eq(clips.userId, req.userId!))).limit(1);
  if (!clip?.textContent) return res.status(404).json({ error: "Clip not found" });
  const output = await runWorkflow(body.workflow, clip.textContent);
  res.json({ output, workflow: body.workflow });
});

export default router;
