# 라즈베리파이 배포 가이드 — 네이버 검색 순위 체크

> 대상 하드웨어: **Raspberry Pi 3B / 3B+ (RAM 1GB)**
> 목적: 한국 IP·24시간 상시 가동 환경에서 자동 스캔 + Discord 알림 운영
> 최종 작성: 2026-06-05

이 앱은 네이버 검색 페이지를 스크래핑하므로 **반드시 한국 IP**에서 돌아야 하고(해외 IP는 차단),
자동 주기 스캔·알림을 위해 **서버가 24시간 켜져 있어야** 합니다. 집 인터넷에 연결된 라즈베리파이는
이 두 조건을 동시에 만족하는 가장 저렴하고 확실한 방법입니다.

---

## 0. 어떤 파이를 쓸까

| 보유 | 권장 용도 | 이유 |
|------|-----------|------|
| **Raspberry Pi 3B+** | **메인 서버** | CPU 1.4GHz(3B는 1.2GHz), 발열 관리·네트워크가 더 나음 → 24시간 운영에 유리 |
| Raspberry Pi 3B | 예비/백업 | SD카드만 같은 방식으로 구워두면 고장 시 즉시 교체 가능 |

> **두 대를 동시에 돌릴 필요는 없습니다.** 3B+ 한 대로 충분합니다. 3B는 같은 설정의 SD카드를
> 하나 더 만들어 "콜드 스페어"로 두면 장애 시 카드만 꽂아 바로 복구됩니다.

### 1GB RAM 관련 핵심 주의
프론트엔드 빌드(`npm run build` = Vite)는 메모리를 많이 써서 **1GB에서는 실패(OOM)하거나 매우 느립니다.**
그래서 이 문서는 **"빌드는 PC에서, 결과(`frontend/dist`)만 파이로 복사"** 하는 방식을 기본으로 합니다.
(파이에서 직접 빌드하려면 §6-B의 스왑 방식 참고.)

---

## 1. 준비물

- 라즈베리파이 3B+ 본체
- **microSD 카드 16GB 이상** (Class 10 / A1 이상 권장)
- microSD 리더기 (PC에 연결)
- 5V/2.5A 이상 microUSB 전원 어댑터 (3B+ 정품 권장 — 전력 부족 시 불안정)
- **방열판**(heatsink) — 24시간 운영 시 발열 관리에 권장
- 유선 랜케이블(권장) 또는 WiFi
- 설정용 PC (Windows)

---

## 2. OS 설치 (Raspberry Pi Imager, 헤드리스)

모니터·키보드 없이 PC에서 SSH로만 설정하는 "헤드리스" 방식이 가장 편합니다.

1. PC에 **Raspberry Pi Imager** 설치: <https://www.raspberrypi.com/software/>
2. microSD를 PC에 꽂고 Imager 실행
3. **운영체제 선택** → `Raspberry Pi OS (other)` → **`Raspberry Pi OS Lite (64-bit)`**
   - Lite = 데스크톱 없는 서버용(RAM 절약). 64-bit = Pi 3B+는 64비트 지원하므로 Node 호환성에 유리
4. **저장소 선택** → 꽂은 microSD 선택
5. **다음(Next)** → "OS 맞춤 설정을 적용하시겠습니까?" → **설정 편집(Edit Settings)**:
   - **호스트 이름**: `naverpi` (원하는 이름)
   - **사용자 이름/비밀번호**: 예 `pi` / (강한 비밀번호) — 꼭 기억
   - **WiFi 설정**(무선 쓸 경우): SSID/비밀번호, 국가 `KR`
   - **로캘**: 시간대 `Asia/Seoul`, 키보드 `us`
   - **서비스 탭** → **SSH 사용 활성화** → "비밀번호 인증" 선택
6. 저장 후 **쓰기(Write)** → 완료될 때까지 대기
7. 다 구워지면 microSD를 파이에 꽂고, **랜선 연결 후 전원 인가**

---

## 3. 첫 부팅 + SSH 접속 (Windows)

부팅에 1~2분 걸립니다. Windows PowerShell에서:

```powershell
# 호스트 이름으로 접속 (mDNS) — Windows 10/11에서 대개 동작
ssh pi@naverpi.local
```

`naverpi.local`이 안 잡히면 공유기 관리페이지에서 파이의 **IP 주소**를 확인해 접속:

```powershell
ssh pi@192.168.0.XX
```

- 첫 접속 시 "계속하시겠습니까(yes/no)" → `yes`
- 비밀번호 입력 → 프롬프트가 `pi@naverpi:~ $` 로 바뀌면 성공

