import type { ChatMessage, ModelRouter } from "@grokbot/inference";
import type { MemoryStore, Thread } from "@grokbot/memory";
import type { PersonaRegistry } from "@grokbot/personas";

export interface AgentDeps {
  memory: MemoryStore;
  personas: PersonaRegistry;
  router: ModelRouter;
}

/**
 * One conversation turn: persist user message, call the main model
 * with persona system prompt + history, persist assistant reply.
 */
export async function handleUserMessage(
  deps: AgentDeps,
  threadId: string,
  content: string,
): Promise<Thread> {
  const thread = await deps.memory.getThread(threadId);
  if (!thread) throw new Error(`thread not found: ${threadId}`);
  const persona = await deps.personas.get(thread.personaId);
  if (!persona) throw new Error(`unknown persona: ${thread.personaId}`);

  await deps.memory.appendMessage(threadId, {
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  });
  const updated = await deps.memory.getThread(threadId);
  if (!updated) throw new Error(`thread not found: ${threadId}`);

  const messages: ChatMessage[] = [
    { role: "system", content: persona.system_prompt },
    ...updated.messages.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    })),
  ];

  const reply = await deps.router.route({
    task: "conversation",
    messages,
    temperature: persona.inference.temperature,
    max_tokens: persona.inference.max_tokens,
  });

  return deps.memory.appendMessage(threadId, {
    role: "assistant",
    content: reply.message.content,
    createdAt: new Date().toISOString(),
  });
}
