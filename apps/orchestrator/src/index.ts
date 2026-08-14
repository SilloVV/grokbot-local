/**
 * HTTP entrypoint. Binds ORCHESTRATOR_HOST:ORCHESTRATOR_PORT
 * (defaults 127.0.0.1:8787). Does not call the inference backend.
 */
import { serve } from "@hono/node-server";
import { app } from "./routes.js";

const host = process.env.ORCHESTRATOR_HOST ?? "127.0.0.1";
const port = Number(process.env.ORCHESTRATOR_PORT ?? 8787);

serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  console.log(`orchestrator listening on http://${info.address}:${info.port}`);
});
