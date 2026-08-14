import type { ModelUnloader } from "./types.js";

/**
 * Unloads a model from VRAM via Ollama's native API.
 * POST /api/generate { model, keep_alive: 0 } — not part of the OpenAI surface.
 */
export class OllamaUnloader implements ModelUnloader {
  private readonly nativeBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(openaiBaseUrl: string, fetchImpl: typeof fetch = fetch) {
    this.nativeBase = openaiBaseUrl.replace(/\/$/, "").replace(/\/v1$/, "");
    this.fetchImpl = fetchImpl;
  }

  async unload(model: string): Promise<void> {
    const res = await this.fetchImpl(`${this.nativeBase}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, keep_alive: 0 }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`unload ${model} failed: ${res.status} ${text}`);
    }
    // Drain body; Ollama may stream a tiny JSON object.
    await res.text();
  }
}
