/**
 * Conversation memory.
 *
 * SQLite is the default backend (local file under data/).
 * Postgres is planned later via DATABASE_URL — same MemoryStore
 * interface, different adapter.
 *
 * Switching the active persona on a thread MUST NOT wipe memory.
 *
 * @packageDocumentation
 */

export type { MemoryStore, Thread, ThreadMessage } from "./types.js";
export { SqliteMemoryStore } from "./sqlite-store.js";
export { InMemoryMemoryStore } from "./in-memory.js";
