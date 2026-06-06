#!/bin/bash
# ─────────────────────────────────────────────────────────────
# 라즈베리파이 GitHub Actions self-hosted runner 설치 스크립트
# 실행 방법: bash runner-setup.sh <REPO_URL> <TOKEN>
#
# REPO_URL  예: https://github.com/jangjunwon2/naversearch
# TOKEN     GitHub 레포 → Settings → Actions → Runners → New self-hosted runner
#           에서 발급한 토큰 (AXXXXXXXXX 형태)
# ─────────────────────────────────────────────────────────────
set -e

REPO_URL="${1:?'Usage: bash runner-setup.sh <REPO_URL> <TOKEN>'}"
TOKEN="${2:?'Usage: bash runner-setup.sh <REPO_URL> <TOKEN>'}"
RUNNER_VERSION="2.323.0"
RUNNER_DIR="$HOME/actions-runner"

echo "=== 1. Node.js 20 확인 ==="
node -v 2>/dev/null || {
  echo "Node.js가 없습니다. 설치합니다..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
}

echo "=== 2. PM2 확인 ==="
pm2 -v 2>/dev/null || sudo npm install -g pm2

echo "=== 3. runner 디렉토리 생성 ==="
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

echo "=== 4. runner 다운로드 (ARM64) ==="
curl -fsSL \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz" \
  -o runner.tar.gz
tar xzf runner.tar.gz
rm runner.tar.gz

echo "=== 5. 의존성 설치 ==="
sudo ./bin/installdependencies.sh

echo "=== 6. runner 등록 (라벨: raspberry-pi) ==="
./config.sh \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --name "raspberry-pi-$(hostname)" \
  --labels "raspberry-pi" \
  --work "_work" \
  --unattended

echo "=== 7. systemd 서비스로 등록 (부팅 시 자동 시작) ==="
sudo ./svc.sh install
sudo ./svc.sh start

echo ""
echo "✅ 완료! runner 상태:"
sudo ./svc.sh status
echo ""
echo "GitHub 레포 → Settings → Actions → Runners 에서 Online 상태를 확인하세요."
