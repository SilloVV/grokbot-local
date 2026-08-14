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
  /** Ollama keep_alive duration (e.g. "30s") or 0 to unload. */
  keep_alive?: string | number;
  /** Context window for the loaded model (Ollama options.num_ctx). */
  num_ctx?: number;
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
 */
export interface ModelRouter {
  route(request: ChatRequest): Promise<ChatResponse>;
  unload(): Promise<void>;
  /** Currently loaded model id, or null if VRAM is free. */
  loadedModel(): string | null;
}

export interface ModelRouterConfig {
  mainModel: string;
  routerModel: string;
  keepAlive?: string;
  mainNumCtx?: number;
}

/** Native Ollama host used only for unload (keep_alive=0). */
export interface ModelUnloader {
  unload(model: string): Promise<void>;
}
