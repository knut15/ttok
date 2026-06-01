# 리뷰 보고서 (v1) — T12 홈 상태전용 + 404→200 + 퇴근 확인

- 리뷰어: task-reviewer (teammate mode)
- 검증 베이스: 961e5ae → 2d1982d
- 날짜: 2026-06-01

---

## AC 매트릭스

| AC# | 내용 | 충족 증거 | 일치 |
|---|---|---|---|
| **AC-1 (B)** | 홈 ClockToggle에서 출근/퇴근/마감 버튼 제거, 상태 표시 유지, 홈 PATCH 경로 0 | `ClockToggle.tsx` 전체: `clockIn`/`clockOut` import·호출 없음. `useTodayClock`의 `record`/`phase`만 소비. `<Card>` 내 버튼 엘리먼트 0개. HomeToday.tsx:53 에서 `<ClockToggle date={today}>`만 사용 — 버튼 없는 새 레이아웃. grep 결과 ClockToggle 사용처 = HomeToday 단 1곳 → prop 분기 불필요 직접 제거 확인. | ✅ |
| **AC-2 (C)** | 유효 날짜+기록 없음 → 200+null, 잘못된 형식 404 유지, 클라 null 처리 | `route.ts:16-20` isValidDateString 실패→404, `route.ts:28-29` 유효 형식→`NextResponse.json(record)` (record가 undefined이면 null 직렬화). `route.test.ts:23-28` 200+null 단정. `route.test.ts:30-34` 잘못된 형식 404 단정. 클라 `useAttendance.ts:166-170` `res.ok ? json : null` 패턴 무변경 — json===null도 record 없음 처리. `AttendanceDetail.tsx:81-87` `!record` 빈 상태 렌더링 확인. | ✅ |
| **AC-3 (D)** | 퇴근 clockOut에 window.confirm(현재 HH:MM), 출근 즉시 | `ClockFab.tsx:37-41` clockIn 분기 = 즉시 `clockIn()`. `ClockFab.tsx:44-45` clockOut 분기 = `window.confirm(clockOutConfirmMessage())` 가드 후 `clockOut()`. `clockFabConfirm.ts:5-7` 순수 함수 `nowHHMM(now)` 사용. `clockFabConfirm.test.ts:6-8` 09:05 주입 → "현재 시각 09:05에 퇴근 처리할까요?" 단정. | ✅ (단, 코드축 P2-1 보완 필요 — 아래) |
| **AC-4 (회귀)** | 기존 195 회귀 0, tsc/build/lint 0, 날짜클릭·크루격리·마스터게이트·FAB 등록 불변 | pnpm test: 198 passed (23 files). tsc --noEmit: 에러 없음. pnpm build: Compiled successfully. pnpm lint: 에러 없음. C 관련 route 1건 의도적 갱신 외 회귀 0. | ✅ |

### 자동 추가 항목

| AC# | 항목 | 일치 |
|---|---|---|
| AC-Proj-1 | 컨벤션 준수 | ✅ — "use client" 배치·useSyncExternalStore mount-gate·crewId 스코프 패턴 모두 기존 컨벤션 준수 |
| AC-Proj-2 | PRD §변경대상 자원 활용 | ✅ — ClockToggle/HomeToday/route.ts/ClockFab.tsx/clockFabConfirm.ts 모두 PRD 명시 파일과 일치 |
| AC-Proj-3 | project_skills 적합 스킬 활용 | ✅ — useTodayClock 공용 훅(T11 craft) 그대로 소비, 신규 중복 없음 |
| AC-Struct-1 | 신규 파일 배치 | ✅ — `clockFabConfirm.ts` → `src/features/attendance/components/` (기존 ClockFab 동일 폴더, 정합) |
| AC-Struct-2 | 폴더 책임 침범 금지 | ✅ — 외부 API 호출 없음, 도메인 로직 분리 이상 없음 |
| AC-Struct-3 | user_notes 규칙 준수 | ✅ — 순수 함수를 lib이 아닌 components/ 내 파일로 둔 것은 ClockFab 전용 문구 유틸이므로 적절 |
| AC-Repo-1 | CONTEXT.md 갱신 | ✅ — "홈 토글 스코프" T12 갱신, "출퇴근 등록 FAB" T12 갱신, "단일일 상세 조회 계약" 신규 행 추가(git diff 확인) |
| AC-Repo-2 | ADR 작성 | ✅ — PRD §10 "해당 없음" → 미작성 정당 |
| AC-Repo-3 | 갱신 시점 적절성 | ✅ — 2d1982d 단일 커밋에 코드+CONTEXT.md 동시 포함 |

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 4개(자동 추가 제외)
- file:line 증거: 4개
  - AC-1: `ClockToggle.tsx` 전체(13-48행), `HomeToday.tsx:53`
  - AC-2: `route.ts:16-20`, `route.ts:28-29`, `route.test.ts:23-28`, `route.test.ts:30-34`
  - AC-3: `ClockFab.tsx:37-45`, `clockFabConfirm.ts:5-7`, `clockFabConfirm.test.ts:6-8`
  - AC-4: test 198/198, tsc 0, build OK, lint OK
