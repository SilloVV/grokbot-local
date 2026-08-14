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
  setPersona(threadId: string, personaId: string): Promise<Thread>;
}
