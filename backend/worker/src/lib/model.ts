import type { Env } from "../env";

export type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ChatPart[] };

export async function callModel(env: Env, messages: ChatMessage[], model?: string): Promise<string> {
  if (!env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY Worker secret.");
  const base = (env.MODEL_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://akshar-ai-agent-v2.pages.dev", "X-Title": "Akshar AI" },
    body: JSON.stringify({ model: model || env.CHAT_MODEL || "openai/gpt-4o-mini", messages, temperature: 0.2, max_tokens: 2500 })
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Model provider returned ${response.status}: ${detail}`);
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{type?:string,text?:string}> } }> };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(part => part.text || "").join("\n").trim();
  throw new Error("Model provider returned an empty response.");
}