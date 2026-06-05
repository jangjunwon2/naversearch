# 온라인 배포 가이드

이 앱은 **항상 켜져 있는 Node 서버**가 필요합니다(실시간 진행률 SSE + 키워드당 1.5~3초 지연 스캔).
→ Vercel/Netlify 같은 **서버리스는 부적합**(타임아웃으로 스캔 중단). Render/Railway/VPS 같은 상시 서버를 씁니다.

## ✅ 추천: Render (가장 쉬움)

### 1단계. GitHub에 코드 올리기
```bash
git init
git add .
git commit -m "init: 네이버 검색 순위 체크"
# GitHub에서 새 저장소 생성 후(Private 권장):
git remote add origin https://github.com/<your-id>/<repo>.git
git branch -M main
git push -u origin main
```
> `.env`는 `.gitignore`에 있어 **업로드되지 않습니다**(키 보호). 환경변수는 Render에서 직접 넣습니다.

### 2단계. Render에서 배포
1. https://render.com 가입(GitHub 연동)
2. **New + → Blueprint** → 이 저장소 선택 (루트 `render.yaml` 자동 인식)
   - 또는 **New + → Web Service** 수동 설정:
     - Build Command: `npm install && npm run build`
     - Start Command: `npm start`
     - Region: **Singapore**
3. **Environment** 탭에서 환경변수 5개 입력:
   ```
   NAVER_SEARCHAD_API_KEY
   NAVER_SEARCHAD_SECRET_KEY
   NAVER_SEARCHAD_CUSTOMER_ID
   NAVER_OPENAPI_CLIENT_ID
   NAVER_OPENAPI_CLIENT_SECRET
   ```
4. **Create** → 빌드 후 `https://<이름>.onrender.com` URL 발급 🎉

### 무료 플랜 주의
- 15분 미사용 시 잠들고, 첫 요청에 ~30초 콜드스타트. 상시 운영하려면 **Starter($7/월)** 로 올리세요.
- 무료 플랜은 영구 디스크가 없어 **재배포 시 히스토리/금칙어/검색어 목록이 초기화**됩니다(유료 디스크 또는 외부 DB로 해결 가능).

## ⚠️ 네이버 스크래핑 차단 위험
업체명/ID **순위 스캔**은 네이버 검색 페이지를 직접 긁습니다. **해외 데이터센터 IP는 네이버가 차단**할 수 있습니다.
- 키워드 리서치(공식 API)는 어디서든 정상.
- 순위 스캔이 자주 실패하면 **한국 IP 서버**로 옮기세요:
  - **Vultr/AWS Lightsail 서울 리전**, 또는 **네이버 클라우드 / Cafe24 VPS**
  - VPS에선: Node 설치 → `npm install && npm run build` → `pm2 start npm -- start` → Nginx 리버스 프록시 + 도메인 + HTTPS(Let's Encrypt)

## 🔒 보안 메모 (공개 + 내 키 공유 선택)
- 모든 방문자가 **내 검색광고/오픈API 키 할당량**을 사용합니다 → 남용 방지용 **레이트리밋** 적용됨(분당 스캔 15회·키워드 20회/IP).
- 더 안전하게 하려면 나중에 **간단한 비밀번호 게이트**를 추가하는 걸 권장합니다(요청 시 구현).
- 채팅에 노출된 **검색광고 비밀키는 재발급** 권장.