> 💡 IP가 바뀌면 곤란하니, 공유기 DHCP 설정에서 파이의 MAC에 **고정 IP(IP 예약)**를 걸어두면 편합니다.

---

## 4. 기본 설정

SSH로 접속한 상태에서:

```bash
# 1) 패키지 최신화
sudo apt-get update && sudo apt-get -y upgrade

# 2) 시간대 확인 (Imager에서 설정했어도 재확인) — 다이제스트 "매일 OO시" 정확도에 중요
sudo timedatectl set-timezone Asia/Seoul
timedatectl    # Time zone: Asia/Seoul (KST) 확인

# 3) git 설치
sudo apt-get install -y git
```

### (선택) 스왑 늘리기 — 파이에서 직접 빌드할 때만 필요
PC에서 빌드해 복사할 거면 **건너뛰어도 됩니다.** 파이에서 빌드하려면(§6-B) 스왑을 키웁니다:

```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile      # CONF_SWAPSIZE=2048 로 수정 후 저장
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -h                            # Swap 2.0Gi 확인
```

---

## 5. Node.js 설치

Node 18+ 필요. NodeSource로 LTS(20.x) 설치:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v    # v20.x 확인
npm -v
```

---

## 6. 앱 배포

```bash
# 코드 받기 (홈 디렉터리)
cd ~
git clone https://github.com/jangjunwon2/naversearch.git
cd naversearch
```

### 6-1. 환경변수 설정

```bash
cp .env.example .env
nano .env
```
다음 값을 채웁니다:
```
NAVER_SEARCHAD_API_KEY=...
NAVER_SEARCHAD_SECRET_KEY=...
NAVER_SEARCHAD_CUSTOMER_ID=...
NAVER_OPENAPI_CLIENT_ID=...
NAVER_OPENAPI_CLIENT_SECRET=...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...   # Discord 알림용
TZ=Asia/Seoul
# APP_PASSWORD=원하는비밀번호   # (선택) 외부 공개 시 접근 보호
```
`Ctrl+O`(저장) → `Enter` → `Ctrl+X`(종료)

### 6-2. 백엔드 의존성 설치 (가벼움)

```bash
npm install        # 루트 의존성만(express/cors/cheerio) — 1GB에서도 문제없음
```

### 6-A. 프론트엔드 — **PC에서 빌드 후 복사 (권장)**

파이가 아니라 **PC(Windows)** 의 프로젝트 폴더에서:
```powershell
# PC에서
cd "C:\Users\jun92\Desktop\검색 순위 체크"
npm run build          # frontend/dist 생성

# 생성된 dist를 파이로 복사 (scp는 Windows OpenSSH에 기본 포함)
scp -r frontend\dist pi@naverpi.local:~/naversearch/frontend/
```
이러면 파이엔 무거운 프론트 빌드/devDependencies가 전혀 필요 없습니다. 백엔드가
`frontend/dist`를 정적 파일로 서빙합니다.

> 코드 업데이트 때마다 UI가 바뀌면 PC에서 다시 `npm run build` 후 dist만 재복사하면 됩니다.

### 6-B. (대안) 파이에서 직접 빌드
§4의 스왑(2GB)을 먼저 키운 뒤:
```bash
cd ~/naversearch
npm run build      # 수 분 소요, SD 부하 큼. 권장하지 않음(6-A가 안전)
```

---

## 7. PM2로 상시 실행 + 부팅 자동 시작

```bash
sudo npm install -g pm2

cd ~/naversearch
pm2 start backend/server.js --name naver-rank --time
pm2 save

# 부팅 시 자동 시작 등록 — 아래 명령이 출력하는 'sudo env ...' 한 줄을 복사해 그대로 실행
pm2 startup systemd
```

확인:
```bash
pm2 status                 # naver-rank 가 online
pm2 logs naver-rank        # "서버 실행 중: http://localhost:5000" 확인 (Ctrl+C로 빠져나옴)
```

---

## 8. 접속 확인 (집 내부)

같은 집 네트워크의 폰/PC 브라우저에서:
```
http://naverpi.local:5000
```
안 되면 `http://<파이IP>:5000`. 화면이 뜨면 배포 성공입니다.

---

## 9. (선택) 외부에서 접속 — Cloudflare Tunnel

> **자동 스캔·Discord 알림은 "나가는" 통신이라 외부 접속 설정 없이도 잘 됩니다.**
> 밖에서 웹 UI를 열고 싶을 때만 아래를 설정하세요. 포트포워딩 불필요.

