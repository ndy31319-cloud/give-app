#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_HOST="${PI_HOST:-}"
PI_USER="${PI_USER:-pi}"
PI_PATH="${PI_PATH:-/home/$PI_USER/give-device}"

if [[ -z "$PI_HOST" ]]; then
  echo "PI_HOST를 지정해주세요." >&2
  echo "예: PI_HOST=192.168.0.30 ./deploy_to_pi.sh" >&2
  exit 1
fi

ssh "$PI_USER@$PI_HOST" "mkdir -p '$PI_PATH'"
rsync -av \
  --exclude ".env" \
  --exclude ".venv" \
  --exclude "__pycache__" \
  "$SCRIPT_DIR/" "$PI_USER@$PI_HOST:$PI_PATH/"

echo
echo "전송 완료: $PI_USER@$PI_HOST:$PI_PATH"
echo "다음 명령:"
echo "ssh $PI_USER@$PI_HOST"
echo "cd $PI_PATH && chmod +x *.sh && ./install.sh"
