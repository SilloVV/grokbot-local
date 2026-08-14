export interface SandboxRunInput {
  command: string;
  files?: Record<string, string>;
  timeoutMs?: number;
  /** Optional thread id — used as a label, not a host path for execution. */
  threadId?: string;
}

export interface SandboxRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxExecutor {
  run(input: SandboxRunInput): Promise<SandboxRunResult>;
}

export type SandboxMode = "local" | "remote";

export interface SandboxConfig {
  mode: SandboxMode;
  image?: string;
  dockerBin?: string;
  memory?: string;
  cpus?: string;
  e2bApiKey?: string;
  e2bApiUrl?: string;
}

/**
 * Runs a argv vector. Used so tests can mock `docker` without
 * ever executing the user command on the host.
 */
export interface ArgvRunner {
  run(argv: string[], timeoutMs: number): Promise<SandboxRunResult>;
}
