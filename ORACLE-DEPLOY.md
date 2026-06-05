# Oracle Cloud 서울 무료 배포 런북

> 무료 영구 + 한국 IP(네이버 차단 없음) + 상시 가동. 아래 순서대로 복붙하면 됩니다.

## ⚠️ 가장 흔한 실수 3가지 (먼저 읽기)
1. **가입 시 홈 리전을 "South Korea Central (Seoul)"** 로 선택 — Always Free는 홈 리전에서만 만들 수 있고, 나중에 못 바꿉니다.
2. **방화벽은 2겹** — Oracle "보안 목록" + 우분투 "iptables" 둘 다 포트를 열어야 접속됩니다.
3. **스왑 메모리 추가** — 무료 VM은 RAM 1GB라 빌드 시 멈출 수 있어 스왑이 필요합니다.

---

## 1. VM 생성
1. https://cloud.oracle.com 가입 → **홈 리전: 서울** → 카드 인증(과금 없음)
2. Compute → **Instances** → **Create Instance**
   - Image: **Canonical Ubuntu 22.04**
   - Shape: **VM.Standard.E2.1.Micro** (Always Free, AMD) — ARM(A1)은 용량 부족 잦음
   - Networking: VCN 자동 생성, **Assign a public IPv4 address ✅**
   - SSH keys: **Save private key** 눌러 키 파일 다운로드(접속에 필요)
3. 생성 후 **Public IP** 메모

## 2. 방화벽 열기 (2겹)
**(A) Oracle 보안 목록**
- VCN → Subnet → **Security List** → **Add Ingress Rules**
- Source `0.0.0.0/0`, Protocol `TCP`, Destination Port **80**, **443**, **5000**

**(B) 우분투 iptables** (SSH 접속 후 실행 — 3단계 먼저)

## 3. 접속
Windows PowerShell에서:
```powershell
ssh -i "C:\다운로드\ssh-key.key" ubuntu@<PUBLIC_IP>
```
접속 후 iptables 열기:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5000 -j ACCEPT
sudo netfilter-persistent save
```

## 4. 환경 설치
```bash
sudo apt update && sudo apt -y upgrade
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs git
# 스왑 2GB (빌드 OOM 방지)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 5. 앱 배포
```bash
git clone https://github.com/<your-id>/<repo>.git
cd <repo>
nano .env     # 아래 5줄 붙여넣고 Ctrl+O, Enter, Ctrl+X
```
`.env` 내용 (로컬 .env에서 그대로 복사):
```
NAVER_SEARCHAD_API_KEY=...
NAVER_SEARCHAD_SECRET_KEY=...
NAVER_SEARCHAD_CUSTOMER_ID=...
NAVER_OPENAPI_CLIENT_ID=...
NAVER_OPENAPI_CLIENT_SECRET=...
```
설치 + 빌드 + 상시 실행:
```bash
npm install
npm run build
sudo npm install -g pm2
pm2 start npm --name naver-rank -- start
pm2 save
pm2 startup    # 출력되는 sudo ... 명령을 복사해서 실행 (부팅 자동시작)
```
→ 브라우저에서 **http://<PUBLIC_IP>:5000** 접속 🎉

## 6. (선택) 깔끔한 URL + HTTPS
도메인이 있으면 80포트 + HTTPS로:
```bash
sudo apt -y install nginx
sudo tee /etc/nginx/sites-available/naver >/dev/null <<'NGINX'
server {
    listen 80;
    server_name your-domain.com;
    location / { proxy_pass http://127.0.0.1:5000; proxy_http_version 1.1;
        proxy_set_header Connection ''; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off; }   # SSE(실시간 진행률) 위해 buffering off 필수
}
NGINX
sudo ln -s /etc/nginx/sites-available/naver /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
# HTTPS
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
도메인의 A레코드를 `<PUBLIC_IP>`로 연결한 뒤 실행하세요.

## 업데이트 방법 (코드 수정 후)
로컬에서 `git push` → 서버에서:
```bash
cd <repo> && git pull && npm install && npm run build && pm2 restart naver-rank
```

## 문제 해결
- **접속 안 됨**: 방화벽 2겹(2단계 A·B) 다 했는지 확인. `pm2 logs naver-rank`로 에러 확인.
- **순위 스캔 실패**: 네이버 차단일 수 있으나 서울 IP면 드뭅니다. `pm2 logs`로 상태 코드 확인.
- **빌드 멈춤**: 스왑(4단계) 적용 확인 `free -h`.
