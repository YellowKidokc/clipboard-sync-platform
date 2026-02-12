import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import authRoutes from "./routes/auth.js";
import clipsRoutes from "./routes/clips.js";
import rulesRoutes from "./routes/rules.js";
import foldersRoutes from "./routes/folders.js";
import aiRoutes from "./routes/ai.js";
import predictionsRoutes from "./routes/predictions.js";
import { requireAuth, type AuthedRequest } from "./middleware/auth.js";
import { db } from "./db/client.js";
import { devices, users } from "./db/schema.js";
import { eq } from "drizzle-orm";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);

app.get("/api/me", requireAuth, async (req: AuthedRequest, res) => {
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, req.userId!)).limit(1);
  const rows = await db.select().from(devices).where(eq(devices.userId, req.userId!));
  res.json({ user, devices: rows });
});

app.use("/api/clips", requireAuth, clipsRoutes);
app.use("/api/rules", requireAuth, rulesRoutes);
app.use("/api/folders", requireAuth, foldersRoutes);
app.use("/api/ai", requireAuth, aiRoutes);
app.use("/api/predictions", requireAuth, predictionsRoutes);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: error.message });
});

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = process.env.CLIENT_DIST ?? path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }
}

const port = Number(process.env.PORT ?? 5000);
app.listen(port, () => {
  console.log(`ClipSync server listening on :${port}`);
});
