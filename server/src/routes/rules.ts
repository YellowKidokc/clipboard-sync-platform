import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { applyRulesToClip, type ClipInput } from "../engine/rule-engine.js";
import { rules } from "../db/schema.js";
import type { AuthedRequest } from "../middleware/auth.js";

const router = Router();
const ruleSchema = z.object({
  name: z.string(),
  match_type: z.enum(["mime", "regex", "contains", "starts_with"]),
  pattern: z.string(),
  action: z.enum(["replace", "route_folder", "tag", "webhook", "ai_call"]),
  params: z.record(z.unknown()).default({}),
  priority: z.number().int().default(100),
  enabled: z.boolean().default(true)
});

router.get("/", async (req: AuthedRequest, res) => {
  const data = await db.select().from(rules).where(eq(rules.userId, req.userId!));
  res.json({ rules: data });
});

router.post("/", async (req: AuthedRequest, res) => {
  const input = ruleSchema.parse(req.body);
  const [row] = await db
    .insert(rules)
    .values({
      userId: req.userId!,
      name: input.name,
      matchType: input.match_type,
      pattern: input.pattern,
      action: input.action,
      params: input.params,
      priority: input.priority,
      enabled: input.enabled
    })
    .returning();
  res.status(201).json(row);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const input = ruleSchema.partial().parse(req.body);
  const [row] = await db
    .update(rules)
    .set({
      name: input.name,
      matchType: input.match_type,
      pattern: input.pattern,
      action: input.action,
      params: input.params,
      priority: input.priority,
      enabled: input.enabled
    })
    .where(and(eq(rules.id, req.params.id), eq(rules.userId, req.userId!)))
    .returning();
  res.json(row);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  await db.delete(rules).where(and(eq(rules.id, req.params.id), eq(rules.userId, req.userId!)));
  res.status(204).send();
});

router.post("/test", async (req: AuthedRequest, res) => {
  const body = z
    .object({ rule: ruleSchema, test_content: z.string(), content_type: z.string().default("text/plain") })
    .parse(req.body);

  const testRule = {
    id: crypto.randomUUID(),
    userId: req.userId!,
    name: body.rule.name,
    matchType: body.rule.match_type,
    pattern: body.rule.pattern,
    action: body.rule.action,
    params: body.rule.params,
    priority: body.rule.priority,
    enabled: body.rule.enabled
  };

  const source: ClipInput = {
    userId: req.userId!,
    contentType: body.content_type,
    textContent: body.test_content,
    tags: []
  };

  const result = await applyRulesToClip([testRule], source);
  const matched =
    result.textContent !== source.textContent ||
    result.folderId !== source.folderId ||
    JSON.stringify(result.tags) !== JSON.stringify(source.tags);

  res.json({ matched, result });
});

export default router;
