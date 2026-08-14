/**
 * Isolated command execution.
 *
 * SANDBOX_MODE=local — Docker containers spawned on demand.
 * SANDBOX_MODE=remote — E2B (E2B_API_KEY).
 *
 * User commands never run on the host. `docker` is the only host binary
 * invoked, and the user string is an argument inside the container.
 *
 * @packageDocumentation
 */

export type {
  ArgvRunner,
  SandboxConfig,
  SandboxExecutor,
  SandboxMode,
  SandboxRunInput,
  SandboxRunResult,
} from "./types.js";
export { DockerSandboxExecutor, buildDockerArgv } from "./docker-executor.js";
export { E2BSandboxExecutor } from "./e2b-executor.js";
export { createSandbox, sandboxConfigFromEnv } from "./factory.js";
export { SpawnArgvRunner } from "./argv-runner.js";
export { SandboxExecutorStub } from "./stub.js";
