#!/usr/bin/env bash
# 启动 pp-d2c AI proxy(localhost:8787)。
# 首次运行会自动建 venv 并装依赖。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [ ! -d ".venv" ]; then
  echo "[ai-proxy] 首次运行,创建 venv..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

# 升级 pip 避免老版本无法解析新格式(python 3.9 自带的 pip 22 会挂)
pip install -q --upgrade pip >/dev/null 2>&1 || true

# 安装/更新依赖(幂等,已装则秒过)
pip install -q -r requirements.txt

if [ ! -f ".env" ]; then
  echo "[ai-proxy] 警告:未找到 .env,请先 cp .env.example .env 并填写 PAAS_APP_APPID / PETA_KEY_ID。"
  echo "         此时启动能跑,但 /analyze 会返回 degraded=true。"
fi

exec uvicorn main:app --host 127.0.0.1 --port 8787 --reload
