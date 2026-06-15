#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -x .venv/bin/python ]]; then
  echo "가상환경이 없습니다. 먼저 ./install.sh를 실행해주세요." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo ".env 파일이 없습니다. cp .env.example .env 후 값을 설정해주세요." >&2
  exit 1
fi

exec .venv/bin/python give_device.py
