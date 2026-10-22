#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
command -v uv >/dev/null || { echo "Install uv first: https://docs.astral.sh/uv/getting-started/installation/"; exit 1; }
command -v npm >/dev/null || { echo "Install Node.js 22.12+ first: https://nodejs.org/"; exit 1; }
TASK_PYTHON="${JOB_AGENT_PYTHON:-$(command -v python3)}"
uv sync --frozen --python "$TASK_PYTHON"
if [[ ! -d web/node_modules ]]; then
  (cd web && npm ci --no-audit --no-fund)
fi
(cd web && npm run build)
exec .venv/bin/python scripts/launch.py start "${1:-9210}"