- test ID 증거: 3개(clockFabConfirm 2건, route 1건 신규)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개

AC 정량 증거 보유율: 4/4 = **100%**

---

## 경계면 검증

- **API ↔ 클라이언트 훅**
  - `GET /api/attendance/[date]` 200+null ↔ `useAttendance.ts:166-170` `res.ok ? json : null` → json===null 그대로 null 전달. 계약 일치.
  - 잘못된 날짜 404 ↔ `!res.ok` → null 반환. 계약 일치.
  - ClockFab의 `clockOut()` 호출 시 `useAttendance.ts:166` `nowHHMM()` 재호출 → 시각 캡처 지점(confirm 메시지)과 불일치 가능 (아래 codex P2-1).
- **홈 ↔ FAB 분리**
  - `ClockToggle.tsx`: `clockIn`/`clockOut` 구조분해 없음. PATCH 호출 경로 0. GET 구독(`useTodayClock`) 유지. 경계 일치.
  - `ClockFab.tsx`: `phase`/`busy`/`clockIn`/`clockOut` 전부 소비. 퇴근 confirm 가드 삽입. 출근 즉시 분기. 일치.
- **/attendance/[date] 페이지 ↔ API**
  - `page.tsx:13` isValidDateString 실패 시 `notFound()` — 잘못된 날짜는 페이지도 404 graceful.
  - `AttendanceDetail.tsx:81-87` `!record` → "해당 날짜의 근무기록이 없습니다." — 200+null도 크래시 0.
  - 경계 일치, 하이드레이션 안전.
- **HomeToday 하이드레이션**
  - SSR placeholder: `<Card aria-hidden>` 안에 skeleton 3개(h-5 w-40 / h-6 w-48 / h-2 w-full). 버튼 skeleton 제거 후 Card 내부 3행으로 축소 — SSR/CSR 마크업 일치 확인.

---

## 빌드/테스트 결과

- 빌드: ✅ Compiled successfully (pnpm build)
- 단위 테스트: ✅ 198/198 passed (23 test files)
  - 베이스라인 195 → 신규 clockFabConfirm 2건 + route 1건 순증
  - C route 404→200+null 의도적 갱신 1건
- tsc --noEmit: ✅ 오류 없음
- lint: ✅ 오류 없음

---

## 🤝 교차 검증 (codex review)

- 자체 판정(하네스축): PASS
- codex 판정: **FAIL** (P2 × 2건)
- 호출 시각: 2026-06-01T13:01 (codex review --base 961e5ae)
- reasoning_effort: none (gpt-5.5 기본)

### codex 지적

**[P2-1] confirm 시각 ↔ 저장 시각 불일치** — `ClockFab.tsx:44-45`
- 사용자가 09:05에 confirm 대화상자를 열고 분이 바뀐 뒤 OK를 클릭하면, 메시지는 "09:05에 퇴근"이지만 `clockOut()`이 `nowHHMM()` = 09:06으로 PATCH한다. 사용자가 승인한 시각과 실제 저장 시각이 다를 수 있음.
- 분류: **A** (품질 미흡 — AC-3 문구 스펙 자체는 충족했으나 confirm 시각 고정 보장 미흡)
- 권고: `clockOutConfirmMessage()`에서 생성한 `now` 인스턴스(또는 HH:MM 문자열)를 `clockOut(capturedTime)`으로 전달하여 confirm 시각 = 저장 시각을 보장.

