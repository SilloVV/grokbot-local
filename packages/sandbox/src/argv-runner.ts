import { spawn } from "node:child_process";
import type { ArgvRunner, SandboxRunResult } from "./types.js";

/**
 * Spawns argv[0] with the remaining args. The user command is never
 * passed to a host shell — only as arguments to `docker`.
 */
export class SpawnArgvRunner implements ArgvRunner {
  async run(argv: string[], timeoutMs: number): Promise<SandboxRunResult> {
    const bin = argv[0];
    if (!bin) throw new Error("empty argv");
    return new Promise((resolve, reject) => {
      const child = spawn(bin, argv.slice(1), {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`sandbox timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });
    });
  }
}
