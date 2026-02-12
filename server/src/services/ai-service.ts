import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function aiText(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `AI disabled: ${prompt.slice(0, 120)}`;
  }
  const res = await client.responses.create({ model, input: prompt });
  return res.output_text;
}

export async function aiJsonPrediction(context: unknown): Promise<{ prediction: string; confidence: number; reasoning: string }> {
  const fallback = { prediction: "Copy likely follows your last pattern", confidence: 0.4, reasoning: "fallback" };
  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }
  try {
    const text = await aiText(`You are a clipboard prediction engine. Return JSON only with keys prediction, confidence, reasoning. Context: ${JSON.stringify(context)}`);
    const parsed = JSON.parse(text) as { prediction: string; confidence: number; reasoning: string };
    return parsed;
  } catch {
    return fallback;
  }
}

export async function runWorkflow(workflow: string, content: string): Promise<string> {
  const prompt = `Run workflow ${workflow} on:\n${content}`;
  return aiText(prompt);
}
