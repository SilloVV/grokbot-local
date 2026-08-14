import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  ArgvRunner,
  SandboxExecutor,
  SandboxRunInput,
  SandboxRunResult,
} from "./types.js";
import { SpawnArgvRunner } from "./argv-runner.js";

export interface DockerExecutorOptions {
  image?: string;
  dockerBin?: string;
  memory?: string;
  cpus?: string;
  runner?: ArgvRunner;
}

/**
 * Build the `docker run` argv. User command is a single argument to
 * `sh -c` *inside* the container, never a host shell string.
 */
export function buildDockerArgv(
  workDir: string,
  command: string,
  options: {
    image: string;
    dockerBin: string;
    memory: string;
    cpus: string;
    timeoutSec: number;
  },
): string[] {
  return [
    options.dockerBin,
    "run",
    "--rm",
    "--network",
    "none",
    "--memory",
    options.memory,
    "--cpus",
    options.cpus,
    "--pids-limit",
    "64",
    "--user",
    "65534:65534",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,nosuid,size=64m",
    "--workdir",
    "/work",
    "--volume",
    `${workDir}:/work:rw`,
    "--stop-timeout",
    String(options.timeoutSec),
    options.image,
    "sh",
    "-c",
    command,
  ];
}

export class DockerSandboxExecutor implements SandboxExecutor {
  private readonly image: string;
  private readonly dockerBin: string;
  private readonly memory: string;
  private readonly cpus: string;
  private readonly runner: ArgvRunner;

  constructor(options: DockerExecutorOptions = {}) {
    this.image = options.image ?? "node:22-alpine";
    this.dockerBin = options.dockerBin ?? "docker";
    this.memory = options.memory ?? "256m";
    this.cpus = options.cpus ?? "0.5";
    this.runner = options.runner ?? new SpawnArgvRunner();
  }

  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    const timeoutMs = input.timeoutMs ?? 15_000;
    const workDir = mkdtempSync(join(tmpdir(), "grokbot-sandbox-"));
    try {
      for (const [name, body] of Object.entries(input.files ?? {})) {
        if (name.includes("..") || name.startsWith("/") || name.includes("\\")) {
          throw new Error(`illegal sandbox filename: ${name}`);
        }
        writeFileSync(join(workDir, name), body, { encoding: "utf8", mode: 0o644 });
      }
      const argv = buildDockerArgv(workDir, input.command, {
        image: this.image,
        dockerBin: this.dockerBin,
        memory: this.memory,
        cpus: this.cpus,
        timeoutSec: Math.max(1, Math.ceil(timeoutMs / 1000)),
      });
      return await this.runner.run(argv, timeoutMs);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}
