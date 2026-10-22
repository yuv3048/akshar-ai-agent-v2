# Akshar AI

A TypeScript-first AI assistant with a React frontend and Hono API running on Cloudflare Workers. Supports chat, vision/image prompts, conversation history, optional web search, and D1 persistence.

## Stack
- React + Vite + TypeScript
- Hono + Zod request validation
- Cloudflare Workers + Static Assets, D1, and KV
- OpenAI-compatible model API (OpenRouter by default)
- Optional Tavily web search

## Local setup
1. Install Node.js 20+ and pnpm.
2. Copy `backend/worker/.dev.vars.example` to `backend/worker/.dev.vars` and set `OPENROUTER_API_KEY`.
3. Create D1 and KV resources; replace placeholder IDs in `backend/worker/wrangler.jsonc`.
4. Run `pnpm install`, then `pnpm --filter @akshar/worker db:migrate:local`.
5. Run `pnpm dev:worker` and `pnpm dev` in separate terminals.

## Deploy
Set secrets using Wrangler, for example `pnpm --filter @akshar/worker exec wrangler secret put OPENROUTER_API_KEY`; add `TAVILY_API_KEY` for live search. Build the frontend and deploy with `pnpm build && pnpm deploy`.

## Vision
Attach up to four HTTPS image URLs or base64 data URLs to `POST /api/chat` in the `images` array. The API selects the vision agent and forwards the images to the configured vision-capable model. Set `VISION_MODEL` to a model available on your provider. Provider keys must remain Worker secrets.

## Production checklist
- Replace Cloudflare D1/KV placeholder IDs and run remote migrations.
- Set `FIREBASE_WEB_API_KEY` as a Worker secret and configure the frontend Firebase variables to require verified Firebase ID tokens. Without that secret, the API accepts guest IDs for local development only; do not expose guest mode publicly.
- Add rate limiting and Turnstile, set a production CORS origin, and review model-provider privacy and costs.
