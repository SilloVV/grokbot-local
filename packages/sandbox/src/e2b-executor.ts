import type { SandboxExecutor, SandboxRunInput, SandboxRunResult } from "./types.js";

export interface E2BExecutorOptions {
  apiKey?: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Remote sandbox via E2B. Only used when SANDBOX_MODE=remote.
 * Default path stays 100% local Docker — this adapter is optional.
 *
 * Uses the E2B sandbox REST surface: create → run command → kill.
 * If the HTTP shape drifts, swap this file; SandboxExecutor stays stable.
 */
export class E2BSandboxExecutor implements SandboxExecutor {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: E2BExecutorOptions = {}) {
    this.apiKey = options.apiKey ?? "";
    this.apiUrl = (options.apiUrl ?? "https://api.e2b.dev").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    if (!this.apiKey) {
      throw new Error("E2B_API_KEY required when SANDBOX_MODE=remote");
    }
    const headers = {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
    };
    const created = await this.fetchImpl(`${this.apiUrl}/sandboxes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ timeoutMs: input.timeoutMs ?? 15_000 }),
    });
    if (!created.ok) {
      throw new Error(`e2b create failed: ${created.status} ${await created.text()}`);
    }
    const box = (await created.json()) as { sandboxID?: string; id?: string };
    const id = box.sandboxID ?? box.id;
    if (!id) throw new Error("e2b create returned no sandbox id");
    try {
      for (const [path, content] of Object.entries(input.files ?? {})) {
        const wr = await this.fetchImpl(`${this.apiUrl}/sandboxes/${id}/files`, {
          method: "POST",
          headers,
          body: JSON.stringify({ path, content }),
        });
        if (!wr.ok) throw new Error(`e2b write ${path} failed: ${wr.status}`);
      }
      const ran = await this.fetchImpl(`${this.apiUrl}/sandboxes/${id}/commands`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          command: input.command,
          timeoutMs: input.timeoutMs ?? 15_000,
        }),
      });
      if (!ran.ok) {
        throw new Error(`e2b run failed: ${ran.status} ${await ran.text()}`);
      }
      const data = (await ran.json()) as {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
      };
      return {
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        exitCode: data.exitCode ?? 0,
      };
    } finally {
      await this.fetchImpl(`${this.apiUrl}/sandboxes/${id}`, {
        method: "DELETE",
        headers,
      }).catch(() => undefined);
    }
  }
}
