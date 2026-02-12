import type { InferSelectModel } from "drizzle-orm";
import { folders, rules } from "../db/schema.js";
import { db } from "../db/client.js";
import { and, eq, like } from "drizzle-orm";

type Rule = InferSelectModel<typeof rules>;

type ClipInput = {
  userId: string;
  contentType: string;
  textContent?: string | null;
  tags?: string[];
  folderId?: string | null;
  source?: string;
};

export async function applyRules(clip: ClipInput, deviceName?: string): Promise<ClipInput> {
  const activeRules = await db
    .select()
    .from(rules)
    .where(and(eq(rules.userId, clip.userId), eq(rules.enabled, true)))
    .orderBy(rules.priority);

  let nextClip = { ...clip, tags: clip.tags ?? [] };
  for (const rule of activeRules) {
    if (matches(rule, nextClip)) {
      nextClip = await applyAction(rule, nextClip, deviceName);
    }
  }

  return nextClip;
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

async function applyAction(rule: Rule, clip: ClipInput, deviceName?: string): Promise<ClipInput> {
  switch (rule.action) {
    case "replace": {
      const find = String(rule.params.find ?? "");
      const replacement = String(rule.params.replacement ?? "");
      return { ...clip, textContent: (clip.textContent ?? "").replaceAll(find, replacement) };
    }
    case "tag": {
      const tags = Array.isArray(rule.params.tags) ? (rule.params.tags as string[]) : [];
      return { ...clip, tags: [...new Set([...(clip.tags ?? []), ...tags])] };
    }
    case "route_folder": {
      const template = String(rule.params.template ?? "Inbox");
      const now = new Date();
      const resolved = template
        .replace("{YYYY}", `${now.getFullYear()}`)
        .replace("{MM}", `${now.getMonth() + 1}`.padStart(2, "0"))
        .replace("{DD}", `${now.getDate()}`.padStart(2, "0"))
        .replace("{device}", deviceName ?? "unknown");
      const [folder] = await db.select().from(folders).where(and(eq(folders.userId, clip.userId), like(folders.pathTemplate, `${resolved}%`))).limit(1);
      return { ...clip, folderId: folder?.id ?? clip.folderId };
    }
    case "webhook":
    case "ai_call":
    default:
      return clip;
  }
}
