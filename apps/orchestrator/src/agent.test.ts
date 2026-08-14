import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatRequest, ChatResponse, ModelRouter } from "@grokbot/inference";
import { InMemoryMemoryStore } from "@grokbot/memory";
import type { Persona, PersonaRegistry } from "@grokbot/personas";
import { handleUserMessage } from "./agent.js";

const factual: Persona = {
  id: "factual",
  name: "Factual",
  description: "test",
  system_prompt: "Be concise.",
  tone: "concise",
  inference: { temperature: 0.3, max_tokens: 128 },
};

class OnePersona implements PersonaRegistry {
  async loadAll(): Promise<Persona[]> {
    return [factual];
  }
  async get(id: string): Promise<Persona | undefined> {
    return id === "factual" ? factual : undefined;
  }
}

class FakeRouter implements ModelRouter {
  last?: ChatRequest;
  async route(request: ChatRequest): Promise<ChatResponse> {
    this.last = request;
    return {
      id: "1",
      model: "fake",
      message: { role: "assistant", content: "hello from stub" },
    };
  }
  async unload(): Promise<void> {}
  loadedModel(): string | null {
    return null;
  }
}

test("message loop appends user + assistant and keeps persona memory", async () => {
  const memory = new InMemoryMemoryStore();
  const router = new FakeRouter();
  const thread = await memory.createThread("factual");
  const result = await handleUserMessage(
    { memory, personas: new OnePersona(), router },
    thread.id,
    "hi",
  );
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0]?.role, "user");
  assert.equal(result.messages[0]?.content, "hi");
  assert.equal(result.messages[1]?.content, "hello from stub");
  assert.equal(router.last?.task, "conversation");
  assert.equal(router.last?.messages[0]?.role, "system");
  assert.equal(router.last?.messages[0]?.content, "Be concise.");
  assert.equal(result.personaId, "factual");
});
