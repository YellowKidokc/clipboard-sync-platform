export default function PredictionBanner({ prediction, confidence }: { prediction: string; confidence: number }): JSX.Element {
  return <div style={{ background: "#eef", padding: 12 }}>Prediction: {prediction} ({Math.round(confidence * 100)}%)</div>;
}
