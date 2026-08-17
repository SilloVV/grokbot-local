import type { ChatMessage, ModelRouter } from "@grokbot/inference";
import type { MemoryStore, Thread } from "@grokbot/memory";
import type { PersonaRegistry } from "@grokbot/personas";
import type { PersonaVmManager } from "@grokbot/sandbox";
import {
  COMPUTER_APPENDIX,
  MAX_COMPUTER_ROUNDS,
  formatToolResult,
  parseComputerBlocks,
  stripComputerBlocks,
} from "./computer.js";

export interface AgentDeps {
  memory: MemoryStore;
  personas: PersonaRegistry;
  router: ModelRouter;
  vms: PersonaVmManager;
}

function toChatMessages(personaPrompt: string, thread: Thread): ChatMessage[] {
  return [
    { role: "system", content: personaPrompt },
    { role: "system", content: COMPUTER_APPENDIX },
    ...thread.messages.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    })),
  ];
}

async function runComputerCommand(
  deps: AgentDeps,
  personaId: string,
  command: string,
): Promise<string> {
  const vm = await deps.vms.status(personaId);
  if (vm.state !== "running") {
    return formatToolResult(command, { offline: true });
  }
  try {
    const result = await deps.vms.exec(personaId, command);
    return formatToolResult(command, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "exec failed";
    return formatToolResult(command, { stdout: "", stderr: message, exitCode: 1 });
  }
}

/**
 * One conversation turn: persist user message, call the main model
 * with persona system prompt + history, persist assistant reply.
 * If the model emits <<<computer>>> blocks, exec them on the persona VM
 * (never the host) and loop until a final text reply or 5 rounds.
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

  const prompt = persona.system_prompt;
  let computerRounds = 0;

  while (true) {
    const current = await deps.memory.getThread(threadId);
    if (!current) throw new Error(`thread not found: ${threadId}`);

    const reply = await deps.router.route({
      task: computerRounds > 0 ? "tool" : "conversation",
      messages: toChatMessages(prompt, current),
      temperature: persona.inference.temperature,
      max_tokens: persona.inference.max_tokens,
    });

    const raw = reply.message.content;
    const commands = parseComputerBlocks(raw);
    const done = commands.length === 0 || computerRounds >= MAX_COMPUTER_ROUNDS;
    if (done) {
      return deps.memory.appendMessage(threadId, {
        role: "assistant",
        content: stripComputerBlocks(raw) || (commands.length ? "I used the computer." : raw),
        createdAt: new Date().toISOString(),
      });
    }

    await deps.memory.appendMessage(threadId, {
      role: "assistant",
      content: raw,
      createdAt: new Date().toISOString(),
    });

    for (const command of commands) {
      const toolContent = await runComputerCommand(deps, current.personaId, command);
      await deps.memory.appendMessage(threadId, {
        role: "tool",
        content: toolContent,
        createdAt: new Date().toISOString(),
      });
    }

    computerRounds += 1;
  }
}
