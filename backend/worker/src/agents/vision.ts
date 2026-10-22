import type { Env } from "../env";
import { callModel, type ChatPart } from "../lib/model";

export async function runVisionAgent(env: Env, prompt: string, images: string[], history: Array<{role:"user"|"assistant";content:string}>) {
  const parts: ChatPart[] = [{ type: "text", text: prompt || "Describe the image and help the user understand it." }];
  for (const url of images) parts.push({ type: "image_url", image_url: { url } });
  const messages = [
    { role: "system" as const, content: "You are Akshar AI's vision agent. Carefully inspect the supplied image(s), answer the user's specific question, distinguish visible evidence from uncertainty, and never claim to see details that are not legible. For screenshots, help diagnose the UI/code/error. For clothing or products, describe visible style attributes and give relevant suggestions. Be concise but useful." },
    ...history.slice(-8),
    { role: "user" as const, content: parts }
  ];
  return callModel(env, messages, env.VISION_MODEL || env.CHAT_MODEL);
}