# 📋 PRD (v1) — Crewmon 출퇴근·급여 웹앱 (홈/출퇴근/급여)

- **작성자**: task-planner
- **작성일**: 2026-05-31
- **상태**: 승인 대기
- **운영 모드**: teammate (Notion 미사용, 로컬 markdown 산출물)
- **레포**: `/Users/goyoung/workspace/Study/ttok` (Next.js 16 App Router, 신규)

---

## 0. 목표 / 배경

### 배경
매장 근무자(알바·파트타이머)용 출퇴근/급여 관리 앱 **Crewmon(크루몬)**의 핵심 3개 화면 영역(홈 / 출퇴근 / 급여)을 신규 Next.js repo에 재현한다. `public/sample/IMG_3606~3619.png` 14장 스크린샷이 참조 디자인이며, 디자인 시스템(코랄/오렌지 테마, 모바일 세로, 바텀탭, 라운드 카드, 바텀시트)을 충실히 따른다.

### 목표
- 모바일 세로 전용 웹앱으로 **홈 / 출퇴근 캘린더+상세 / 급여 메인+일별상세** 화면을 동작하게 구현한다.
- 데이터는 **Next.js Route Handler + 인메모리 store**로 제공(외부 DB·인증 없음). 서버 재시작 시 시드 데이터로 초기화.
- 시간/급여 계산 도메인 로직을 **순수 함수 + 단위 테스트**로 검증 가능하게 만든다.
- 2026년 5월 시드 데이터(매머드커피 익스프레스 마석경춘로점 / 김민정 / 월~금 08:00~15:00 / 시급 10,320원)로 화면이 채워진다.

### 비목표 (성공의 정의가 아닌 것)
- 픽셀 퍼펙트 일치. (대신 "주요 시각 요소 재현"으로 측정)
- 실제 인증·DB·푸시 알림.

---

## 1. 산출물 종류

| 종류 | 내용 |
|------|------|
| 코드 | Next.js App Router 페이지(RSC/CSR) + Route Handler API + 도메인 util + 인메모리 store + 공용 UI 컴포넌트 |
| 테스트 | Vitest 단위 테스트(시간/급여 계산 util, API route 핵심 분기) |
| 설정 | Vitest 설정, `package.json` test 스크립트, `tsconfig` 경로(기존 유지) |
| 문서 | 본 PRD, CONTEXT.md(도메인 용어집 신규 생성), ADR 1건 |

### 신규 산출물 배치 위치 (Phase -0.5 feature-based 구조 인용)

```
src/app/
  layout.tsx                        # 모바일 세로 셸 + BottomNav 고정
  page.tsx                          # 홈 (/)
  attendance/page.tsx               # 출퇴근 캘린더 (/attendance)
  attendance/[date]/page.tsx        # 근무기록 상세/수정 (/attendance/2026-05-28)
  pay/page.tsx                      # 급여 메인 (/pay)
  pay/[date]/page.tsx               # 급여 일별 상세 (/pay/2026-05-28)
  api/attendance/route.ts           # GET 월간 / PATCH 상태변경
  api/attendance/[date]/route.ts    # GET 단일일 상세
  api/attendance/requests/route.ts  # GET 수정요청 내역 / POST 수정요청
  api/pay/route.ts                  # GET 월간 급여 + 일별 리스트
  api/pay/[date]/route.ts           # GET 일별 급여 상세
src/features/attendance/            # 캘린더·근무기록 UI/훅/타입
src/features/pay/                   # 급여 리스트·상세 UI/훅/타입
src/components/                     # BottomNav, Card, BottomSheet, ProgressBar, StatusBadge, MonthSelector, AppHeader
src/lib/
  store.ts                          # 인메모리 store (모듈 싱글톤)
  seed.ts                           # 2026-05 시드 데이터
  time.ts                           # 근무/휴게/연장 시간 계산 (순수 함수)
  pay.ts                            # 급여/주휴/차감 계산 (순수 함수)
  constants.ts                      # 컬러 토큰, 상태 enum, 정규 근무시간 등
src/types/                          # 공용 도메인 타입 (AttendanceRecord, WorkStatus, PayItem 등)
```

