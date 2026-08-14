/**
 * HTTP entrypoint. Binds ORCHESTRATOR_HOST:ORCHESTRATOR_PORT
 * (defaults 127.0.0.1:8787).
 */
import { join } from "node:path";
import { serve } from "@hono/node-server";
import {
  KeepAliveModelRouter,
  OllamaUnloader,
  OpenAICompatibleClient,
} from "@grokbot/inference";
import { SqliteMemoryStore } from "@grokbot/memory";
import { FilePersonaRegistry } from "@grokbot/personas";
import { InMemoryRoutineEngine, RoutineScheduler } from "@grokbot/routines";
import { createSandbox, sandboxConfigFromEnv } from "@grokbot/sandbox";
import { handleUserMessage } from "./agent.js";
import { loadEnvFile } from "./env.js";
import { createApp } from "./routes.js";

loadEnvFile(join(process.cwd(), "../../.env"));
loadEnvFile(join(process.cwd(), ".env"));

const host = process.env.ORCHESTRATOR_HOST ?? "127.0.0.1";
const port = Number(process.env.ORCHESTRATOR_PORT ?? 8787);
const inferenceBase = process.env.INFERENCE_BASE_URL ?? "http://127.0.0.1:11434/v1";
const personasDir = process.env.PERSONAS_DIR ?? join(process.cwd(), "../../personas");
const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^sqlite:/, "")
  : join(process.cwd(), "../../data/grokbot.db");

const client = new OpenAICompatibleClient({
  baseUrl: inferenceBase,
  apiKey: process.env.INFERENCE_API_KEY,
});
const router = new KeepAliveModelRouter(client, new OllamaUnloader(inferenceBase), {
  mainModel: process.env.MODEL_MAIN ?? "qwen3.5:4b",
  routerModel: process.env.MODEL_ROUTER ?? "qwen2.5:0.5b",
  keepAlive: process.env.MODEL_KEEP_ALIVE ?? "30s",
  mainNumCtx: Number(process.env.MODEL_MAIN_NUM_CTX ?? 4096),
});

const sandboxCfg = sandboxConfigFromEnv();
const sandbox = createSandbox(sandboxCfg);
const memory = new SqliteMemoryStore(dbPath);
const personas = new FilePersonaRegistry(personasDir);
const routines = new InMemoryRoutineEngine();

const app = createApp({
  memory,
  personas,
  router,
  sandbox,
  sandboxMode: sandboxCfg.mode,
  routines,
  inferenceReachable: async () => {
    try {
      const native = inferenceBase.replace(/\/$/, "").replace(/\/v1$/, "");
      const res = await fetch(`${native}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  },
});

const scheduler = new RoutineScheduler(routines, async (routine) => {
  let threadId = routine.threadId;
  if (!threadId) {
    const thread = await memory.createThread("factual");
    threadId = thread.id;
  }
  await handleUserMessage({ memory, personas, router }, threadId, routine.prompt);
  return { threadId };
});

serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  console.log(`orchestrator listening on http://${info.address}:${info.port}`);
  console.log(`sandbox mode=${sandboxCfg.mode} image=${sandboxCfg.image}`);
  void scheduler.start();
});
