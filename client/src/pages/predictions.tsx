import PredictionBanner from "../components/prediction-banner";

export default function PredictionsPage(): JSX.Element {
  return <main style={{ padding: 16 }}><h1>Predictions</h1><PredictionBanner prediction="Your next copy appears here" confidence={0.42} /></main>;
}
