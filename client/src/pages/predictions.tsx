import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PredictionBanner from "../components/prediction-banner";
import { api } from "../lib/api";

type Prediction = {
  id: string;
  predictedContent: string;
  actualContent?: string | null;
  confidence: number;
  wasCorrect?: boolean | null;
  createdAt: string;
};

type PredictionStats = {
  accuracy: number;
  total: number;
  correct: number;
  streak: number;
  recent_predictions: Prediction[];
};

export default function PredictionsPage(): JSX.Element {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ["prediction-stats"], queryFn: () => api<PredictionStats>("/api/predictions/stats") });
  const current = useQuery({ queryKey: ["prediction-current"], queryFn: () => api<{ prediction: string; confidence: number; prediction_id?: string }>("/api/predictions/current") });

  const feedback = useMutation({
    mutationFn: ({ predictionId, helpful }: { predictionId: string; helpful: boolean }) =>
      api<void>("/api/predictions/feedback", {
        method: "POST",
        body: JSON.stringify({ prediction_id: predictionId, was_helpful: helpful })
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prediction-stats"] })
  });

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1>Prediction Dashboard</h1>

      {current.data ? (
        <PredictionBanner prediction={current.data.prediction} confidence={current.data.confidence} streak={stats.data?.streak} />
      ) : null}

      <section style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <Stat title="Accuracy" value={`${Math.round((stats.data?.accuracy ?? 0) * 100)}%`} />
        <Stat title="Total" value={`${stats.data?.total ?? 0}`} />
        <Stat title="Correct" value={`${stats.data?.correct ?? 0}`} />
        <Stat title="Streak" value={`${stats.data?.streak ?? 0}`} />
      </section>

      <h2 style={{ marginTop: 16 }}>Recent predictions</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {(stats.data?.recent_predictions ?? []).map((item) => (
          <article key={item.id} style={{ border: "1px solid #dbe1ea", borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ fontWeight: 600 }}>{item.predictedContent}</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
              Actual: {item.actualContent ?? "pending"} • Confidence: {Math.round(item.confidence * 100)}%
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              {item.wasCorrect === true ? "✅ Correct" : item.wasCorrect === false ? "❌ Incorrect" : "⏳ Pending"}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={() => feedback.mutate({ predictionId: item.id, helpful: true })}>Helpful</button>
              <button onClick={() => feedback.mutate({ predictionId: item.id, helpful: false })}>Not helpful</button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }): JSX.Element {
  return (
    <article style={{ border: "1px solid #dbe1ea", borderRadius: 12, padding: 12, minWidth: 120, background: "#f8fafc" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </article>
  );
}
