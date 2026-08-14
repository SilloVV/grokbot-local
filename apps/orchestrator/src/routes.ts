/**
 * Route stubs. In-memory stores only — no inference backend, no containers, no SQLite.
 *
 * POST /threads/:id/persona switches persona and keeps memory.
 */
import { Hono } from "hono";
import { join } from "node:path";
import { InMemoryMemoryStore, type ThreadMessage } from "@grokbot/memory";
import { FilePersonaRegistry } from "@grokbot/personas";
import { InMemoryRoutineEngine } from "@grokbot/routines";
import { SandboxExecutorStub } from "@grokbot/sandbox";
import { InferenceClientStub, ModelRouterStub } from "@grokbot/inference";

const personasDir =
  process.env.PERSONAS_DIR ?? join(process.cwd(), "../../personas");

const memory = new InMemoryMemoryStore();
const personas = new FilePersonaRegistry(personasDir);
const routines = new InMemoryRoutineEngine();

/** Held so the graph is wired; never called on these routes. */
void new SandboxExecutorStub();
void new InferenceClientStub();
void new ModelRouterStub();

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true as const }));

app.get("/personas", async (c) => {
  const list = await personas.loadAll();
  return c.json(list);
});

app.get("/threads", async (c) => {
  return c.json(await memory.listThreads());
});

app.post("/threads", async (c) => {
  const body = await c.req.json<{ personaId?: string }>().catch(() => ({}));
  const personaId = body.personaId ?? "factual";
  const thread = await memory.createThread(personaId);
  return c.json(thread, 201);
});

app.get("/threads/:id", async (c) => {
  const thread = await memory.getThread(c.req.param("id"));
  if (!thread) return c.json({ error: "not found" }, 404);
  return c.json(thread);
});

app.post("/threads/:id/messages", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Pick<ThreadMessage, "role" | "content">>();
  const message: ThreadMessage = {
    role: body.role,
    content: body.content,
    createdAt: new Date().toISOString(),
  };
  try {
    const thread = await memory.appendMessage(id, message);
    return c.json(thread);
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

/**
 * Switch persona; keep memory. Does not rewrite or drop messages.
 */
app.post("/threads/:id/persona", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ personaId: string }>();
  const persona = await personas.get(body.personaId);
  if (!persona) return c.json({ error: "unknown persona" }, 400);
  try {
    const thread = await memory.setPersona(id, body.personaId);
    return c.json(thread);
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

app.get("/routines", async (c) => {
  return c.json(await routines.list());
});

app.post("/routines", async (c) => {
  const body = await c.req.json<{
    name: string;
    schedule?: string;
    trigger?: string;
    prompt: string;
    enabled?: boolean;
  }>();
  const routine = await routines.create({
    name: body.name,
    schedule: body.schedule,
    trigger: body.trigger,
    prompt: body.prompt,
    enabled: body.enabled ?? true,
  });
  return c.json(routine, 201);
});
