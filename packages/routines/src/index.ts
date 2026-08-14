/**
 * Scheduled / triggered prompt routines.
 *
 * A routine is a named prompt that fires on a cron-like schedule or a
 * named trigger. The engine is a stub: list/create/pause/delete against
 * an in-memory map so the API can boot. No scheduler is wired yet.
 *
 * @packageDocumentation
 */

export interface Routine {
  id: string;
  name: string;
  /** Cron-like schedule (e.g. 0 8 * * *). Mutually exclusive with trigger in practice. */
  schedule?: string;
  /** Named trigger (e.g. on_startup). */
  trigger?: string;
  prompt: string;
  enabled: boolean;
}

export interface RoutineEngine {
  list(): Promise<Routine[]>;
  create(input: Omit<Routine, "id">): Promise<Routine>;
  pause(id: string): Promise<Routine>;
  delete(id: string): Promise<void>;
}

/** In-memory stub so the orchestrator can boot. No jobs are fired. */
export class InMemoryRoutineEngine implements RoutineEngine {
  private routines = new Map<string, Routine>();

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
}
