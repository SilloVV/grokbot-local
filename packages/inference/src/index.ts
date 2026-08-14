/**
 * Local inference layer.
 *
 * Talks to an OpenAI-compatible Chat Completions HTTP API
 * (INFERENCE_BASE_URL, typically a local /v1 endpoint). This module's public
 * types stay OpenAI-shaped on purpose — do not leak vendor-specific
 * types into the interface so the backend can be swapped later.
 *
 * @packageDocumentation
 */

/** Why a completion is being requested — drives main vs small model choice. */
export type TaskKind = "conversation" | "routing" | "tool";

/** A single chat turn. OpenAI-compatible role/content pair. */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

/** Request body for a chat completion. */
export interface ChatRequest {
  messages: ChatMessage[];
  /** Override the routed model id. Usually left unset so ModelRouter decides. */
  model?: string;
  temperature?: number;
  max_tokens?: number;
  task?: TaskKind;
}

/** Response body for a chat completion. */
export interface ChatResponse {
  id: string;
  model: string;
  message: ChatMessage;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI-compatible chat completions client.
 *
 * Implementations POST to {INFERENCE_BASE_URL}/chat/completions.
 * No vendor-specific types belong here.
 */
export interface InferenceClient {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

/**
 * Routes work between the main (large) model and the small (router) model.
 *
 * VRAM budget (hard constraint):
 * - Never keep both models loaded at once.
 * - Unload the small model (keep_alive: 0) before loading the main model, and vice versa.
 * - MODEL_KEEP_ALIVE controls how long a loaded model stays in VRAM after the last call.
 *
 * Typical mapping:
 * - conversation / tool -> MODEL_MAIN
 * - routing -> MODEL_ROUTER
 */
export interface ModelRouter {
  /** Pick main vs small based on TaskKind, then call InferenceClient. */
  route(request: ChatRequest): Promise<ChatResponse>;
  /** Unload the currently loaded model to free VRAM. */
  unload(): Promise<void>;
}

/** Skeleton stub — no network. */
export class InferenceClientStub implements InferenceClient {
  async chat(_request: ChatRequest): Promise<ChatResponse> {
    throw new Error("not implemented");
  }
}

/** Skeleton stub — no VRAM management yet. */
export class ModelRouterStub implements ModelRouter {
  async route(_request: ChatRequest): Promise<ChatResponse> {
    throw new Error("not implemented");
  }
  async unload(): Promise<void> {
    throw new Error("not implemented");
  }
}
