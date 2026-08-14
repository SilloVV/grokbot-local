#!/usr/bin/env bash
set -euo pipefail
echo "Pulling e2e test models (router tiny + ~5B main)"
ollama pull qwen2.5:0.5b
ollama pull qwen3.5:4b
echo "Done. 27B target still not pulled."
