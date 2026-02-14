export default function PredictionBanner({
  prediction,
  confidence,
  streak
}: {
  prediction: string;
  confidence: number;
  streak?: number;
}): JSX.Element {
  return (
    <section style={{ background: "#111827", color: "#fff", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>Current AI prediction</div>
      <div style={{ fontSize: 18, marginTop: 4 }}>{prediction}</div>
      <div style={{ marginTop: 8, fontSize: 13 }}>Confidence: {Math.round(confidence * 100)}%{typeof streak === "number" ? ` • Streak: ${streak}` : ""}</div>
    </section>
  );
}
