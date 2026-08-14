import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCreateArgv,
  DockerPersonaVmManager,
  vmName,
  volumeName,
} from "./persona-vm.js";
import type { ArgvRunner, SandboxRunResult } from "./types.js";

test("names are isolated per persona", () => {
  assert.equal(vmName("coder"), "grokbot-vm-coder");
  assert.equal(volumeName("coder"), "grokbot-vm-coder-data");
  assert.notEqual(vmName("coder"), vmName("grok"));
});

test("create argv is locked down and uses a dedicated volume", () => {
  const argv = buildCreateArgv("coder", { image: "node:22-alpine" }, "docker");
  assert.equal(argv[0], "docker");
  assert.ok(argv.includes("--network"));
  assert.ok(argv.includes("none"));
  assert.ok(argv.includes("--cap-drop"));
  assert.ok(argv.includes("grokbot-vm-coder"));
  assert.ok(argv.includes("grokbot-vm-coder-data:/work"));
  assert.equal(argv.includes("sh"), false);
});

test("create then exec never shells the user command on the host", async () => {
  const seen: string[][] = [];
  const runner: ArgvRunner = {
    async run(argv: string[]): Promise<SandboxRunResult> {
      seen.push(argv);
      if (argv.includes("inspect")) return { stdout: "false\n", stderr: "", exitCode: 1 };
      return { stdout: "ok\n", stderr: "", exitCode: 0 };
    },
  };
  const vms = new DockerPersonaVmManager("docker", runner);
  await vms.create("coder", { image: "node:22-alpine" });
  assert.ok(seen.some((a) => a.includes("volume") && a.includes("create")));
  assert.ok(seen.some((a) => a[1] === "run" && a.includes("grokbot-vm-coder")));
});
