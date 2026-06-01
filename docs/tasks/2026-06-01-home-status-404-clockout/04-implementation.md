# 구현 노트 (T12) — 홈 상태전용 + 404→200 + 퇴근 확인

- 구현: task-developer (teammate mode)
- 스펙: `01-prd.md` (AC-1~4)
- 베이스라인: 195 GREEN / main

## AC 충족 매핑

| AC | 변경점 | 요약 |
|---|---|---|
| **AC-1 (B)** | `src/features/attendance/components/ClockToggle.tsx` | 출근/퇴근/마감 버튼 블록 + `clockIn`/`clockOut` 미사용으로 제거. `useTodayClock`의 `record`/`phase`로 매장명·headline·진행바만 표시(상태 전용). 홈 PATCH 경로 0. ClockToggle은 HomeToday에서만 사용(grep 확인) → 직접 제거, prop 분기 불필요. |
| | `src/features/attendance/components/HomeToday.tsx:37` | 버튼 모양 placeholder skeleton(`h-12 rounded-xl`) 제거 → 버튼 없는 새 레이아웃과 SSR/CSR 마크업 일치. |
| **AC-2 (C)** | `src/app/api/attendance/[date]/route.ts` | 잘못된 날짜 형식(`isValidDateString` 실패)만 404 유지. 유효 형식+기록 없음 → `NextResponse.json(null)` 200. 클라(`useTodayClock`/`useDayAttendance`)는 `res.ok ? json : null` → json===null 그대로 null 처리(무변경). `AttendanceDetail` 빈 상태 유지. |
| | `src/app/api/attendance/[date]/route.test.ts:23` | 기존 "없는 날짜 404" 단정을 **200+null로 의도적 갱신**(AC-2). "잘못된 형식 404" 케이스 추가. |
| **AC-3 (D)** | `src/features/attendance/components/ClockFab.tsx:35` | `clockOut` 경로에 `window.confirm(clockOutConfirmMessage())` 가드 추가 → 확인 시에만 `clockOut()`, 취소 시 미처리. **출근(clockIn)은 즉시**(확인 없음, T11 회귀 0). |
| | `src/features/attendance/components/clockFabConfirm.ts` | 신규 순수 함수 `clockOutConfirmMessage(now?)` = `현재 시각 ${nowHHMM(now)}에 퇴근 처리할까요?`. confirm 분기를 테스트 가능 형태로 분리(window.confirm 자체는 jsdom 미사용이라 코드 확인). |
| **AC-4 (회귀)** | — | append-only. 195 GREEN 유지(C route 1건 의도적 갱신). tsc/build/lint 0. |

## TDD 사이클 (vertical slice)

| 사이클 | AC | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 1 | AC-2 (C) | route.test.ts 유효날짜+기록없음 200 단정 → 404 실패 캡처 | route.ts `getRecord null` 시 `json(null)`, 잘못된 형식만 404 → 3 pass | 불필요(최소) |
| 2 | AC-3 (D) | clockFabConfirm.test.ts → 모듈 부재 실패 | `clockFabConfirm.ts` 순수 함수 → 2 pass | 불필요(최소) |

- B(ClockToggle 버튼 제거)/D(ClockFab confirm 배선)는 UI라 단위테스트 비대상 → 빌드/타입/lint + 코드 일치로 검증. confirm 의사결정 문구 로직은 사이클 2로 테스트 커버.
- Horizontal slicing 없음: 각 사이클 RED→GREEN 1:1.

## 자가 검증 (직접 Bash)

- `pnpm test`: ✅ **198 passed** (베이스라인 195 + clockFabConfirm 2 + route 순증 1; C 1건 의도적 갱신)
- `pnpm exec tsc --noEmit`: ✅ 0
- `pnpm build`: ✅ Compiled successfully
- `pnpm lint`: ✅ 0
- 회귀: **0** (C route 404→200+null 1건만 의도적 갱신)

## 경계면 일치 확인

