import type { ArgvRunner, SandboxRunResult } from "./types.js";
import { SpawnArgvRunner } from "./argv-runner.js";

export interface PersonaVmSpec {
  enabled?: boolean;
  image?: string;
  memory?: string;
  cpus?: string;
}

export type PersonaVmState = "missing" | "created" | "running" | "stopped";

export interface PersonaVmStatus {
  personaId: string;
  name: string;
  volume: string;
  state: PersonaVmState;
}

export interface PersonaVmManager {
  status(personaId: string): Promise<PersonaVmStatus>;
  create(personaId: string, spec?: PersonaVmSpec): Promise<PersonaVmStatus>;
  start(personaId: string): Promise<PersonaVmStatus>;
  stop(personaId: string): Promise<PersonaVmStatus>;
  destroy(personaId: string): Promise<PersonaVmStatus>;
  exec(personaId: string, command: string, timeoutMs?: number): Promise<SandboxRunResult>;
}

export function safePersonaId(id: string): string {
  const s = id.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  if (!s) throw new Error("invalid persona id");
  return s;
}

export function vmName(personaId: string): string {
  return `vrac-vm-${safePersonaId(personaId)}`;
}

export function volumeName(personaId: string): string {
  return `vrac-vm-${safePersonaId(personaId)}-data`;
}

export function buildCreateArgv(
  personaId: string,
  spec: PersonaVmSpec,
  dockerBin: string,
): string[] {
  const name = vmName(personaId);
  const volume = volumeName(personaId);
  return [
    dockerBin,
    "run",
    "-d",
    "--name",
    name,
    "--restart",
    "unless-stopped",
    "--network",
    "none",
    "--memory",
    spec.memory ?? "512m",
    "--cpus",
    spec.cpus ?? "1",
    "--pids-limit",
    "128",
    "--user",
    "65534:65534",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--volume",
    `${volume}:/work`,
    "--workdir",
    "/work",
    spec.image ?? "node:22-alpine",
    "sleep",
    "infinity",
  ];
}

/**
 * One long-lived isolated VM (Docker container + volume) per persona.
 * User commands never run on the host.
 */
export class DockerPersonaVmManager implements PersonaVmManager {
  constructor(
    private readonly dockerBin = "docker",
    private readonly runner: ArgvRunner = new SpawnArgvRunner(),
    private readonly defaultImage = "node:22-alpine",
  ) {}

  async status(personaId: string): Promise<PersonaVmStatus> {
    const name = vmName(personaId);
    const inspect = await this.runner.run(
      [this.dockerBin, "inspect", "-f", "{{.State.Running}}", name],
      8_000,
    );
    let state: PersonaVmState = "missing";
    if (inspect.exitCode === 0) {
      state = inspect.stdout.trim() === "true" ? "running" : "stopped";
    }
    return { personaId, name, volume: volumeName(personaId), state };
  }

  async create(personaId: string, spec: PersonaVmSpec = {}): Promise<PersonaVmStatus> {
    const current = await this.status(personaId);
    if (current.state !== "missing") return current;
    await this.runner.run([this.dockerBin, "volume", "create", volumeName(personaId)], 15_000);
    const argv = buildCreateArgv(personaId, { ...spec, image: spec.image ?? this.defaultImage }, this.dockerBin);
    const created = await this.runner.run(argv, 60_000);
    if (created.exitCode !== 0) {
      throw new Error(created.stderr || created.stdout || "vm create failed");
    }
    return this.status(personaId);
  }

  async start(personaId: string): Promise<PersonaVmStatus> {
    const current = await this.status(personaId);
    if (current.state === "missing") {
      return this.create(personaId);
    }
    if (current.state === "running") return current;
    await this.runner.run([this.dockerBin, "start", vmName(personaId)], 20_000);
    return this.status(personaId);
  }

  async stop(personaId: string): Promise<PersonaVmStatus> {
    const current = await this.status(personaId);
    if (current.state === "running") {
      await this.runner.run([this.dockerBin, "stop", vmName(personaId)], 20_000);
    }
    return this.status(personaId);
  }

  async destroy(personaId: string): Promise<PersonaVmStatus> {
    await this.runner.run([this.dockerBin, "rm", "-f", vmName(personaId)], 20_000);
    await this.runner.run([this.dockerBin, "volume", "rm", volumeName(personaId)], 20_000);
    return this.status(personaId);
  }

  async exec(personaId: string, command: string, timeoutMs = 15_000): Promise<SandboxRunResult> {
    const current = await this.status(personaId);
    if (current.state !== "running") {
      throw new Error(`persona VM is not running (${current.state})`);
    }
    return this.runner.run(
      [this.dockerBin, "exec", "-w", "/work", vmName(personaId), "sh", "-c", command],
      timeoutMs,
    );
  }
}
