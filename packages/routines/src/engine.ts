import { cronMatches } from "./cron.js";
import type { Routine, RoutineEngine } from "./types.js";

export class InMemoryRoutineEngine implements RoutineEngine {
  private routines = new Map<string, Routine>();
  private lastTickKey = "";

  async list(): Promise<Routine[]> {
    return [...this.routines.values()];
  }

  async create(input: Omit<Routine, "id">): Promise<Routine> {
    const routine: Routine = { ...input, id: crypto.randomUUID() };
    this.routines.set(routine.id, routine);
    return routine;
  }

  async pause(id: string): Promise<Routine> {
    const routine = this.routines.get(id);
    if (!routine) throw new Error(`routine not found: ${id}`);
    const next: Routine = { ...routine, enabled: false };
    this.routines.set(id, next);
    return next;
  }

  async delete(id: string): Promise<void> {
    this.routines.delete(id);
  }

  async markRun(id: string, threadId?: string): Promise<Routine> {
    const routine = this.routines.get(id);
    if (!routine) throw new Error(`routine not found: ${id}`);
    const next: Routine = {
      ...routine,
      lastRunAt: new Date().toISOString(),
      threadId: threadId ?? routine.threadId,
    };
    this.routines.set(id, next);
    return next;
  }

  async due(now: Date): Promise<Routine[]> {
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (key === this.lastTickKey) return [];
    this.lastTickKey = key;
    return [...this.routines.values()].filter((r) => {
      if (!r.enabled || !r.schedule) return false;
      if (r.lastRunAt) {
        const last = new Date(r.lastRunAt);
        if (
          last.getFullYear() === now.getFullYear() &&
          last.getMonth() === now.getMonth() &&
          last.getDate() === now.getDate() &&
          last.getHours() === now.getHours() &&
          last.getMinutes() === now.getMinutes()
        ) {
          return false;
        }
      }
      return cronMatches(r.schedule, now);
    });
  }
}
