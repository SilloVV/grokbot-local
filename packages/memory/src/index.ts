/**
 * Conversation memory.
 *
 * SQLite is the default backend (local file under data/).
 * Postgres is planned later via DATABASE_URL — same MemoryStore
 * interface, different adapter.
 *
 * Switching the active persona on a thread MUST NOT wipe memory.
 * Threads keep their messages when personaId is updated; only the
 * system prompt / tone / sampling params change.
 *
 * @packageDocumentation
 */

export interface ThreadMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  personaId: string;
  messages: ThreadMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStore {
  getThread(id: string): Promise<Thread | null>;
  appendMessage(threadId: string, message: ThreadMessage): Promise<Thread>;
  listThreads(): Promise<Thread[]>;
  createThread(personaId: string): Promise<Thread>;
  /**
   * Change the persona attached to a thread without touching messages.
   * Memory is preserved on purpose.
   */
  setPersona?(threadId: string, personaId: string): Promise<Thread>;
}

/**
 * In-memory stub so the orchestrator can boot without SQLite.
 * Replace with a SQLite adapter (and later Postgres via DATABASE_URL).
 */
export class InMemoryMemoryStore implements MemoryStore {
  private threads = new Map<string, Thread>();

  async getThread(id: string): Promise<Thread | null> {
    return this.threads.get(id) ?? null;
  }

  async appendMessage(threadId: string, message: ThreadMessage): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error(`thread not found: ${threadId}`);
    const next: Thread = {
      ...thread,
      messages: [...thread.messages, message],
      updatedAt: new Date().toISOString(),
    };
    this.threads.set(threadId, next);
    return next;
  }

  async listThreads(): Promise<Thread[]> {
    return [...this.threads.values()];
  }

  async createThread(personaId: string): Promise<Thread> {
    const now = new Date().toISOString();
    const thread: Thread = {
      id: crypto.randomUUID(),
      personaId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  async setPersona(threadId: string, personaId: string): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error(`thread not found: ${threadId}`);
    const next: Thread = { ...thread, personaId, updatedAt: new Date().toISOString() };
    this.threads.set(threadId, next);
    return next;
  }
}
