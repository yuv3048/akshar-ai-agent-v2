import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../env";
import { callModel } from "../lib/model";
import { routePrompt } from "../agents/router";
import { runVisionAgent } from "../agents/vision";
import { runSearchAgent } from "../agents/search";

const api = new Hono<{ Bindings: Env }>();
const imageSchema = z.string().max(8_000_000).refine(v => /^https:\/\//.test(v) || /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(v), "Images must be HTTPS URLs or supported image data URLs.");
const chatSchema = z.object({
  prompt: z.string().trim().min(1).max(12000),
  conversationId: z.string().trim().min(1).max(128).optional(),
  userId: z.string().trim().min(1).max(128),
  images: z.array(imageSchema).max(4).default([]),
  history: z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(12000)})).max(20).default([])
});
const idSchema = z.object({ userId:z.string().min(1).max(128) });

api.get("/health", c => c.json({ ok:true, service:"akshar-api", runtime:"cloudflare-workers", timestamp:new Date().toISOString() }));

api.get("/conversations", async c => {
  const userId = c.req.query("userId")?.slice(0,128);
  if (!userId) return c.json({ error:"userId is required" },400);
  const { results } = await c.env.DB.prepare("SELECT id,title,created_at AS createdAt,updated_at AS updatedAt FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(userId).all();
  return c.json({ conversations: results });
});

api.post("/conversations", zValidator("json", idSchema.extend({ title:z.string().trim().max(100).optional() })), async c => {
  const body = c.req.valid("json");
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO conversations(id,user_id,title) VALUES(?,?,?)").bind(id,body.userId,body.title || "New chat").run();
  return c.json({ conversation:{ id,title:body.title || "New chat" } },201);
});

api.get("/conversations/:id/messages", async c => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({error:"userId is required"},400);
  const owner = await c.env.DB.prepare("SELECT id FROM conversations WHERE id=? AND user_id=?").bind(c.req.param("id"),userId).first();
  if (!owner) return c.json({error:"Conversation not found"},404);
  const { results } = await c.env.DB.prepare("SELECT id,role,content,agent,images_json AS imagesJson,created_at AS createdAt FROM messages WHERE conversation_id=? AND user_id=? ORDER BY created_at ASC LIMIT 200").bind(c.req.param("id"),userId).all();
  return c.json({messages:results.map((m:any)=>({...m,images: m.imagesJson ? JSON.parse(String(m.imagesJson)) : []}))});
});

api.post("/chat", zValidator("json", chatSchema), async c => {
  const body = c.req.valid("json");
  if (!c.env.OPENROUTER_API_KEY) return c.json({error:"AI model is not configured. Set OPENROUTER_API_KEY as a Worker secret."},503);
  const userId = body.userId;
  const conversationId = body.conversationId || crypto.randomUUID();
  const existing = await c.env.DB.prepare("SELECT id,title FROM conversations WHERE id=? AND user_id=?").bind(conversationId,userId).first<{id:string;title:string}>();
  if (body.conversationId && !existing) return c.json({error:"Conversation not found"},404);
  if (!existing) await c.env.DB.prepare("INSERT INTO conversations(id,user_id,title) VALUES(?,?,?)").bind(conversationId,userId,body.prompt.slice(0,60)).run();
  const agent = routePrompt(body.prompt, body.images.length > 0);
  const userMessageId = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO messages(id,conversation_id,user_id,role,content,images_json,agent) VALUES(?,?,?,?,?,?,?)")
    .bind(userMessageId,conversationId,userId,"user",body.prompt,body.images.length ? JSON.stringify(body.images) : null,agent).run();
  try {
    let text: string;
    let sources: Array<{title?:string;url?:string;content?:string}> = [];
    if (agent === "vision") text = await runVisionAgent(c.env,body.prompt,body.images,body.history);
    else if (agent === "search") ({text,sources} = await runSearchAgent(c.env,body.prompt,body.history));
    else {
      const system = agent === "coding"
        ? "You are Akshar AI, a senior software engineering assistant. Give accurate, runnable code, explain important choices briefly, and use fenced code blocks with language labels. Do not invent APIs."
        : "You are Akshar AI, a helpful, accurate and friendly assistant created by Yuvraj Sharma. Answer the actual question first, be concise by default, and admit uncertainty.";
      text = await callModel(c.env,[{role:"system",content:system},...body.history.slice(-10),{role:"user",content:body.prompt}],c.env.CHAT_MODEL);
    }
    await c.env.DB.prepare("INSERT INTO messages(id,conversation_id,user_id,role,content,agent) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),conversationId,userId,"assistant",text,agent).run();
    await c.env.DB.prepare("UPDATE conversations SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?").bind(conversationId,userId).run();
    return c.json({conversationId, message:{id:crypto.randomUUID(),role:"assistant",content:text,agent},agent,sources});
  } catch (error) {
    console.error("agent failure",error);
    return c.json({error:error instanceof Error ? error.message : "Agent request failed"},502);
  }
});

api.delete("/conversations/:id", async c => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({error:"userId is required"},400);
  await c.env.DB.prepare("DELETE FROM conversations WHERE id=? AND user_id=?").bind(c.req.param("id"),userId).run();
  return c.json({ok:true});
});

export default api;