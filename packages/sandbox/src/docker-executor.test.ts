import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDockerArgv, DockerSandboxExecutor } from "./docker-executor.js";
import { createSandbox, sandboxConfigFromEnv } from "./factory.js";
import { E2BSandboxExecutor } from "./e2b-executor.js";
import type { ArgvRunner, SandboxRunResult } from "./types.js";

test("docker argv never uses a host shell and drops privileges", () => {
  const argv = buildDockerArgv("/tmp/work", "python3 app.py", {
    image: "node:22-alpine",
    dockerBin: "docker",
    memory: "256m",
    cpus: "0.5",
    timeoutSec: 15,
  });
  assert.equal(argv[0], "docker");
  assert.equal(argv[1], "run");
  assert.ok(argv.includes("--network"));
  assert.ok(argv.includes("none"));
  assert.ok(argv.includes("--cap-drop"));
  assert.ok(argv.includes("ALL"));
  assert.ok(argv.includes("no-new-privileges"));
  assert.ok(argv.includes("--read-only"));
  assert.equal(argv.at(-3), "sh");
  assert.equal(argv.at(-2), "-c");
  assert.equal(argv.at(-1), "python3 app.py");
  assert.equal(argv.includes("/bin/sh"), false);
  assert.equal(argv.includes("-c") && argv[0] !== "sh", true);
});

test("executor calls docker with the user command as container argv, not host shell", async () => {
  const seen: string[][] = [];
  const runner: ArgvRunner = {
    async run(argv: string[]): Promise<SandboxRunResult> {
      seen.push(argv);
      return { stdout: "ok\n", stderr: "", exitCode: 0 };
    },
  };
  const exec = new DockerSandboxExecutor({ runner, image: "node:22-alpine" });
  const result = await exec.run({
    command: "node -e \"console.log(1)\"",
    files: { "note.txt": "hi" },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(seen.length, 1);
  const argv = seen[0] ?? [];
  assert.equal(argv[0], "docker");
  assert.equal(argv.at(-1), "node -e \"console.log(1)\"");
});

test("rejects path traversal in sandbox filenames", async () => {
  const exec = new DockerSandboxExecutor({
    runner: {
      async run(): Promise<SandboxRunResult> {
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    },
  });
  await assert.rejects(
    () => exec.run({ command: "true", files: { "../escape.txt": "nope" } }),
    /illegal sandbox filename/,
  );
});

test("factory: local -> docker, remote -> e2b", () => {
  const local = createSandbox({ mode: "local" });
  const remote = createSandbox({ mode: "remote", e2bApiKey: "k" });
  assert.equal(local.constructor.name, "DockerSandboxExecutor");
  assert.equal(remote.constructor.name, "E2BSandboxExecutor");
});

test("env defaults to local", () => {
  const cfg = sandboxConfigFromEnv({ SANDBOX_MODE: "local" });
  assert.equal(cfg.mode, "local");
  const remote = sandboxConfigFromEnv({ SANDBOX_MODE: "remote" });
  assert.equal(remote.mode, "remote");
});

test("e2b without key throws", async () => {
  const exec = new E2BSandboxExecutor({ apiKey: "" });
  await assert.rejects(
    () => exec.run({ command: "echo hi" }),
    /E2B_API_KEY/,
  );
});
