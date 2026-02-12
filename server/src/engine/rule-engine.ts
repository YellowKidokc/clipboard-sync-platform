import type { InferSelectModel } from "drizzle-orm";
import { folders, rules } from "../db/schema.js";
import { db } from "../db/client.js";
import { and, eq } from "drizzle-orm";

type Rule = InferSelectModel<typeof rules>;

export type ClipInput = {
  userId: string;
  contentType: string;
  textContent?: string | null;
  tags?: string[];
  folderId?: string | null;
  source?: string;
};

export type RuleAction =
  | { type: "webhook"; url: string }
  | { type: "ai_call"; workflow: string };

export type RuleResult = ClipInput & { ruleActions: RuleAction[] };

export async function applyRules(clip: ClipInput, deviceName?: string, overrideRules?: Rule[]): Promise<RuleResult> {
  const activeRules =
    overrideRules ??
    (await db
      .select()
      .from(rules)
      .where(and(eq(rules.userId, clip.userId), eq(rules.enabled, true)))
      .orderBy(rules.priority));

  let nextClip = { ...clip, tags: clip.tags ?? [] };
  const ruleActions: RuleAction[] = [];
  for (const rule of activeRules) {
    if (matches(rule, nextClip)) {
      const result = await applyAction(rule, nextClip, deviceName);
      nextClip = result.clip;
      ruleActions.push(...result.actions);
    }
  }

  return { ...nextClip, ruleActions };
}

function matches(rule: Rule, clip: ClipInput): boolean {
  const text = clip.textContent ?? "";
  switch (rule.matchType) {
    case "regex":
      return new RegExp(rule.pattern, "i").test(text);
    case "mime":
      return rule.pattern.endsWith("/*")
        ? clip.contentType.startsWith(rule.pattern.replace("*", ""))
        : clip.contentType === rule.pattern;
    case "contains":
      return text.toLowerCase().includes(rule.pattern.toLowerCase());
    case "starts_with":
      return text.toLowerCase().startsWith(rule.pattern.toLowerCase());
    default:
      return false;
  }
}

export async function applyRule(rule: Rule, clip: ClipInput, deviceName?: string): Promise<RuleResult> {
  return applyRules(clip, deviceName, [rule]);
}

async function applyAction(
  rule: Rule,
  clip: ClipInput,
  deviceName?: string
): Promise<{ clip: ClipInput; actions: RuleAction[] }> {
  switch (rule.action) {
    case "replace": {
      const find = String(rule.params.find ?? "");
      const replacement = String(rule.params.replacement ?? "");
      return { clip: { ...clip, textContent: (clip.textContent ?? "").replaceAll(find, replacement) }, actions: [] };
    }
    case "tag": {
      const tags = Array.isArray(rule.params.tags) ? (rule.params.tags as string[]) : [];
      return { clip: { ...clip, tags: [...new Set([...(clip.tags ?? []), ...tags])] }, actions: [] };
    }
    case "route_folder": {
      const template = String(rule.params.template ?? "Inbox");
      const now = new Date();
      const resolved = template
        .replace("{YYYY}", `${now.getFullYear()}`)
        .replace("{MM}", `${now.getMonth() + 1}`.padStart(2, "0"))
        .replace("{DD}", `${now.getDate()}`.padStart(2, "0"))
        .replace("{device}", deviceName ?? "unknown");
      const [folder] = await db
        .select()
        .from(folders)
        .where(and(eq(folders.userId, clip.userId), eq(folders.pathTemplate, resolved)))
        .limit(1);
      if (folder?.id) {
        return { clip: { ...clip, folderId: folder.id }, actions: [] };
      }
      const name = resolved.split("/").filter(Boolean).pop() ?? resolved;
      const [created] = await db
        .insert(folders)
        .values({ userId: clip.userId, name, pathTemplate: resolved })
        .returning();
      return { clip: { ...clip, folderId: created.id }, actions: [] };
    }
    case "webhook":
      return { clip, actions: [{ type: "webhook", url: String(rule.params.url ?? "") }] };
    case "ai_call":
      return { clip, actions: [{ type: "ai_call", workflow: String(rule.params.workflow ?? "summarize") }] };
    default:
      return { clip, actions: [] };
  }
}
