import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ClipCard from "../components/clip-card";
import AiChat from "../components/ai-chat";
import HotkeyIndicator from "../components/hotkey-indicator";
import PredictionBanner from "../components/prediction-banner";
import { api } from "../lib/api";

type Clip = {
  id: string;
  textContent?: string | null;
  contentType: string;
  tags?: string[];
  hotkeySlot?: number | null;
  createdAt?: string;
};

type PredictionStats = { accuracy: number; total: number; correct: number; streak: number };

type CurrentPrediction = { prediction: string; confidence: number };

export default function ClipboardPage(): JSX.Element {
  const [search, setSearch] = useState("");

  const clips = useQuery({
    queryKey: ["clips"],
    queryFn: () => api<{ clips: Clip[] }>("/api/clips")
  });

  const stats = useQuery({
    queryKey: ["prediction-stats"],
    queryFn: () => api<PredictionStats>("/api/predictions/stats")
  });

  const current = useQuery({
    queryKey: ["prediction-current"],
    queryFn: () => api<CurrentPrediction>("/api/predictions/current")
  });

  const filtered = useMemo(
    () =>
      (clips.data?.clips ?? []).filter((clip) =>
        `${clip.textContent ?? ""} ${(clip.tags ?? []).join(" ")}`.toLowerCase().includes(search.toLowerCase())
      ),
    [clips.data?.clips, search]
  );

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1>Clipboard Stream</h1>
      <HotkeyIndicator />

      {current.data ? (
        <div style={{ margin: "12px 0" }}>
          <PredictionBanner prediction={current.data.prediction} confidence={current.data.confidence} streak={stats.data?.streak} />
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
        <Metric label="Accuracy" value={`${Math.round((stats.data?.accuracy ?? 0) * 100)}%`} />
        <Metric label="Predictions" value={`${stats.data?.total ?? 0}`} />
        <Metric label="Correct" value={`${stats.data?.correct ?? 0}`} />
      </section>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search clips, tags, snippets"
        style={{ width: "100%", borderRadius: 10, border: "1px solid #dbe1ea", padding: 10, marginBottom: 12 }}
      />

      <section style={{ display: "grid", gap: 10 }}>
        {filtered.map((clip) => (
          <ClipCard key={clip.id} clip={clip} />
        ))}
      </section>

      <div style={{ marginTop: 16 }}>
        <AiChat />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <article style={{ border: "1px solid #dbe1ea", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </article>
  );
}
