import type { RoutineEngine, RoutineRunner } from "./types.js";

export class RoutineScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly engine: RoutineEngine,
    private readonly run: RoutineRunner,
    private readonly intervalMs = 15_000,
  ) {}

  async start(): Promise<void> {
    const all = await this.engine.list();
    for (const r of all) {
      if (r.enabled && r.trigger === "on_startup") {
        await this.safeRun(r.id);
      }
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    const due = await this.engine.due(new Date());
    for (const r of due) await this.safeRun(r.id);
  }

  private async safeRun(id: string): Promise<void> {
    const list = await this.engine.list();
    const routine = list.find((r) => r.id === id);
    if (!routine) return;
    try {
      const result = await this.run(routine);
      await this.engine.markRun(id, result?.threadId);
    } catch (err) {
      console.error(`routine ${routine.name} failed`, err);
    }
  }
}
