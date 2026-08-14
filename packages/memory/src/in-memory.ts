import type { MemoryStore, Thread, ThreadMessage } from "./types.js";

/** In-memory stub for tests and boot without SQLite. */
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
