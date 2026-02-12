import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { clips, folders, predictions, predictionStats } from "../db/schema.js";
import { aiJsonPrediction } from "../services/ai-service.js";

export async function generatePrediction(userId: string): Promise<{ prediction: string; confidence: number; context: unknown }> {
  const recent = await db
    .select()
    .from(clips)
    .where(and(eq(clips.userId, userId), eq(clips.isDeleted, false)))
    .orderBy(desc(clips.createdAt))
    .limit(10);

  const folderRows = await db.select().from(folders).where(eq(folders.userId, userId));
  const folderMap = new Map(folderRows.map((f) => [f.id, f.name]));

  const hotkeys = await db
    .select()
    .from(clips)
    .where(and(eq(clips.userId, userId), sql`${clips.hotkeySlot} is not null`))
    .orderBy(desc(clips.hotkeySlot));

  const [stats] = await db.select().from(predictionStats).where(eq(predictionStats.userId, userId)).limit(1);
  const recentPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, userId))
    .orderBy(desc(predictions.createdAt))
    .limit(8);

  const now = new Date();
  const context = {
    recent: recent.map((c) => ({
      text: c.textContent,
      contentType: c.contentType,
      createdAt: c.createdAt,
      tags: c.tags,
      folder: c.folderId ? folderMap.get(c.folderId) : null
    })),
    hotkeys: hotkeys.map((c) => ({ slot: c.hotkeySlot, text: c.textContent, tags: c.tags })),
    accuracy: stats?.accuracy ?? 0,
    totalPredictions: stats?.totalPredictions ?? 0,
    recentOutcomes: recentPredictions.map((p) => ({
      prediction: p.predictedContent,
      correct: p.wasCorrect,
      confidence: p.confidence
    })),
    dayOfWeek: now.getDay(),
    hour: now.getHours()
  };

  const predicted = await aiJsonPrediction(context);

  await db.insert(predictions).values({
    userId,
    predictedContent: predicted.prediction,
    confidence: predicted.confidence,
    context: { ...context, reasoning: predicted.reasoning }
  });

  return { prediction: predicted.prediction, confidence: predicted.confidence, context };
}

export async function resolveLatestPrediction(userId: string, actualContent: string): Promise<{ correct: boolean; accuracy: number }> {
  const [latest] = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.userId, userId), isNull(predictions.wasCorrect)))
    .orderBy(desc(predictions.createdAt))
    .limit(1);
  if (!latest) {
    return { correct: false, accuracy: 0 };
  }

  const similarity = jaccard(latest.predictedContent, actualContent);
  const correct = similarity >= 0.8;

  await db.update(predictions).set({ actualContent, wasCorrect: correct }).where(eq(predictions.id, latest.id));

  const [stats] = await db.select().from(predictionStats).where(eq(predictionStats.userId, userId)).limit(1);
  const windowSize = stats?.windowSize ?? 100;

  const recent = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, userId))
    .orderBy(desc(predictions.createdAt))
    .limit(windowSize);
  const total = recent.length;
  const right = recent.filter((p) => p.wasCorrect).length;
  const accuracy = total ? right / total : 0;

  await db
    .insert(predictionStats)
    .values({ userId, totalPredictions: total, correctPredictions: right, accuracy })
    .onConflictDoUpdate({
      target: predictionStats.userId,
      set: { totalPredictions: total, correctPredictions: right, accuracy, updatedAt: new Date() }
    });

  return { correct, accuracy };
}

function jaccard(a: string, b: string): number {
  const aa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const bb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = [...aa].filter((t) => bb.has(t)).length;
  const union = new Set([...aa, ...bb]).size;
  return union === 0 ? 0 : intersection / union;
}
