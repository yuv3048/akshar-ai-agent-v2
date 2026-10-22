import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import api from "./routes/api";

const app = new Hono<{Bindings:Env}>();
app.use("/api/*", async (c,next) => {
  const allowed = c.env.CORS_ORIGIN || "http://localhost:5173";
  return cors({origin:allowed,allowMethods:["GET","POST","DELETE","OPTIONS"],allowHeaders:["Content-Type","Authorization","X-User-Id"],credentials:true})(c,next);
});
app.route("/api",api);
app.onError((err,c) => {
  console.error("unhandled request error",err);
  return c.json({error:"Internal server error"},500);
});
app.notFound(c => c.env.ASSETS.fetch(c.req.raw));
export default app;