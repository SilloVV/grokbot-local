/**
 * Persona registry.
 *
 * Personas are YAML files under personas/ at the repo root. Drop a new
 * file there — no code change required. All personas are system-prompt
 * variations over the same underlying model.
 *
 * Switching persona on a thread MUST NOT wipe memory. Only personaId
 * (and therefore the system prompt / tone / inference params) changes;
 * MemoryStore messages stay put.
 *
 * @packageDocumentation
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

/** Matches the YAML schema in personas/*.yaml. */
export interface Persona {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  tone: string;
  inference: {
    temperature: number;
    max_tokens: number;
  };
}

export interface PersonaRegistry {
  /** Load every *.yaml file from personas/ (or dir). */
  loadAll(dir?: string): Promise<Persona[]>;
  get(id: string): Promise<Persona | undefined>;
}

function isPersona(value: unknown): value is Persona {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const inf = v.inference as Record<string, unknown> | undefined;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.description === "string" &&
    typeof v.system_prompt === "string" &&
    typeof v.tone === "string" &&
    typeof inf?.temperature === "number" &&
    typeof inf?.max_tokens === "number"
  );
}

/**
 * File-backed registry. Reads YAML from disk on each loadAll (no cache
 * yet — scaffolding only).
 */
export class FilePersonaRegistry implements PersonaRegistry {
  constructor(private readonly dir: string) {}

  async loadAll(dir = this.dir): Promise<Persona[]> {
    const names = await readdir(dir);
    const personas: Persona[] = [];
    for (const name of names) {
      if (!name.endsWith(".yaml") && !name.endsWith(".yml")) continue;
      const raw = await readFile(join(dir, name), "utf8");
      const parsed: unknown = parseYaml(raw);
      if (!isPersona(parsed)) {
        throw new Error(`invalid persona YAML: ${name}`);
      }
      personas.push(parsed);
    }
    return personas;
  }

  async get(id: string): Promise<Persona | undefined> {
    const all = await this.loadAll();
    return all.find((p) => p.id === id);
  }
}
