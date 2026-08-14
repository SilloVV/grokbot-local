/**
 * Isolated command execution and per-persona VMs.
 *
 * SANDBOX_MODE=local — Docker. SANDBOX_MODE=remote — E2B.
 * Each persona can have its own long-lived VM (container + volume).
 * User commands never run on the host.
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
export {
  DockerPersonaVmManager,
  buildCreateArgv,
  safePersonaId,
  vmName,
  volumeName,
} from "./persona-vm.js";
export type {
  PersonaVmManager,
  PersonaVmSpec,
  PersonaVmState,
  PersonaVmStatus,
} from "./persona-vm.js";