**[P2-2] PATCH 경로 잘못된 날짜 형식 미검증** — `route.ts(GET):16-20` ↔ `api/attendance/route.ts(PATCH):29-35`
- GET에서 `isValidDateString` 실패→404 가드를 추가했으나, PATCH `/api/attendance?date=2026-05-99`는 동일 검증 없음 → 잘못된 날짜로 기록이 생성될 수 있고, 생성된 기록은 `GET /api/attendance/[date]`로 조회 불가(404 반환).
- codex 판정: T12 diff의 변경 내용(GET 가드 추가)이 일관성 없이 PATCH에 미적용 → 계약 불일치.
- 단, T12 PRD 스펙(AC-1~4)에 PATCH 검증은 명시되지 않음. T12 이전부터 존재하던 PATCH 경로 문제(pre-existing gap)임. T12 diff에서 GET에 검증을 추가하면서 PATCH와의 불일치가 더 가시화됨.
- 분류 검토: pre-existing gap이고 T12 PRD 범위 외 → **follow-up 등록**(P2-2는 이번 REWORK 차단 기준에서 제외, 단 follow-up 필수).

### 최종 codex 축 판정

- P2-1: 비차단(AC-3 문구 스펙 자체는 충족, 단 품질 보완 필요) → REWORK 대상
- P2-2: T12 PRD 범위 외 pre-existing gap → follow-up 등록, 이번 판정 차단 아님

`gate_mode: and` 원칙 적용: 코드축 FAIL → 자체 PASS 불가.

- 최종 결정: **REWORK (A)** — P2-1 보완 후 재검증

---

## 최종 판정

- **판정: REWORK (A)**
- **사유**: 하네스축(AC/DoD/회귀) 전 항목 통과. codex 코드축 P2-1(confirm 시각 ↔ 저장 시각 불일치) — AC-3의 "현재 시각 HH:MM에 퇴근 처리할까요?" 문구 스펙은 충족하나, confirm 대화상자에 표시된 시각이 실제 PATCH 저장 시각과 다를 수 있는 레이스 조건이 존재. 품질 미흡 분류.
- **회귀 지점: developer**

### 수정 요청 항목

1. **[필수] ClockFab confirm 시각 고정** (`ClockFab.tsx:44-45`)
   - `handleClick`에서 퇴근 분기 진입 시 `new Date()`를 한 번만 캡처(`const now = new Date()`).
   - `clockOutConfirmMessage(now)`에 주입하여 confirm 메시지 시각과 PATCH 시각을 동일 인스턴스로 통일.
   - `clockOut`이 시각 인자를 받도록 `useTodayClock` / `useAttendance` 훅 시그니처 갱신 필요 (또는 `clockOut(nowHHMM(now))` 형태로 전달).
   - 수정 후 `clockFabConfirm.test.ts`에 "confirm 주입 now와 clockOut 인자가 동일 시각"을 검증하는 케이스 추가 권장.

2. **[follow-up, 이번 REWORK 범위 외] PATCH `/api/attendance` 잘못된 날짜 형식 검증 추가**
   - T12 범위 외 pre-existing gap. 별도 task(T13 이후)로 `isValidDateString` 가드를 PATCH 경로에도 적용.
   - 현재 동작: 잘못된 날짜(`2026-05-99`)로 PATCH → 기록 생성 → GET으로 조회 불가(404).
   - 영향: 현재 클라이언트가 `todayDate()`(항상 유효 형식)를 사용하므로 실제 사용자 흐름에서 발생 가능성 낮음. 그러나 계약 일관성 관점에서 보완 권장.

---

## 회귀 부작용 확인 (C: 404→200 계약 변경)

- `useTodayClock` / `useDayAttendance`: `res.ok ? json : null` 패턴 → 200+null을 null로 처리(코드 무변경, 회귀 0).
- `AttendanceDetail`: `!record` 분기로 빈 상태 렌더 → 200+null도 graceful(크래시 0).
- `/attendance/[date]` page: `isValidDateString` 실패 시 `notFound()` → 잘못된 날짜 URL은 Next.js 404(크래시 0).
- 기존 GET `[date]` route 사용처(AttendanceDetail, useDayAttendance): 기존에 404→null 처리 → 이제 200+null→null로 동일 결과. 다른 페이지·클라이언트 영향 0 확인.
- PATCH route 및 월간 GET은 미변경. 크루격리·마스터게이트·cursor 불변.

---

## follow-up 후보

