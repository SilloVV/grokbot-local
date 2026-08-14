# Contributing

Keep changes small.

## Code style

- TypeScript, strict, small modules.
- Interfaces and JSDoc live in `packages/*`. Apps wire them; they do not re-declare types.
- No secrets in the tree. Copy `.env.example` to `.env` locally.

## Adding a persona

Drop a YAML file in `personas/`. No code change.

Required keys: `id`, `name`, `description`, `system_prompt`, `tone`, `inference.temperature`, `inference.max_tokens`.

Personas are system-prompt variations over the same model. Switching persona on a thread must not wipe memory.

## Adding a tool / action

1. Put the executor behind `SandboxExecutor` (`packages/sandbox`). Never run on the host.
2. `SANDBOX_MODE=local` spawns a locked-down Docker container (`--network none`, `--cap-drop ALL`). `SANDBOX_MODE=remote` uses E2B.
3. Expose it via `POST /threads/:id/sandbox` with `{ "command", "files?", "timeoutMs?" }`.

## Packages

| Package | Role |
| --- | --- |
| `@grokbot/inference` | OpenAI-compatible client + VRAM-aware model router |
| `@grokbot/memory` | Threads / messages (SQLite default, Postgres later) |
| `@grokbot/sandbox` | Isolated command execution (Docker local / E2B remote) |
| `@grokbot/routines` | Scheduled / triggered prompts |
| `@grokbot/personas` | YAML loader + registry |

Each persona can own a dedicated VM (Docker container + volume). Create it with POST /personas/:id/vm. Commands on a thread use that VM when it is running.
