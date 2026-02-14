import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { clips, predictions, predictionStats } from "../db/schema.js";
import { aiJsonPrediction } from "../services/ai-service.js";

export async function generatePrediction(userId: string): Promise<{ prediction: string; confidence: number; context: unknown }> {
  const recent = await db.select().from(clips).where(and(eq(clips.userId, userId), eq(clips.isDeleted, false))).orderBy(desc(clips.createdAt)).limit(10);
  const context = {
    recent: recent.map((c) => ({ text: c.textContent, contentType: c.contentType, createdAt: c.createdAt })),
    dayOfWeek: new Date().getDay(),
    hour: new Date().getHours()
  };
  const predicted = await aiJsonPrediction(context);

  await db.insert(predictions).values({
    userId,
    predictedContent: predicted.prediction,
    confidence: predicted.confidence,
    context
  });

  return { prediction: predicted.prediction, confidence: predicted.confidence, context };
}

export async function resolveLatestPrediction(userId: string, actualContent: string): Promise<{ correct: boolean; accuracy: number }> {
  const [latest] = await db.select().from(predictions).where(and(eq(predictions.userId, userId), isNull(predictions.wasCorrect))).orderBy(desc(predictions.createdAt)).limit(1);
  if (!latest) {
    return { correct: false, accuracy: 0 };
  }

  const similarity = jaccard(latest.predictedContent, actualContent);
  const correct = similarity >= 0.8;

  await db.update(predictions).set({ actualContent, wasCorrect: correct }).where(eq(predictions.id, latest.id));

  const [agg] = await db
    .select({ total: sql<number>`count(*)`, correct: sql<number>`sum(case when was_correct = true then 1 else 0 end)` })
    .from(predictions)
    .where(eq(predictions.userId, userId));

  const total = Number(agg.total ?? 0);
  const right = Number(agg.correct ?? 0);
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