```bash
# cloudflared (ARM) 설치 — 아키텍처에 맞는 .deb
#   64-bit OS: arm64,  32-bit OS: armhf
ARCH=$(dpkg --print-architecture)   # arm64 또는 armhf
curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb
sudo dpkg -i cloudflared.deb

# 임시 주소로 바로 열기 (테스트용)
cloudflared tunnel --url http://localhost:5000
#   → https://xxxx.trycloudflare.com 출력. 이 주소로 어디서든 접속
```

고정 주소·상시 운영이 필요하면 무료 Cloudflare 계정으로 **named tunnel**을 만들고 서비스로 등록합니다
(`cloudflared service install`). 외부 공개 시에는 `.env`의 `APP_PASSWORD`로 접근 보호를 권장합니다.

---

## 10. Discord 알림 최종 점검

1. 브라우저 → **📊 마케팅 대시보드 → 🔔 알림** 탭
2. 빨간 경고 배너가 없으면 서버가 `DISCORD_WEBHOOK_URL`을 인식한 것
3. **"테스트 발송"** → Discord 채널 + 폰 푸시에 메시지 도착 확인
4. **⏰ 자동 스캔** 탭에서 대상(업체명/ID + 키워드)을 등록(최소 6시간 간격)
5. 🔔 알림 탭에서 목표 순위·하락/미달 토글·다이제스트 시각 설정
   - 다이제스트 "매일 09시"는 `TZ=Asia/Seoul` 덕분에 한국 시각 09시에 발송됩니다

---

## 11. 운영 / 유지보수

```bash
# 로그 보기
pm2 logs naver-rank

# 상태/재시작
pm2 status
pm2 restart naver-rank

# 코드 업데이트 (백엔드)
cd ~/naversearch && git pull && npm install && pm2 restart naver-rank
#   UI도 바뀌었으면: PC에서 npm run build → scp로 frontend/dist 재복사 후 restart

# 데이터 백업 (히스토리·금칙어·목록·스케줄·알림설정)
#   store/*.json 만 백업하면 됨 (git 제외 대상)
tar czf ~/naverpi-store-backup.tgz -C ~/naversearch/backend store
```

- **재부팅/정전**: `pm2 startup`+`pm2 save` 해두면 자동 복구
- **SD카드 백업**: 안정화 후 PC에서 SD 이미지를 통째로 떠두면(또는 예비 3B용 카드 하나 더 구워두면) 카드 고장 시 즉시 복구

---

## 12. 트러블슈팅

| 증상 | 점검 |
|------|------|
| `ssh naverpi.local` 안 됨 | 공유기에서 파이 IP 확인 후 IP로 접속. 부팅 1~2분 대기 |
| 순위 스캔이 0건/에러 | 파이가 정말 한국 IP인지(집 인터넷인지) 확인. VPN/프록시 꺼져 있어야 함 |
| 프론트 빌드 중 멈춤/Killed | 1GB RAM OOM → §6-A(PC 빌드 후 복사) 사용, 또는 §4 스왑 2GB |
| 다이제스트 시각이 안 맞음 | `timedatectl`에서 `Asia/Seoul` 확인, `.env`에 `TZ=Asia/Seoul` |
| 알림이 안 옴 | 🔔 탭 "테스트 발송"으로 분리 점검 → 웹훅 URL/마스터 스위치/자동 스캔 등록 여부 확인 |
| 부팅 후 앱이 안 뜸 | `pm2 status` 확인, `pm2 resurrect` 또는 `pm2 startup` 재설정 |
| 파이가 자주 멈춤/재부팅 | 전원 어댑터 용량 부족(2.5A+ 필요), 발열 → 방열판 |

---

## 13. 요약 메모

- **메인**: Pi 3B+, **예비**: Pi 3B (동일 SD 이미지 1장 더)
- **OS**: Raspberry Pi OS Lite **64-bit**, 헤드리스(SSH)
- **빌드 전략**: 프론트는 **PC에서 빌드 → `frontend/dist` 복사**(1GB RAM OOM 회피)
- **상시 실행**: PM2 + `pm2 startup`/`pm2 save`
- **한국 IP**: 집 인터넷 직결(VPN 금지) → 네이버 차단 회피
- **알림은 outbound** → 외부 접속(터널)은 선택, 알림만 받을 거면 인터넷 연결만으로 충분
- **시간대**: `Asia/Seoul` 필수(다이제스트 시각)
