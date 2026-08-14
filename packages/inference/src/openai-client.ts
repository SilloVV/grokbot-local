/**
 * OpenAI-compatible Chat Completions client.
 * Works with Ollama's /v1 endpoint and any later cloud fallback.
 */
import type { ChatMessage, ChatRequest, ChatResponse, InferenceClient } from "./types.js";

export interface OpenAIClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { role?: string; content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenAICompatibleClient implements InferenceClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!request.model) {
      throw new Error("InferenceClient.chat requires request.model");
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
    };
    if (request.keep_alive !== undefined) body.keep_alive = request.keep_alive;
    if (request.num_ctx !== undefined) body.options = { num_ctx: request.num_ctx };

    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`inference ${res.status}: ${text}`);
    }
    const data = (await res.json()) as OpenAIChatResponse;
    const message = data.choices?.[0]?.message;
    return {
      id: data.id ?? "unknown",
      model: data.model ?? request.model,
      message: {
        role: (message?.role as ChatMessage["role"]) ?? "assistant",
        content: message?.content ?? "",
      },
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens ?? 0,
            completion_tokens: data.usage.completion_tokens ?? 0,
            total_tokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }
}
