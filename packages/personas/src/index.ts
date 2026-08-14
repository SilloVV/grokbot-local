/**
 * Persona registry.
 *
 * Personas are YAML files under personas/. Optional `vm` block describes
 * the dedicated isolated VM for that personality.
 *
 * @packageDocumentation
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface PersonaVmConfig {
  enabled?: boolean;
  image?: string;
  memory?: string;
  cpus?: string;
}

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
  vm?: PersonaVmConfig;
}

export interface PersonaRegistry {
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
