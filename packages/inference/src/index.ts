/**
 * Local inference layer.
 *
 * Talks to an OpenAI-compatible Chat Completions HTTP API
 * (INFERENCE_BASE_URL, typically a local /v1 endpoint). Public
 * types stay OpenAI-shaped — do not leak vendor-specific types
 * so the backend can be swapped later.
 *
 * @packageDocumentation
 */

export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  InferenceClient,
  ModelRouter,
  ModelRouterConfig,
  ModelUnloader,
  TaskKind,
} from "./types.js";
export { OpenAICompatibleClient } from "./openai-client.js";
export { OllamaUnloader } from "./ollama-unloader.js";
export { KeepAliveModelRouter, modelForTask } from "./model-router.js";

import type { ChatRequest, ChatResponse, InferenceClient, ModelRouter } from "./types.js";

/** Skeleton stub — no network. */
export class InferenceClientStub implements InferenceClient {
  async chat(_request: ChatRequest): Promise<ChatResponse> {
    throw new Error("not implemented");
  }
}

/** Skeleton stub — no VRAM management. */
export class ModelRouterStub implements ModelRouter {
  async route(_request: ChatRequest): Promise<ChatResponse> {
    throw new Error("not implemented");
  }
  async unload(): Promise<void> {
    throw new Error("not implemented");
  }
  loadedModel(): string | null {
    return null;
  }
}