매칭 근거(`ai_suggested_placements`): 신규 feature 코드 → `src/features/<name>/`, 공용 UI → `src/components/`, util/store → `src/lib/`, API route → `src/app/api/<name>/route.ts`, 공용 타입 → `src/types/`.

---

## 1.5 Sub-task 분해 (vertical slice)

> 각 슬라이스는 "테스트 가능한 가치 단위"로 끊었다. ST-1/ST-2가 모든 화면의 토대이므로 선행.

| # | 이름 | 완료 기준 (요약) | 주도 역할 | 의존성 |
|---|------|------------------|-----------|--------|
| **ST-1** | 도메인 타입 + 계산 util + 테스트 | `src/types/`, `src/lib/time.ts`, `src/lib/pay.ts` 작성. Vitest로 시간/급여/연장/차감/주휴 계산 단위테스트 통과(`pnpm test`). | developer | — |
| **ST-2** | 인메모리 store + 시드 + API route | `src/lib/store.ts`, `seed.ts` 작성. attendance/pay API route 6종 구현. 시드 = 2026-05 데이터. API 응답 형태 단위테스트. | developer | ST-1 |
| **ST-3** | 디자인 시스템 + 앱 셸 + 공용 UI | `layout.tsx` 모바일 세로 셸, `BottomNav`(홈/출퇴근/급여/마이페이지, 마이페이지는 비활성), 컬러 토큰(코랄 #F26B4D), `Card`/`BottomSheet`/`StatusBadge`/`ProgressBar`/`MonthSelector`/`AppHeader`. | developer | — (ST-1과 병행 가능) |
| **ST-4** | 홈 화면 + 출퇴근 토글 플로우 | `/` 페이지: 헤더·날짜·매장명·"N시간 근무했어요!"·진행바(08:00~15:00)·출근/퇴근 토글·안내/공지 카드·바로가기 2개. 토글이 store 상태와 연동(출근→퇴근 노출). | developer | ST-2, ST-3 |
| **ST-5** | 출퇴근 캘린더 + 일자 상세/수정 | `/attendance` 월간 캘린더(셀: `Nh`·연장배지·휴가·상태점), 날짜 탭→일자 상세 패널. `/attendance/[date]` 근무기록 상세 + 출근상태 변경 바텀시트(정상/지각/결근/휴가/연장) + 시간변경 + 수정요청 사유 textarea(0/100) + 요청내역. | developer | ST-2, ST-3 |
| **ST-6** | 급여 메인 + 일별 상세 | `/pay` 월 선택·요약카드(합계/차감시간/연장)·일별 리스트(금액·휴가0원·연장표기·주휴수당 블루행). `/pay/[date]` 기준급여(시급)·급여인정시간·휴게·차감·연장·확인버튼. | developer | ST-2, ST-3 |
| **ST-7** | 통합·DoD 마감 | 라우팅 연결, BottomNav 이동, 시드 일관성 점검, `pnpm build`/`tsc --noEmit`/`lint`/`test` 전부 green, CONTEXT.md + ADR 작성. | developer | ST-4, ST-5, ST-6 |

권장 진행: ST-1·ST-3 병행 → ST-2 → ST-4/5/6 병행 → ST-7.

---

## 2. 사용자 시나리오

1. **출근/퇴근 기록**: 근무자가 홈에서 출근 시간이 되면 "출근" 버튼을 눌러 근무를 시작하고, 퇴근 시 "퇴근"을 눌러 오늘 근무를 마감한다. 진행바로 정규 근무(08:00~15:00) 대비 진척을 확인한다.
2. **월간 출퇴근 확인**: 근무자가 출퇴근 탭에서 한 달 근무 현황(일별 근무시간·연장·휴가·상태)을 캘린더로 훑어보고, 특정 날짜를 눌러 출근/퇴근/휴게 시각을 확인한다.
3. **근무기록 수정요청**: 출근시각이 잘못 찍힌 날, 상세 화면에서 상태/시간을 바로잡아 사유와 함께 수정요청을 보내고, 요청내역에서 수락/대기 상태를 추적한다.
4. **급여 확인**: 근무자가 급여 탭에서 이번 달 급여 합계·차감시간·연장 횟수를 보고, 일별 금액(휴가 0원, 주휴수당 별도)을 확인한다. 특정 날짜를 눌러 시급·급여인정시간·휴게·연장 등 계산 내역을 본다.

---

## 3. 솔루션 개요

모바일 세로 단일 컬럼 레이아웃을 `layout.tsx`에서 고정하고 하단 `BottomNav`로 4탭 셸을 만든다. 페이지는 App Router 라우트로, 데이터는 클라이언트에서 `fetch`로 Route Handler API를 호출(인메모리 store)한다. **계산 로직(시간·급여)은 UI/store와 분리된 순수 함수**(`src/lib/time.ts`, `pay.ts`)로 두어 Vitest로 독립 검증한다. 상태 변경(출퇴근 토글, 출근상태 변경, 수정요청)은 store를 갱신하는 API PATCH/POST로 처리하며, 서버 재시작 시 시드로 초기화된다.

### 활용할 프로젝트 자원
- `src/lib/` (util/store 규약): 계산 순수함수·인메모리 store 배치 — ST-1/ST-2에서 활용.
- `src/components/` (공용 UI 규약): BottomNav 등 재사용 컴포넌트 배치 — ST-3에서 활용.
- Tailwind CSS v4 (설치됨): 컬러 토큰·라운드 카드·바텀시트 스타일링 — ST-3 이후 전체.
- (project_skills: 등록된 command/skill/agent/convention_doc 없음 — 신규 repo. 발견된 자원 없으므로 임의 호출 금지.)

### 프로젝트 구조 (Phase -0.5 결과 인용)
- 패턴: feature-based (+ nextjs-app-router)
- 신규 산출물 배치:
  - 신규 feature 코드 → `src/features/<name>/`
  - 공용 UI → `src/components/`
  - util/store → `src/lib/`
  - API route → `src/app/api/<name>/route.ts`
  - 공용 타입 → `src/types/`
- 사용자 메모: Crewmon 출퇴근/급여 앱 클론, 코랄/오렌지, 모바일 세로, 이번 범위 홈·출퇴근·급여. 백엔드는 Next Route Handler + 인메모리.

### 도메인 규칙 (계산 근거 — 이미지에서 도출 + 시드 검산)
- **출근상태 5종**: 정상 / 지각 / 결근 / 휴가 / 연장.
- **근무시간** = 퇴근시각 − 출근시각 − 휴게시간.
- **급여인정시간** = 근무시간 − 급여차감시간(지각·결근분). 연장은 별도 집계.
- **일급** = 급여인정시간(시간) × 시급. (검산: 6.5h × 10,320 = **67,080원** ✔ IMG_3611의 5/28과 일치)
- **휴가** = 0원, 근무시간 표기 없음/"휴가".
- **주휴수당**: 별도 행(블루), 시드 = 6시간30분분(검산 67,080원).
- 정규 근무 기준선 = 08:00~15:00 (휴게 11:30~12:00 30분 → 6.5h).

---

## AC (Acceptance Criteria) — 객관 검증 가능

### 도메인 계산 (ST-1)
- **AC-1**: `calcWorkMinutes({ clockIn:"08:00", clockOut:"15:00", breakMinutes:30 })` 가 **390분(6시간30분)** 을 반환한다.
- **AC-2**: `calcDailyPay({ paidMinutes:390, hourlyWage:10320 })` 가 **67,080원** 을 반환한다.
- **AC-3**: `calcDailyPay` 가 상태 `휴가` 입력 시 **0원**, `paidMinutes:0` 을 반환한다.
- **AC-4**: 연장 계산: 정규(390분) 초과 근무 시 초과분을 `overtimeMinutes`로 분리 반환한다. 예: clockOut "17:00", break 30분 → workMinutes 510, overtimeMinutes 120(2시간). (IMG_3611 5/25 "연장 2시간" 검산)
- **AC-5**: 급여차감시간이 있는 날: `paidMinutes = workMinutes − deductMinutes` 로 계산되어 일급이 줄어든다. (deduct 0분이면 AC-1과 동일)

### API (ST-2)
- **AC-6**: `GET /api/attendance?month=2026-05` 가 **해당 월 일자 레코드 배열**(JSON)을 반환한다. 각 레코드는 `{ date, status, clockIn, clockOut, breakMinutes, workMinutes, overtimeMinutes }` 필드를 가진다. 시드된 근무일(월~금) 레코드가 포함된다.
- **AC-7**: `GET /api/attendance/2026-05-28` 가 단일 일자 상세(출근/퇴근/휴게/연장)를 200으로 반환하고, 존재하지 않는 날짜는 **404 또는 빈 상태 객체**를 일관되게 반환한다.
- **AC-8**: `PATCH /api/attendance/2026-05-28` 로 status를 `연장`으로 변경하면 응답에 변경된 status가 반영되고, 직후 `GET` 시 동일하게 조회된다(인메모리 반영).
- **AC-9**: `POST /api/attendance/requests`(body: date, reason, 변경내용) 가 요청을 저장하고 `GET /api/attendance/requests` 가 해당 요청을 `status:"대기"` 로 포함해 반환한다.
- **AC-10**: `GET /api/pay?month=2026-05` 가 `{ summary:{ totalPay, deductMinutes, overtimeCount, overtimeMinutes }, items:[...] }` 형태를 반환하고, `summary.totalPay` 와 `items` 합계(주휴 포함)가 일치한다.

### 홈 화면 (ST-4)
- **AC-11**: 홈(`/`) 진입 시 브랜드 헤더(Crewmon)·날짜(`2026.05.29 금` 형식)·매장명(`매머드커피 익스프레스 마석경춘로점`)·"N시간 근무했어요!" 문구·진행바(좌 `08:00-15:00`, 우 `100%`)·매장공지 카드·바로가기 카드 2개가 렌더된다.
- **AC-12**: 미출근 상태에서 **"출근" 버튼**이 노출되고, 클릭 시 store가 갱신되어 상태가 "근무중"으로 바뀌며 **"퇴근" 버튼**으로 전환된다(IMG_3608은 퇴근 상태 = 이미 출근됨). 퇴근 클릭 시 오늘 근무가 마감 상태로 표시된다.

### 출퇴근 캘린더/상세 (ST-5)
- **AC-13**: `/attendance` 월간 캘린더가 2026-05 그리드를 렌더하고, 근무일 셀에 **근무시간(`7h`/`6h30분` 등)** 이 표시된다. 연장일은 그린 `+34분`/네거티브 `-90분`·`-300분` 배지, 휴가일은 `휴가` 라벨, 상태별 색상 점이 표시된다.
- **AC-14**: 캘린더에서 날짜 셀을 탭하면 하단(또는 상세 라우트)에 해당일 **출근시각·근무시간·휴게·연장** 상세가 나타난다.
- **AC-15**: 상세(`/attendance/[date]`)에서 "출근상태 변경" 트리거 시 **바텀시트**가 열리고 라디오 5종(정상/지각/결근/휴가/연장)과 "변경" 버튼이 보인다. 옵션 선택 후 변경 시 PATCH 호출로 상태가 반영된다.
- **AC-16**: 수정요청 사유 textarea가 **0/100 카운터**를 가지며 100자 초과 입력이 막힌다. "수정요청" 버튼 클릭 시 POST가 호출되고, 화면 하단 "근무기록 수정 요청내역"에 날짜·시각·`대기` 상태로 추가된다.

### 급여 (ST-6)
- **AC-17**: `/pay` 가 월 선택, 요약카드(`월 급여 합계`·`급여 차감시간 440분`·`연장 근무 6회 9시간4분`), 일별 리스트를 렌더한다. 휴가일은 `0원`, 연장일은 `연장 2시간` 표기, 주휴수당 행은 **블루 색상**으로 구분된다.
- **AC-18**: `/pay/[date]` 가 출근/퇴근 시각, 기준급여(`시급 10,320원`), 급여인정시간(`6시간30분 08:00~15:00`), 휴게시간(`30분 11:30~12:00`), 급여차감시간, 연장근무시간, "확인" 버튼을 렌더하고, 표시된 일급 = `급여인정시간 × 시급` 검산이 맞는다.

### 디자인 충실도 / 공용 (ST-3·전역)
- **AC-19**: 디자인 시스템 주요 시각 요소가 재현된다 — (a) 메인 컬러 코랄/오렌지(#F26B4D 계열)가 1차 액션 버튼/강조에 사용, (b) **하단 고정 바텀탭 4개**(홈/출퇴근/급여/마이페이지) 노출 및 현재 탭 하이라이트, (c) 라운드 카드(rounded corners) 컨테이너, (d) 상태/변경이 **바텀시트 모달**로 표현, (e) 모바일 세로 단일 컬럼 레이아웃. (5개 중 5개 충족 = 통과)
- **AC-20**: 바텀탭에서 홈↔출퇴근↔급여 이동이 동작하고, "마이페이지"는 이번 범위 밖이므로 **비활성/플레이스홀더**로 처리되어 깨진 라우트를 만들지 않는다.

---

## 정량 메트릭

| 지표 | 목표 |
|------|------|
| 도메인 계산 테스트 통과율 | `pnpm test` 100% pass (시간/급여/연장/차감/주휴 케이스 포함) |
| 타입 안정성 | `pnpm exec tsc --noEmit` 에러 0 |
| 빌드 | `pnpm build` 성공(exit 0) |
| Lint | `pnpm lint` 에러 0 (warning 허용) |
| 핵심 화면 라우트 | 6개 라우트(/, /attendance, /attendance/[date], /pay, /pay/[date], + api) 200 응답 |
| 디자인 충실도 | AC-19 5요소 5/5 충족 |

---

## 엣지 케이스 (능동 식별)

1. **0건/빈 달**: 시드 없는 월(예 `?month=2026-04`) 조회 시 빈 배열/0원 요약을 반환하고 화면이 "데이터 없음" 상태로 깨지지 않는다.
2. **휴가일**: workMinutes 없음, 일급 0원, 캘린더 `휴가` 라벨 — 계산에서 0 처리(NaN/null 방지).
3. **결근/지각(차감)**: paidMinutes가 음수가 되지 않도록 0 하한 처리. 차감 > 근무이면 0원·0분.
4. **자정 넘김/시각 역전**: clockOut < clockIn 입력 시 음수 방지(검증 또는 명시적 0/에러 반환) — 시드엔 없으나 util 방어.
5. **존재하지 않는 날짜 라우트**: `/attendance/2026-05-99` 같은 잘못된 date 파라미터 → 일관된 404/빈 상태(런타임 크래시 금지).
6. **수정요청 빈 사유**: reason 빈 문자열로 POST 시 버튼 비활성 또는 400 — 빈 요청 미생성.
7. **인메모리 휘발성**: 서버 재시작 시 변경분 소실 → 시드로 리셋(명세된 동작, 버그 아님). DoD 문서에 명시.

---

## 완료 정의 (DoD)

> 신규 repo이므로 테스트 인프라부터 구성한다. Vitest 추가 후 아래 명령이 모두 통과해야 한다.

```bash
# 0) 테스트 의존성 설치 (ST-1에서 1회)
pnpm add -D vitest @vitest/coverage-v8

# 1) 단위 테스트 (시간/급여 계산 util + API route 핵심 분기)
pnpm test            # package.json scripts에 "test": "vitest run" 추가

# 2) 타입체크
pnpm exec tsc --noEmit

# 3) 프로덕션 빌드
pnpm build

# 4) Lint
pnpm lint
```

- [ ] AC-1 ~ AC-20 전부 충족
- [ ] `pnpm test` 100% pass (AC-1~5, AC-6~10 핵심 케이스 커버)
- [ ] `pnpm exec tsc --noEmit` 에러 0
- [ ] `pnpm build` 성공
- [ ] `pnpm lint` 에러 0
- [ ] `package.json` 에 `"test": "vitest run"` 스크립트 추가 (현재 없음 — 필수)
- [ ] 6개 라우트 + API 동작, 바텀탭 이동 정상
- [ ] 시드 데이터로 모든 화면이 빈 화면 없이 채워짐
- [ ] §10 Repository Artifacts 갱신 완료(CONTEXT.md, ADR)

---

## 8. 의존성 / 선행 조건

- **선행**: Vitest 미설치 → ST-1에서 devDependency 추가 필요(현재 `package.json`에 test 스크립트·러너 없음).
- **버전**: Next 16.2.6 / React 19.2.4 / Tailwind v4 / TS5 (설치 확인됨).
- **외부 API/DB/인증**: 없음(인메모리). → 외부 의존성 0, 네트워크 실패 시나리오는 로컬 fetch 한정.
- **데이터**: 시드 정확도가 화면/계산 검산의 기준. 시드 값은 IMG_3606/3608/3611로 검산됨(6.5h×10,320=67,080 ✔).

---

## 9. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 캘린더 배지 의미 해석 차이(`+34분`/`-90분`이 연장 vs 차감 표기) | 캘린더 표시 오류 | §Unresolved Q1 — 승인자 확인. 잠정 해석: 그린 `+`=연장, `-`=급여차감/조기퇴근. |
| 주휴수당 산식(어느 날에, 얼마) 불명확 | 급여 합계 검산 어긋남 | 시드에 주휴 행을 명시 값(67,080원)으로 박고 합계 일치만 검증(산식 추론 비목표). |
| 인메모리 휘발로 데모 중 상태 리셋 오인 | UX 혼란 | DoD/엣지#7에 명시 동작으로 문서화. |
| 픽셀 퍼펙트 기대치 차이 | 리뷰 회귀 | AC-19를 "5요소 충족"으로 측정 가능화. |

---

## 📌 Unresolved Questions (승인자 판단 위임)

1. **캘린더 음수 배지 의미**: `-90분`/`-300분`(IMG_3606)이 (a) 급여차감시간인지 (b) 정규 대비 조기퇴근/근무부족인지. 잠정: "정규 근무시간 대비 부족분(−) / 초과 연장분(+)" 으로 해석하여 표시. 다르면 교정 요청.
2. **주휴수당 발생 규칙**: 시드 고정값으로 처리(산식 구현 비목표)로 진행해도 되는지.
3. **출근/퇴근 토글의 시각 기록**: 토글 시 실제 현재시각을 기록할지, 시드의 고정 시각(08:00/15:00)을 쓸지. 잠정: 데모 일관성 위해 시드 고정 시각 사용 + 토글은 상태만 전환.

(※ `low_clarity_warning`은 false로 호출됨 — 위 항목은 설계 선택지 확인용이며, 미응답 시 잠정 해석으로 진행.)

---

## 10. Repository Artifacts 갱신 대상

1. **CONTEXT.md (도메인 용어집)** — 레포에 없음 → **신규 생성 필요**. 캐논 정의:
   - 급여인정시간: 근무시간에서 급여차감시간을 뺀, 급여 산정 기준 시간.
   - 급여차감시간: 지각·결근 등으로 근무로 인정되지 않아 인정시간에서 제외되는 시간(분 단위).
   - 연장근무: 정규 근무시간(기준선) 초과분. 급여/캘린더에서 별도 집계·표기.
   - 주휴수당: 주 소정근로 충족 시 지급되는 별도 급여 항목(급여 리스트에서 블루 별도 행).
   - 출근상태: 정상/지각/결근/휴가/연장 5종 enum.
   - 근무기록 수정요청: 출퇴근/상태 정정 요청. 대기→수락 상태 추적.
2. **docs/adr/0001-in-memory-route-handler.md (신규)** — 결정 2건 이상이므로 ADR 1개 작성:
   - 결정 A: 영속 저장 대신 Route Handler + 인메모리 store 채택(이유: 데모 범위, 외부 DB·인증 비목표, 재시작 시 시드 리셋 허용).
   - 결정 B: 계산 로직을 store/UI와 분리한 순수 함수(`src/lib/time.ts`,`pay.ts`)로 두어 Vitest 단위검증(이유: 급여 정확도가 핵심 가치 → 독립 검증 가능성 우선).
3. **운영 메타(.task-orchestrator.yml)**: 변경 불필요(구조 캐시 이미 확정). 별도 위저드 안내 없음.
