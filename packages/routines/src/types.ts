export interface Routine {
  id: string;
  name: string;
  schedule?: string;
  trigger?: string;
  prompt: string;
  enabled: boolean;
  lastRunAt?: string;
  threadId?: string;
}

export interface RoutineEngine {
  list(): Promise<Routine[]>;
  create(input: Omit<Routine, "id">): Promise<Routine>;
  pause(id: string): Promise<Routine>;
  delete(id: string): Promise<void>;
  markRun(id: string, threadId?: string): Promise<Routine>;
  due(now: Date): Promise<Routine[]>;
}

export type RoutineRunner = (routine: Routine) => Promise<{ threadId?: string } | void>;
