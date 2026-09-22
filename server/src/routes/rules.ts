import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { rules } from "../db/schema.js";
import { applyRule } from "../engine/rule-engine.js";
import { compileRulePattern } from "../engine/rule-pattern.js";
import { assertWebhookUrlAllowed } from "../services/webhook.js";
import type { AuthedRequest } from "../middleware/auth.js";

const router = Router();

type RuleInput = {
  match_type?: "mime" | "regex" | "contains" | "starts_with";
  pattern?: string;
  action?: "replace" | "route_folder" | "tag" | "webhook" | "ai_call";
  params?: Record<string, unknown>;
};

/**
 * Rejects a rule before it is stored: an uncompilable or unbounded regex, and a
 * webhook URL that would make the server fetch its own network. Both throw a
 * 400 through the error handler.
 */
async function validateRule(input: RuleInput): Promise<void> {
  if (input.match_type === "regex" && typeof input.pattern === "string") {
    compileRulePattern(input.pattern);
  }
  if (input.action === "webhook") {
    await assertWebhookUrlAllowed(String(input.params?.url ?? ""));
  }
}

const ruleSchema = z.object({ name: z.string(), match_type: z.enum(["mime", "regex", "contains", "starts_with"]), pattern: z.string(), action: z.enum(["replace", "route_folder", "tag", "webhook", "ai_call"]), params: z.record(z.unknown()).default({}), priority: z.number().int().default(100), enabled: z.boolean().default(true) });

router.get("/", asyncHandler(async (req: AuthedRequest, res) => {
  const data = await db.select().from(rules).where(eq(rules.userId, req.userId!));
  res.json({ rules: data });
}));
router.post("/", asyncHandler(async (req: AuthedRequest, res) => {
  const input = ruleSchema.parse(req.body);
  await validateRule(input);
  const [row] = await db.insert(rules).values({ userId: req.userId!, name: input.name, matchType: input.match_type, pattern: input.pattern, action: input.action, params: input.params, priority: input.priority, enabled: input.enabled }).returning();
  res.status(201).json(row);
}));
router.put("/:id", asyncHandler(async (req: AuthedRequest, res) => {
  const input = ruleSchema.partial().parse(req.body);
  await validateRule(input);
  const [row] = await db.update(rules).set({ name: input.name, matchType: input.match_type, pattern: input.pattern, action: input.action, params: input.params, priority: input.priority, enabled: input.enabled }).where(and(eq(rules.id, String(req.params.id)), eq(rules.userId, req.userId!))).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
}));
router.delete("/:id", asyncHandler(async (req: AuthedRequest, res) => {
  await db.delete(rules).where(and(eq(rules.id, String(req.params.id)), eq(rules.userId, req.userId!)));
  res.status(204).send();
}));
router.post("/test", asyncHandler(async (req: AuthedRequest, res) => {
  const body = z.object({ rule: ruleSchema, test_content: z.string(), content_type: z.string().default("text/plain") }).parse(req.body);
  await validateRule(body.rule);
  const rule = {
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
  const result = await applyRule(
    rule,
    {
      userId: req.userId!,
      contentType: body.content_type,
      textContent: body.test_content,
      tags: []
    },
    undefined,
    { dryRun: true }
  );
  // The engine reports which rules fired; inferring it from the output missed
  // no-op transforms and counted a rule that matched but changed nothing as a miss.
  const matched = (result.matchedRuleIds?.length ?? 0) > 0;
  res.json({ matched, result });
}));

export default router;
