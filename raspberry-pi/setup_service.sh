#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="give-device.service"
SERVICE_PATH="/etc/systemd/system/$SERVICE_NAME"
CURRENT_USER="$(id -un)"

if [[ ! -x "$SCRIPT_DIR/.venv/bin/python" ]]; then
  echo "가상환경이 없습니다. 먼저 ./install.sh를 실행해주세요." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo ".env 파일을 먼저 설정해주세요." >&2
  exit 1
fi

TEMP_SERVICE="$(mktemp)"
sed \
  -e "s|__USER__|$CURRENT_USER|g" \
  -e "s|__WORKING_DIRECTORY__|$SCRIPT_DIR|g" \
  "$SCRIPT_DIR/give-device.service" > "$TEMP_SERVICE"

sudo install -m 0644 "$TEMP_SERVICE" "$SERVICE_PATH"
rm -f "$TEMP_SERVICE"

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager

echo
echo "자동 실행 등록 완료"
echo "로그 확인: journalctl -u $SERVICE_NAME -f"
