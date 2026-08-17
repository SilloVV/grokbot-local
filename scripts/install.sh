#!/usr/bin/env bash
# Linux/macOS one-click setup for Vrac. No winget; checks commands then setup/start.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf "\n==> %s\n" "$*"; }
warn() { printf "WARN: %s\n" "$*" >&2; }
fail() { printf "ERROR: %s\n" "$*" >&2; exit 1; }

if [[ ! -f "$ROOT/.env.example" ]]; then
  fail "This does not look like the Vrac repo (missing .env.example in $ROOT).
Clone https://github.com/SilloVV/Vrac.git and run: bash scripts/install.sh"
fi

need_cmd() { command -v "$1" >/dev/null 2>&1; }

if ! need_cmd node; then
  fail "Node.js 20+ is required. Install it (https://nodejs.org or your package manager) and re-run."
fi
NODE_MAJOR=$(node -v | tr -d "v" | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "Node.js $(node -v) found; need 20+. Upgrade Node and re-run."
fi
printf "Node %s\n" "$(node -v)"

if ! need_cmd git; then
  fail "Git is required. Install git and re-run."
fi
printf "%s\n" "$(git --version)"

if ! need_cmd ollama; then
  warn "Ollama is not on PATH. Test models will be skipped.
  Install from https://ollama.com then start it and run: node scripts/pull-models.mjs"
else
  printf "Ollama found\n"
fi

if ! need_cmd docker; then
  printf "\nDocker is not installed. Chat still works without it.\n"
  printf "  For the per-persona sandbox/VM later, install Docker:\n"
  printf "  https://docs.docker.com/get-docker/\n"
fi

if ! need_cmd rustc && ! need_cmd cargo; then
  printf "\nRust is not installed. The Tauri desktop window will be skipped.\n"
  printf "  Later: install Rust from https://rustup.rs then run:\n"
  printf "    pnpm --filter @grokbot/desktop dev\n"
fi

step "Enabling pnpm via corepack"
corepack enable
corepack prepare pnpm@9 --activate

step "Writing .env if needed"
node scripts/setup.mjs

step "Installing workspace packages (pnpm install)"
pnpm install

step "Pulling test models (qwen2.5:0.5b + qwen3.5:4b — not 27B)"
if ! node scripts/pull-models.mjs; then
  warn "Could not pull models (is Ollama running?). The API will still start."
  warn "Later: start Ollama, then run: node scripts/pull-models.mjs"
fi

step "Starting Vrac"
exec node scripts/start.mjs
