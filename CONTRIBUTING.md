# Contributing

Skeleton-stage notes. Keep changes small.

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
2. If the desktop or another client needs it, add a thin route on the orchestrator (`apps/orchestrator/src/routes.ts`) that calls the executor.
3. Keep the route a stub until the sandbox backend exists.

## Packages

| Package | Role |
| --- | --- |
| `@grokbot/inference` | OpenAI-compatible client + VRAM-aware model router |
| `@grokbot/memory` | Threads / messages (SQLite default, Postgres later) |
| `@grokbot/sandbox` | Isolated command execution (Docker local / E2B remote) |
| `@grokbot/routines` | Scheduled / triggered prompts |
| `@grokbot/personas` | YAML loader + registry |
