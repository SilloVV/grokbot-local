#!/usr/bin/env bash
set -euo pipefail
echo "Pulling TEST models only (small, for e2e validation)"
ollama pull qwen2.5:0.5b
ollama pull qwen2.5:1.5b
echo "Done. Target models (do not pull until e2e is validated):"
echo "  # ollama pull qwen3.8:27b-q4_K_M"
echo "  # ollama pull qwen2.5:3b-instruct"
