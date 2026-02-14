import { and, desc, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { generatePrediction, resolveLatestPrediction } from "../engine/predictor.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { predictions, predictionStats } from "../db/schema.js";

const router = Router();

router.get("/current", async (req: AuthedRequest, res) => {
  const [pending] = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.userId, req.userId!), isNull(predictions.wasCorrect)))
    .orderBy(desc(predictions.createdAt))
    .limit(1);

  if (pending) {
    res.json({
      prediction: pending.predictedContent,
      confidence: pending.confidence,
      context: pending.context,
      prediction_id: pending.id
    });
    return;
  }

  const next = await generatePrediction(req.userId!);
  res.json(next);
});

router.post("/resolve", async (req: AuthedRequest, res) => {
  const input = z.object({ actual_content: z.string() }).parse(req.body);
  const result = await resolveLatestPrediction(req.userId!, input.actual_content);
  res.json(result);
});

router.get("/stats", async (req: AuthedRequest, res) => {
  const [stats] = await db.select().from(predictionStats).where(eq(predictionStats.userId, req.userId!)).limit(1);
  const recent = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, req.userId!))
    .orderBy(desc(predictions.createdAt))
    .limit(20);

  let streak = 0;
  for (const item of recent) {
    if (item.wasCorrect) streak += 1;
    else break;
  }

  res.json({
    accuracy: stats?.accuracy ?? 0,
    total: stats?.totalPredictions ?? 0,
    correct: stats?.correctPredictions ?? 0,
    streak,
    recent_predictions: recent
  });
});

router.post("/feedback", async (req: AuthedRequest, res) => {
  const body = z.object({ prediction_id: z.string().uuid(), was_helpful: z.boolean() }).parse(req.body);
  const [current] = await db
    .select({ context: predictions.context })
    .from(predictions)
    .where(and(eq(predictions.id, body.prediction_id), eq(predictions.userId, req.userId!)))
    .limit(1);

  await db
    .update(predictions)
    .set({ context: { ...(current?.context ?? {}), helpful: body.was_helpful } })
    .where(and(eq(predictions.id, body.prediction_id), eq(predictions.userId, req.userId!)));

  res.status(204).send();
});

export default router;
