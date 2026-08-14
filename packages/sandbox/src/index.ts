/**
 * Isolated command execution.
 *
 * SANDBOX_MODE=local — containers spawned on demand by the orchestrator.
 * SANDBOX_MODE=remote — E2B (E2B_API_KEY).
 *
 * Never execute on the host. The stub below throws rather than shelling out.
 *
 * @packageDocumentation
 */

export interface SandboxRunInput {
  command: string;
  files?: Record<string, string>;
  timeoutMs?: number;
}

export interface SandboxRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxExecutor {
  run(input: SandboxRunInput): Promise<SandboxRunResult>;
}

/** Skeleton stub — does not run anything, on host or otherwise. */
export class SandboxExecutorStub implements SandboxExecutor {
  async run(_input: SandboxRunInput): Promise<SandboxRunResult> {
    throw new Error("not implemented");
  }
}
