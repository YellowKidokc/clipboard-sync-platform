import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type ChatInput = {
  system?: string;
  user: string;
  json?: boolean;
};

async function chatCompletion({ system, user, json }: ChatInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `AI disabled: ${user.slice(0, 120)}`;
  }
  const res = await client.responses.create({
    model,
    input: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: user }
    ],
    response_format: json ? { type: "json_object" } : undefined
  });
  return res.output_text;
}

export async function aiText(prompt: string, system?: string): Promise<string> {
  return chatCompletion({ system, user: prompt });
}

async function aiJson<T>(prompt: string, system?: string, fallback?: T): Promise<T> {
  if (!process.env.OPENAI_API_KEY) {
    return fallback as T;
  }
  try {
    const text = await chatCompletion({ system, user: prompt, json: true });
    return JSON.parse(text) as T;
  } catch {
    return fallback as T;
  }
}

export async function aiJsonPrediction(
  context: unknown
): Promise<{ prediction: string; confidence: number; reasoning: string }> {
  const fallback = { prediction: "Copy likely follows your last pattern", confidence: 0.4, reasoning: "fallback" };
  return aiJson(
    `You are a clipboard prediction engine. Based on the context, return JSON with keys prediction, confidence, reasoning. Context: ${JSON.stringify(context)}`,
    "Return only valid JSON.",
    fallback
  );
}

export async function runWorkflow(workflow: string, content: string): Promise<string> {
  switch (workflow) {
    case "summarize":
      return aiText(`Summarize this content concisely:\n${content}`);
    case "improve":
      return aiText(`Improve the writing quality, clarity, and tone. Keep meaning:\n${content}`);
    case "tags":
      return aiText(`Suggest 3-7 short tags for this content:\n${content}`);
    case "classify":
      return aiText(`Classify this content and suggest tags:\n${content}`);
    case "code":
      return aiText(`Review this code for bugs, security issues, and improvements:\n${content}`);
    case "email":
      return aiText(`Draft a professional email based on this context:\n${content}`);
    case "ideas":
      return aiText(`Generate ideas and next steps based on this content:\n${content}`);
    case "chat":
    default:
      return aiText(content);
  }
}

export async function suggestTags(content: string): Promise<string[]> {
  const data = await aiJson<{ tags: string[] }>(
    `Extract 3-7 concise tags as JSON: {"tags": ["tag1", "tag2"]}. Content: ${content}`,
    "Return only valid JSON with key tags.",
    { tags: [] }
  );
  return Array.isArray(data.tags) ? data.tags.map((t) => String(t)) : [];
}
