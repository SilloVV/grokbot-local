/**
 * HTTP routes. SQLite memory + model router + isolated sandbox +
 * per-persona VMs + routines.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ModelRouter } from "@grokbot/inference";
import type { MemoryStore, ThreadMessage } from "@grokbot/memory";
import type { PersonaRegistry } from "@grokbot/personas";
import type { RoutineEngine } from "@grokbot/routines";
import type { PersonaVmManager, SandboxExecutor, SandboxMode } from "@grokbot/sandbox";
import { handleUserMessage } from "./agent.js";

export interface RouteDeps {
  memory: MemoryStore;
  personas: PersonaRegistry;
  router: ModelRouter;
  sandbox: SandboxExecutor;
  sandboxMode: SandboxMode;
  routines: RoutineEngine;
  vms: PersonaVmManager;
  inferenceReachable?: () => Promise<boolean>;
}

export function createApp(deps: RouteDeps): Hono {
  const app = new Hono();
  app.use("*", cors());

  app.get("/health", async (c) => {
    let reachable = false;
    try {
      reachable = deps.inferenceReachable ? await deps.inferenceReachable() : false;
    } catch {
      reachable = false;
    }
    return c.json({
      ok: true as const,
      inference: { configured: true, reachable },
      sandbox: { mode: deps.sandboxMode },
    });
  });

  app.get("/personas", async (c) => c.json(await deps.personas.loadAll()));

  app.get("/personas/:id/vm", async (c) => {
    const persona = await deps.personas.get(c.req.param("id"));
    if (!persona) return c.json({ error: "unknown persona" }, 404);
    return c.json(await deps.vms.status(persona.id));
  });

  app.post("/personas/:id/vm", async (c) => {
    const persona = await deps.personas.get(c.req.param("id"));
    if (!persona) return c.json({ error: "unknown persona" }, 404);
    const body = await c.req.json<{ action?: string }>().catch(() => ({}));
    const action = body.action ?? "create";
    try {
      if (action === "start") return c.json(await deps.vms.start(persona.id));
      if (action === "stop") return c.json(await deps.vms.stop(persona.id));
      if (action === "destroy") return c.json(await deps.vms.destroy(persona.id));
      return c.json(await deps.vms.create(persona.id, persona.vm), 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "vm error";
      return c.json({ error: message }, 500);
    }
  });

  app.delete("/personas/:id/vm", async (c) => {
    const persona = await deps.personas.get(c.req.param("id"));
    if (!persona) return c.json({ error: "unknown persona" }, 404);
    return c.json(await deps.vms.destroy(persona.id));
  });

  app.get("/threads", async (c) => c.json(await deps.memory.listThreads()));

  app.post("/threads", async (c) => {
    const body = await c.req.json<{ personaId?: string }>().catch(() => ({}));
    const personaId = body.personaId ?? "factual";
    const persona = await deps.personas.get(personaId);
    if (!persona) return c.json({ error: "unknown persona" }, 400);
    const thread = await deps.memory.createThread(personaId);
    return c.json(thread, 201);
  });

  app.get("/threads/:id", async (c) => {
    const thread = await deps.memory.getThread(c.req.param("id"));
    if (!thread) return c.json({ error: "not found" }, 404);
    return c.json(thread);
  });

  app.get("/threads/:id/computer", async (c) => {
    const thread = await deps.memory.getThread(c.req.param("id"));
    if (!thread) return c.json({ error: "not found" }, 404);
    const messages = thread.messages.filter((m) => m.role === "tool");
    return c.json({ messages });
  });

  app.post("/threads/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ content?: string; role?: ThreadMessage["role"] }>();
    if (!body.content) return c.json({ error: "content required" }, 400);
    try {
      const thread = await handleUserMessage(
        { memory: deps.memory, personas: deps.personas, router: deps.router, vms: deps.vms },
        id,
        body.content,
      );
      return c.json(thread);
    } catch (err) {
      const message = err instanceof Error ? err.message : "error";
      const status = message.includes("not found") ? 404 : 500;
      return c.json({ error: message }, status);
    }
  });

  app.post("/threads/:id/persona", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ personaId: string }>();
    const persona = await deps.personas.get(body.personaId);
    if (!persona) return c.json({ error: "unknown persona" }, 400);
    try {
      const thread = await deps.memory.setPersona(id, body.personaId);
      return c.json(thread);
    } catch {
      return c.json({ error: "not found" }, 404);
    }
  });

  app.post("/threads/:id/sandbox", async (c) => {
    const id = c.req.param("id");
    const thread = await deps.memory.getThread(id);
    if (!thread) return c.json({ error: "not found" }, 404);
    const body = await c.req.json<{
      command?: string;
      files?: Record<string, string>;
      timeoutMs?: number;
    }>();
    if (!body.command) return c.json({ error: "command required" }, 400);
    try {
      const vm = await deps.vms.status(thread.personaId);
      if (vm.state === "running") {
        return c.json(await deps.vms.exec(thread.personaId, body.command, body.timeoutMs));
      }
      const result = await deps.sandbox.run({
        command: body.command,
        files: body.files,
        timeoutMs: body.timeoutMs,
        threadId: id,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "sandbox error";
      return c.json({ error: message }, 500);
    }
  });

  app.get("/routines", async (c) => c.json(await deps.routines.list()));

  app.post("/routines", async (c) => {
    const body = await c.req.json<{
      name: string;
      schedule?: string;
      trigger?: string;
      prompt: string;
      enabled?: boolean;
    }>();
    if (!body.name || !body.prompt) return c.json({ error: "name and prompt required" }, 400);
    const routine = await deps.routines.create({
      name: body.name,
      schedule: body.schedule,
      trigger: body.trigger,
      prompt: body.prompt,
      enabled: body.enabled ?? true,
    });
    return c.json(routine, 201);
  });

  app.post("/routines/:id/pause", async (c) => {
    try {
      return c.json(await deps.routines.pause(c.req.param("id")));
    } catch {
      return c.json({ error: "not found" }, 404);
    }
  });

  app.delete("/routines/:id", async (c) => {
    await deps.routines.delete(c.req.param("id"));
    return c.body(null, 204);
  });

  return app;
}
