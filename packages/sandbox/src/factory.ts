import { DockerSandboxExecutor } from "./docker-executor.js";
import { E2BSandboxExecutor } from "./e2b-executor.js";
import type { ArgvRunner, SandboxConfig, SandboxExecutor } from "./types.js";

export function createSandbox(
  config: SandboxConfig,
  runner?: ArgvRunner,
): SandboxExecutor {
  if (config.mode === "remote") {
    return new E2BSandboxExecutor({
      apiKey: config.e2bApiKey,
      apiUrl: config.e2bApiUrl,
    });
  }
  return new DockerSandboxExecutor({
    image: config.image,
    dockerBin: config.dockerBin,
    memory: config.memory,
    cpus: config.cpus,
    runner,
  });
}

export function sandboxConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SandboxConfig {
  const mode = env.SANDBOX_MODE === "remote" ? "remote" : "local";
  return {
    mode,
    image: env.SANDBOX_IMAGE ?? "node:22-alpine",
    dockerBin: env.SANDBOX_DOCKER_BIN ?? "docker",
    memory: env.SANDBOX_MEMORY ?? "256m",
    cpus: env.SANDBOX_CPUS ?? "0.5",
    e2bApiKey: env.E2B_API_KEY,
    e2bApiUrl: env.E2B_API_URL,
  };
}
