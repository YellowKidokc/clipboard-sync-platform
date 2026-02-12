import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/auth.js";
import { generatePrediction, resolveLatestPrediction } from "../engine/predictor.js";
import { db } from "../db/client.js";
import { predictions, predictionStats } from "../db/schema.js";

const router = Router();

router.get("/current", async (req: AuthedRequest, res) => {
  const prediction = await generatePrediction(req.userId!);
  res.json({ prediction: prediction.prediction, confidence: prediction.confidence, context_used: prediction.context });
});

router.post("/resolve", async (req: AuthedRequest, res) => {
  const input = z.object({ actual_content: z.string() }).parse(req.body);
  const result = await resolveLatestPrediction(req.userId!, input.actual_content);
  res.json(result);
});

router.get("/stats", async (req: AuthedRequest, res) => {
  const [stats] = await db.select().from(predictionStats).where(eq(predictionStats.userId, req.userId!)).limit(1);
  const recent = await db.select().from(predictions).where(eq(predictions.userId, req.userId!)).orderBy(desc(predictions.createdAt)).limit(20);
  let streak = 0;
  for (const p of recent) {
    if (p.wasCorrect) streak += 1;
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
  const [existing] = await db.select({ context: predictions.context }).from(predictions).where(and(eq(predictions.id, body.prediction_id), eq(predictions.userId, req.userId!))).limit(1);
  const merged = { ...(existing?.context ?? {}), helpful: body.was_helpful };
  await db.update(predictions).set({ context: merged }).where(and(eq(predictions.id, body.prediction_id), eq(predictions.userId, req.userId!)));
  res.status(204).send();
});

export default router;
