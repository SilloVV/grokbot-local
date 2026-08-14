import type { SandboxExecutor, SandboxRunInput, SandboxRunResult } from "./types.js";

/** Kept for tests that want a no-op. */
export class SandboxExecutorStub implements SandboxExecutor {
  async run(_input: SandboxRunInput): Promise<SandboxRunResult> {
    throw new Error("not implemented");
  }
}