| 우선순위 | 항목 | 근거 |
|---|---|---|
| **P1** | confirm 시각 고정 (수정 요청 #1) | 현재 REWORK 항목. 사용자 신뢰성 문제(승인한 시각 ≠ 저장 시각 가능) |
| **P2** | PATCH 잘못된 날짜 검증 추가 | codex P2-2. pre-existing gap. 사용자 흐름 영향 낮으나 계약 일관성 결함 |
| **P3** | clockOut 시각 인자 테스트 커버 | confirm 주입 now와 PATCH 인자 동일성 단위 테스트 보강 |

---

## 재검증 (v2)

- 리뷰어: task-reviewer (teammate mode)
- 검증 베이스: 2d1982d → 156b724
- 날짜: 2026-06-01

### P2-1 해소 확인

| 항목 | 확인 | 근거 |
|---|---|---|
| `now` 단일 캡처 | ✅ | `ClockFab.tsx:46` `const now = new Date()` 퇴근 분기 진입 직후 1회만 캡처 |
| confirm 메시지 시각 = PATCH 시각 | ✅ | `ClockFab.tsx:47-48` `clockOutConfirmMessage(now)` + `clockOut(nowHHMM(now))` 동일 인스턴스 사용 |
| 분 경계 레이스 차단 계약 테스트 | ✅ | `clockFabConfirm.test.ts:19-26` 09:05:59.999 인스턴스로 `clockOutConfirmMessage(now)` 표시 시각 = `nowHHMM(now)` PATCH 인자 동일성 단정 |
| clockOut(time?) 인자 시그니처 | ✅ | `useAttendance.ts:123-124` `clockIn/clockOut: (time?: string) => ...`. `clock(field, time?)`:168 `time ?? nowHHMM()` — 미전달 시 기존 경로(회귀 0) |
| 출근(clockIn) 즉시 불변 | ✅ | `ClockFab.tsx:37-41` clockIn 분기: `now` 캡처 없음, 즉시 `clockIn()` 인자 미전달 — 기존 동작 그대로 |

### v2 DoD (직접 Bash)

| 항목 | 결과 |
|---|---|
| pnpm test | ✅ 199/199 passed (23 files) — 베이스라인 198 + clockFabConfirm 계약 1건 순증 |
| tsc --noEmit | ✅ 오류 0 |
| pnpm build | ✅ Compiled successfully (Turbopack, 1603ms) |
| pnpm lint | ✅ 오류 0 |
| 회귀 | 0 — clockOut/clockIn 인자 미전달 시 `nowHHMM()` 기존 경로 유지(diff 확인) |

### v2 AC 매트릭스 (변경 영향 항목)

| AC# | 내용 | v2 충족 증거 | 일치 |
|---|---|---|---|
| **AC-3 (D)** | 퇴근 confirm 시각 = 저장 시각 (P2-1 보완) | `ClockFab.tsx:46-48` now 단일 캡처 + `clockFabConfirm.test.ts:19-26` 계약 단정 | ✅ |
| **AC-4 (회귀)** | 199/199, tsc 0, build OK, lint OK | pnpm test/tsc/build/lint 직접 실행 확인 | ✅ |

### 경계면 v2

- ClockFab:46 `const now = new Date()` → ClockFab:47 `clockOutConfirmMessage(now)` → ClockFab:48 `clockOut(nowHHMM(now))` → `useAttendance.ts:168` `time ?? nowHHMM()` → PATCH body `{field, time}`. 동일 인스턴스가 confirm 표시에서 네트워크 전송까지 단일 흐름으로 연결됨. 경계면 일치.

### 교차 검증 v2 (codex review --base 2d1982d)

- 자체 판정(하네스축): PASS
- codex 판정: **PASS**
- 호출 시각: 2026-06-01T13:09 (codex review --base 2d1982d, gpt-5.5)
- codex 출력: "The change consistently reuses the captured clock-out time for both the confirmation message and PATCH payload. Type checking passed, and no introduced regression was identified."
- P1 finding: 0건
- P2 finding: 0건 (v1 P2-1 해소 확인, v1 P2-2는 T12 범위 외 — 변동 없음)
- 최종 결정: **PASS 확정** (`gate_mode: and` 양축 모두 PASS)

### 최종 판정 (v2)

- **판정: PASS**
- **사유**: v1 REWORK(A) 수정 요청 #1(P2-1 confirm 시각 고정) 완전 해소. `ClockFab.tsx:46-48`에서 `const now = new Date()` 단일 캡처 → confirm 메시지·PATCH 시각 동일 인스턴스 보장. 계약 테스트(clockFabConfirm.test.ts:19-26) 추가. 199/199 통과, tsc/build/lint 0, 회귀 0. codex 재게이트 P1/P2 finding 없음.
- **회귀 지점**: 없음 (종료)

### follow-up (v2 기준 이월)

| 우선순위 | 항목 | 근거 |
|---|---|---|
| **P2** | PATCH `/api/attendance` 잘못된 날짜 검증 추가 | v1 codex P2-2. pre-existing gap. T13 이후 별도 task 권장 |
