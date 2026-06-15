#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/4] Raspberry Pi 시스템 패키지를 설치합니다."
sudo apt update
sudo apt install -y python3-venv python3-pip libgl1 libglib2.0-0 v4l-utils

echo "[2/4] Python 가상환경을 생성합니다."
python3 -m venv .venv

echo "[3/4] Python 패키지를 설치합니다."
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "[4/4] 환경설정 파일을 준비합니다."
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ".env 파일을 생성했습니다. API_BASE_URL과 DEVICE_API_KEY를 수정해주세요."
else
  echo "기존 .env 파일을 유지합니다."
fi

echo
echo "설치 완료"
echo "1. nano $SCRIPT_DIR/.env"
echo "2. $SCRIPT_DIR/check_setup.sh"
echo "3. $SCRIPT_DIR/run.sh"
