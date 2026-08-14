import type {
  ChatRequest,
  ChatResponse,
  InferenceClient,
  ModelRouter,
  ModelRouterConfig,
  ModelUnloader,
  TaskKind,
} from "./types.js";

const MAIN_TASKS: ReadonlySet<TaskKind> = new Set(["conversation", "tool"]);

export function modelForTask(
  task: TaskKind | undefined,
  config: ModelRouterConfig,
): string {
  if (task === "routing") return config.routerModel;
  if (task && MAIN_TASKS.has(task)) return config.mainModel;
  return config.mainModel;
}

/**
 * One-model-at-a-time router. Unloads the resident model before a switch
 * so Qwen 27B Q4 and the small router never share the 24 GB budget.
 */
export class KeepAliveModelRouter implements ModelRouter {
  private loaded: string | null = null;

  constructor(
    private readonly client: InferenceClient,
    private readonly unloader: ModelUnloader,
    private readonly config: ModelRouterConfig,
  ) {}

  loadedModel(): string | null {
    return this.loaded;
  }

  async unload(): Promise<void> {
    if (!this.loaded) return;
    await this.unloader.unload(this.loaded);
    this.loaded = null;
  }

  async route(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model ?? modelForTask(request.task, this.config);
    if (this.loaded && this.loaded !== model) {
      await this.unloader.unload(this.loaded);
      this.loaded = null;
    }
    const keepAlive = request.keep_alive ?? this.config.keepAlive ?? "30s";
    const numCtx =
      model === this.config.mainModel
        ? (request.num_ctx ?? this.config.mainNumCtx)
        : request.num_ctx;
    const response = await this.client.chat({
      ...request,
      model,
      keep_alive: keepAlive,
      num_ctx: numCtx,
    });
    this.loaded = model;
    return response;
  }
}
