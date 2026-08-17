import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatRequest, ChatResponse, ModelRouter } from "@grokbot/inference";
import { InMemoryMemoryStore } from "@grokbot/memory";
import type { Persona, PersonaRegistry } from "@grokbot/personas";
import type { PersonaVmManager, PersonaVmStatus, SandboxRunResult } from "@grokbot/sandbox";
import { handleUserMessage } from "./agent.js";
import {
  COMPUTER_APPENDIX,
  formatToolResult,
  parseComputerBlocks,
  stripComputerBlocks,
} from "./computer.js";

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

class IdleVms implements PersonaVmManager {
  execCalls = 0;
  private statusOf(personaId: string): PersonaVmStatus {
    return {
      personaId,
      name: `vrac-vm-${personaId}`,
      volume: `vrac-vm-${personaId}-data`,
      state: "missing",
    };
  }
  async status(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async create(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async start(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async stop(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async destroy(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async exec(): Promise<SandboxRunResult> {
    this.execCalls += 1;
    throw new Error("vms.exec should not be called");
  }
}

class ScriptedRouter implements ModelRouter {
  last?: ChatRequest;
  tasks: Array<ChatRequest["task"]> = [];
  private i = 0;
  constructor(private readonly replies: string[]) {}
  async route(request: ChatRequest): Promise<ChatResponse> {
    this.last = request;
    this.tasks.push(request.task);
    const content = this.replies[Math.min(this.i, this.replies.length - 1)] ?? "";
    this.i += 1;
    return {
      id: String(this.i),
      model: "fake",
      message: { role: "assistant", content },
    };
  }
  async unload(): Promise<void> {}
  loadedModel(): string | null {
    return null;
  }
}

class RecordingVms implements PersonaVmManager {
  commands: string[] = [];
  state: PersonaVmStatus["state"] = "running";
  private statusOf(personaId: string): PersonaVmStatus {
    return {
      personaId,
      name: `vrac-vm-${personaId}`,
      volume: `vrac-vm-${personaId}-data`,
      state: this.state,
    };
  }
  async status(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async create(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async start(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async stop(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async destroy(personaId: string): Promise<PersonaVmStatus> {
    return this.statusOf(personaId);
  }
  async exec(_personaId: string, command: string): Promise<SandboxRunResult> {
    this.commands.push(command);
    return { stdout: "Linux test 6.1.0\n", stderr: "", exitCode: 0 };
  }
}

test("message loop appends user + assistant and keeps persona memory", async () => {
  const memory = new InMemoryMemoryStore();
  const router = new FakeRouter();
  const vms = new IdleVms();
  const thread = await memory.createThread("factual");
  const result = await handleUserMessage(
    { memory, personas: new OnePersona(), router, vms },
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
  assert.equal(router.last?.messages[1]?.content, COMPUTER_APPENDIX);
  assert.equal(result.personaId, "factual");
  assert.equal(vms.execCalls, 0);
});

test("computer block runs on the persona VM then continues the turn", async () => {
  const memory = new InMemoryMemoryStore();
  const router = new ScriptedRouter([
    "<<<computer>>>\nuname -a\n<<</computer>>>",
    "kernel looks fine",
  ]);
  const vms = new RecordingVms();
  const thread = await memory.createThread("factual");
  const result = await handleUserMessage(
    { memory, personas: new OnePersona(), router, vms },
    thread.id,
    "check the kernel",
  );
  assert.deepEqual(
    result.messages.map((m) => m.role),
    ["user", "assistant", "tool", "assistant"],
  );
  assert.equal(result.messages[0]?.content, "check the kernel");
  assert.match(result.messages[1]?.content ?? "", /uname -a/);
  assert.equal(result.messages[2]?.content, "$ uname -a\nLinux test 6.1.0\nexit 0");
  assert.equal(result.messages[3]?.content, "kernel looks fine");
  assert.deepEqual(vms.commands, ["uname -a"]);
  assert.equal(router.tasks[0], "conversation");
  assert.equal(router.tasks[1], "tool");
});

test("offline VM does not exec on the host", async () => {
  const memory = new InMemoryMemoryStore();
  const router = new ScriptedRouter([
    "<<<computer>>>uname -a<<< /computer>>>",
    "the computer is offline",
  ]);
  const vms = new RecordingVms();
  vms.state = "stopped";
  const thread = await memory.createThread("factual");
  const result = await handleUserMessage(
    { memory, personas: new OnePersona(), router, vms },
    thread.id,
    "uname",
  );
  assert.deepEqual(vms.commands, []);
  assert.match(result.messages[2]?.content ?? "", /computer offline/);
});

test("parseComputerBlocks accepts spaced close tag and rejects multi-shell", () => {
  assert.deepEqual(parseComputerBlocks("<<<computer>>>uname -a<<< /computer>>>"), ["uname -a"]);
  assert.deepEqual(parseComputerBlocks("<<<computer>>>\nls -la\n<<</computer>>>"), ["ls -la"]);
  assert.deepEqual(parseComputerBlocks("<<<computer>>>\nls\npwd\n<<</computer>>>"), []);
  assert.deepEqual(parseComputerBlocks("<<<computer>>>\n  \n<<</computer>>>"), []);
  assert.equal(stripComputerBlocks("hi <<<computer>>>x<<</computer>>> there"), "hi  there");
  assert.equal(
    formatToolResult("pwd", { stdout: "/work\n", stderr: "", exitCode: 0 }),
    "$ pwd\n/work\nexit 0",
  );
});
