export interface Env {
 DB: D1Database; CACHE: KVNamespace; ASSETS: Fetcher;
 OPENROUTER_API_KEY?: string; TAVILY_API_KEY?: string; FIREBASE_WEB_API_KEY?: string;
 MODEL_BASE_URL?: string; CHAT_MODEL?: string; VISION_MODEL?: string; APP_NAME?: string; CORS_ORIGIN?: string;
}
export interface AuthUser { id:string; email?:string; name?:string; }