# BNCP Fuel Tracking System

현장 차량·장비의 **유류 사용량 추적** 대시보드. 주유 횟수·주유량·주행거리를 일/주/월로 자동 집계한다.
비용/단가 관리 시스템이 아니다 — 금액 관련 기능은 두지 않는다.

- **Framework**: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts
- **데이터 저장소**: Google Sheets (Service Account 인증)
- **언어**: 한국어 / English / বাংলা
- **브랜딩**: 한화건설(Hanwha E&C) CI · Hanwha Orange · Hanwha 전용 폰트

---

## 주요 기능

| 구분 | 내용 |
|---|---|
| 유종 우선 입력 | **유종(디젤/가솔린) 선택 → 차량/장비 선택 → 저장**. 디젤은 주유량만, 가솔린은 주행거리+주유량 |
| 자동 표시 | 차량 선택 시 CONTROL N°·운전자·팀·파트·차종·용량 자동 채움 |
| 복수 운전자 | 2명 모두 표시, 주유 1건=1회로 집계(운전자 수로 곱하지 않음) |
| 스냅샷 | Fuel Log 에 주유 당시 Master 정보 보존 |
| 대시보드 | KPI + 일/주(ISO)/월별 · 파트/차량/운전자별 그래프 + 기간·조건 필터 |
| 이력 | 최신순, 검색, Desktop 표 / Mobile 카드 |
| 내보내기 | CSV · Print · PDF(인쇄) |
| Desktop / Mobile | 동일 데이터·기능, UX 는 별도(사이드바 vs 하단 네비) |
| 날씨 | 실제 Weather API(Open-Meteo, Baghdad 기본), 실패 시 "Weather unavailable" |

---

## 로컬 개발

```bash
cd fuel-tracking
npm install
cp .env.example .env.local   # 값 채우기 (아래 참고)
npm run dev                  # http://localhost:3000
```

## Google Sheets 연결 (Service Account)

1. [Google Cloud Console](https://console.cloud.google.com) 에서 프로젝트 생성
2. **Google Sheets API** 사용 설정
3. **서비스 계정** 생성 → **키(JSON)** 발급
4. 사용할 Google Sheet 를 서비스 계정 이메일(`xxx@xxx.iam.gserviceaccount.com`)에 **편집자**로 공유
5. Sheet 탭 3개: `Vehicle_Master`, `Fuel_Log`, `Settings`
6. 앱 실행 후 **설정 → 시트 초기화** 버튼으로 헤더 + 초기 차량/장비 데이터 심기

## 환경 변수 (`.env.local` — 절대 커밋 금지)

```
GOOGLE_SHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
WEATHER_LOCATION_NAME=Baghdad
WEATHER_LATITUDE=33.3152
WEATHER_LONGITUDE=44.3661
SITE_TIMEZONE=Asia/Baghdad
```

## 배포 (Vercel 권장)

1. GitHub 저장소를 Vercel 에 연결, **Root Directory** 를 `fuel-tracking` 으로 지정
2. 위 환경 변수를 Vercel 프로젝트 Settings → Environment Variables 에 입력
   (`GOOGLE_PRIVATE_KEY` 는 JSON 의 private_key 값을 그대로 붙여넣기)
3. 배포 후 **설정 → 시트 초기화** 1회 실행

## 보안

- Google credential 은 서버 환경변수에서만 읽는다. 프론트엔드/GitHub 에 노출하지 않는다.
- `.env*`, `credentials.json`, `service-account.json`, `*.key` 는 `.gitignore` 처리됨.

## 초기 데이터

- **가솔린 29대**: Main Vehicle No.(공사(I)-11 등) ↔ CONTROL N° ↔ 운전자 ↔ 파트
- **디젤 29대**: CONTROL N°(BC-003 등) 기반 장비. 팀은 "공사팀" 통일, Capacity·Team Code 보존
- 원본 문자열(차량번호·이름·CONTROL N°)은 그대로 보존하며 번역하지 않는다.