- **API ↔ 클라**: `GET /api/attendance/[date]` 200+null ↔ `res.ok ? json : null` → null 그대로(무변경). 잘못된 형식 404 ↔ null. 계약 일치.
- **홈 ↔ FAB**: 홈은 GET 구독만(PATCH 0), 등록은 FAB 단일 진입점. `useTodayClock` 단일 진실원 공유.
- **하이드레이션**: HomeToday/ClockFab mount-gate 불변. placeholder skeleton을 버튼 제거 후 레이아웃에 맞춰 축소(SSR/CSR 일치).

## Repository Artifacts

- `CONTEXT.md`: "홈 토글 스코프"·"출퇴근 등록 FAB" 갱신, "단일일 상세 조회 계약" 신규 1행 추가(T12 마킹).
- ADR: PRD §10 명시 없음 → 미작성.

---

## REWORK v2 (분류 A) — P2-1 confirm 시각 ↔ 저장 시각 레이스 수정

리뷰(05-review.md) codex P2-1: 퇴근 confirm 메시지 시각과 `clockOut()` 내부 `nowHHMM()` 재호출이 별도 시점이라 분 경계에서 표시 시각 ≠ 저장 시각 가능. 범위 한정 수정(P2-2는 follow-up, 본 회차 범위 외).

### 수정 (파일:라인)

| 결함 | 수정 | 위치 |
|---|---|---|
| confirm now 와 PATCH now 별도 호출 | ClockFab 퇴근 분기에서 `const now = new Date()` 단일 캡처 → `clockOutConfirmMessage(now)` + `clockOut(nowHHMM(now))` 동일 인스턴스 사용 | `ClockFab.tsx:43-47` (+ import `nowHHMM` `:4`) |
| clockOut/clockIn 시각 주입 불가 | `clock(field, time?)` → PATCH body `time: time ?? nowHHMM()`(미전달 시 기존 동작, 회귀 0). `clockIn(time?)`/`clockOut(time?)` 시그니처 확장 | `useAttendance.ts:160-184`, 인터페이스 `:123-124` |
| `nowHHMM(now?)` | 이미 선택적 `now: Date = new Date()` 수신 — 그대로 사용 | `date.ts:65` (무변경) |

출근(clockIn) 경로는 기존 즉시 동작 불변(인자 미전달).

### 테스트

- TDD 사이클(vertical slice): RED(계약 명시) → GREEN(배선) → 회귀 검증.
- `clockFabConfirm.test.ts` 보강 1건: 단일 `now`(09:05:59.999, 분 경계 직전)로 만든 `clockOutConfirmMessage(now)` 의 표시 HH:MM 과 `nowHHMM(now)`(PATCH 인자) 가 동일("09:05")함을 단정 → ClockFab 이 의존하는 "표시 시각 = 저장 시각" 계약 고정.
- `useTodayClock` 훅은 React/fetch/useCurrentUser 결합으로 단위 격리 비용 큼 → 시그니처+배선은 tsc 타입체크 + ClockFab 호출부 코드 일치로 검증(내부 협력자 mock 회피 원칙).

### 자가 검증 (직접 Bash)

- `pnpm test`: ✅ **199 passed** (23 files; 베이스라인 198 + clockFabConfirm 계약 1건 순증)
- `pnpm exec tsc --noEmit`: ✅ 0
- `pnpm build`: ✅ Compiled successfully
- `pnpm lint`: ✅ 0
- 회귀: **0** (clockOut/clockIn 미전달 시 기존 `nowHHMM()` 동작 유지)

### 경계면 일치 확인

- **ClockFab ↔ useTodayClock**: `clockOut(nowHHMM(now))` 문자열 ↔ `clock(field, time)` `time ?? nowHHMM()` ↔ PATCH body `time` ↔ route `parseHHMM(body.time)` 검증. 캡처 시각이 저장까지 단일 인스턴스로 흐름.
- **출근 경로**: `clockIn()` 인자 미전달 → 기존 즉시 PATCH 동작 불변(회귀 0).
