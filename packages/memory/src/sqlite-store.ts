import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import type { MemoryStore, Thread, ThreadMessage } from "./types.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

interface ThreadRow {
  id: string;
  persona_id: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  role: ThreadMessage["role"];
  content: string;
  created_at: string;
}

/**
 * SQLite MemoryStore. Default path: ./data/grokbot.db
 * Switching persona updates persona_id only — messages stay.
 */
export class SqliteMemoryStore implements MemoryStore {
  private readonly db: import("better-sqlite3").Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        persona_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (thread_id) REFERENCES threads(id)
      );
    `);
  }

  async getThread(id: string): Promise<Thread | null> {
    const row = this.db.prepare("SELECT * FROM threads WHERE id = ?").get(id) as
      | ThreadRow
      | undefined;
    if (!row) return null;
    return this.hydrate(row);
  }

  async appendMessage(threadId: string, message: ThreadMessage): Promise<Thread> {
    const thread = await this.getThread(threadId);
    if (!thread) throw new Error(`thread not found: ${threadId}`);
    const now = message.createdAt || new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO messages (thread_id, role, content, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(threadId, message.role, message.content, now);
    this.db.prepare("UPDATE threads SET updated_at = ? WHERE id = ?").run(now, threadId);
    const next = await this.getThread(threadId);
    if (!next) throw new Error(`thread not found: ${threadId}`);
    return next;
  }

  async listThreads(): Promise<Thread[]> {
    const rows = this.db.prepare("SELECT * FROM threads ORDER BY updated_at DESC").all() as ThreadRow[];
    return rows.map((row) => this.hydrate(row));
  }

  async createThread(personaId: string): Promise<Thread> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    this.db
      .prepare(
        "INSERT INTO threads (id, persona_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, personaId, now, now);
    return { id, personaId, messages: [], createdAt: now, updatedAt: now };
  }

  async setPersona(threadId: string, personaId: string): Promise<Thread> {
    const thread = await this.getThread(threadId);
    if (!thread) throw new Error(`thread not found: ${threadId}`);
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE threads SET persona_id = ?, updated_at = ? WHERE id = ?")
      .run(personaId, now, threadId);
    const next = await this.getThread(threadId);
    if (!next) throw new Error(`thread not found: ${threadId}`);
    return next;
  }

  private hydrate(row: ThreadRow): Thread {
    const messages = this.db
      .prepare(
        "SELECT role, content, created_at FROM messages WHERE thread_id = ? ORDER BY id ASC",
      )
      .all(row.id) as MessageRow[];
    return {
      id: row.id,
      personaId: row.persona_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    };
  }
}
