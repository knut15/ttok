# 04-implementation — 구현 노트 (task-developer)

- **대상 PRD**: `01-prd.md` (v1, APPROVED) / 승인 `02-approval.md` / 설계 `03-architecture.md`
- **방식**: TDD (RED→GREEN→REFACTOR), mock 0(시스템 경계도 인메모리 store라 mock 불요)
- **결과**: 기존 75 + 신규 25 = **100 테스트 GREEN, 회귀 0**. tsc/build/lint exit 0.

## AC 충족 매핑

| AC | 산출물 | 검증 |
|---|---|---|
| AC-1 레코드 after 반영 | `store.ts` `approveRequest` | `store.test.ts` "대기 요청 수락 시 …전이" |
| AC-2 status 대기→수락(타 요청 불변) | `store.ts` `approveRequest` | `store.test.ts` "다른 대기 요청 status 불변" |
| AC-3 work/overtime 재계산 | `recalcClockFields` + `calcOvertimeByClock` | `store.test.ts` "15:34→458/34" |
| AC-4 결근/휴가 정책 일관 | `approveRequest` status 분기 | `store.test.ts` 결근/휴가 케이스 |
| AC-5 조기출근·정시퇴근 0 | `calcOvertimeByClock` | `time.test.ts`+`store.test.ts` (07:58~15:00→work392/ot0) |
| AC-6 16:30→90 | `calcOvertimeByClock` | `time.test.ts` |
| AC-7 15:00→0 / 15:34→34 | `calcOvertimeByClock` | `time.test.ts` |
| AC-8 수락 API {request,record}/404 | `requests/approve/route.ts` | `route.test.ts` (200/404/400/멱등) |
| AC-9 수락 버튼 UI | `EditRequestList.tsx`(onApprove) + `AttendanceDetail.tsx` 배선 + `useAttendance.ts` approve | 빌드/렌더 + 대기에만 버튼·수락엔 없음 |
| AC-10 월 이동 | `AttendanceCalendarView.tsx` + `shiftMonth` + `page.tsx` | `date.test.ts` shiftMonth + 빌드 |
| AC-11 빈 달 graceful | 기존 `buildMonthGrid`/`getMonthRecords` 재사용 | 빌드(임의 월 그리드) |
| AC-12 회귀 0 | 전체 append-only | `pnpm test` 75→100 회귀 0 |

## ST별 완료 (TDD 사이클)

| ST | 사이클 | RED 캡처 | GREEN |
|---|---|---|---|
| ST-1 연장 정합 함수 | RED→GREEN | `calcOvertimeByClock is not a function`(8 fail) | time 19/19 (+8) |
| ST-4 shiftMonth | RED→GREEN | 4 fail(함수 부재) | date 9/9 (+4) |
| ST-2 approveRequest | RED→GREEN→REFACTOR | 9 fail(함수 부재) | store 21/21 (+9). REFACTOR: `recalcClockFields` 헬퍼로 `updateStatus`/`upsertTodayClock`/`approveRequest` 연장 산정 단일화(DRY) |
| ST-3 수락 API | RED→GREEN | route 모듈 부재(import fail) | route 4/4 (+4) |
| ST-3 hook/UI | 배선(이미 테스트된 store/route 조합) | — | 빌드 GREEN |

- Horizontal slicing 여부: ❌ (각 함수 단위 vertical slice, RED 실제 실패 확인 후 최소 GREEN)
- 내부 협력자 mock: 0건 (store는 인메모리 진실원, 공개 인터페이스로 행위 검증)

## 자가 검증 (실측)

- `pnpm test`: ✅ **100 passed (15 files)** — 기존 75 회귀 0 + 신규 25
  - 신규 내역: time +8, date +4, store +9, approve route +4
- `pnpm exec tsc --noEmit`: ✅ exit 0
- `pnpm build`: ✅ exit 0 (Compiled successfully, 7 API 라우트 + 8 페이지. `/api/attendance/requests/approve` 신규 노출 확인)
- `pnpm lint`: ✅ exit 0

## 경계면 일치 확인

- approve body `{id}` ↔ route `{id}` ↔ `approveRequest(id: string)` — 일치.
- 응답 `{request, record}` ↔ `ApproveResult`(types/index.ts append) ↔ `EditRequest`/`AttendanceRecord`(불변) — 일치.
- 월 GET `?month=` ↔ 기존 `getMonthRecords(month)` — 계약 재사용(변경 0).
- `AppHeader.title` 타입 `string`→`ReactNode` 확대(append-only, string은 ReactNode 부분집합 → 기존 호출 호환).

## 설계 준수 / 이탈

- 설계 §1~§4 그대로 구현. `calcOvertime` 불변(append-only), 호출부만 `calcOvertimeByClock`로 교체.
- **유일한 명세 보정**: PRD §10/설계 F16이 ADR 파일명을 `0001-overtime-by-clockout.md`로 적었으나, 레포에 0001·0002가 이미 존재 → "최대 번호+1" 규칙으로 **`docs/adr/0003-overtime-by-clockout.md`** 채번. (설계 이탈 아님, 번호 충돌 회피)

## Repository Artifacts

- `CONTEXT.md`: "연장근무"·"실근무 인정" 행을 clockOut 기준(`max(0, clockOut−900)`)으로 정밀화 + "근무기록 수정요청" 행에 수락 반영(after+재계산·upsert·멱등·`{request,record}`) 명문화. 추가/정밀화 용어 3행.
- `docs/adr/0003-overtime-by-clockout.md` 신규: 연장 산정 기준 변경 + 수락 멱등(Q2)/upsert(Q1) 정책.

## 변경/신규 파일

신규: `src/app/api/attendance/requests/approve/route.ts`(+`.test.ts`), `src/features/attendance/components/AttendanceCalendarView.tsx`, `docs/adr/0003-overtime-by-clockout.md`, 본 노트.
수정(append/호출부): `constants.ts`, `time.ts`(+test), `store.ts`(+test), `date.ts`(+test), `types/index.ts`, `useAttendance.ts`, `EditRequestList.tsx`, `AttendanceDetail.tsx`, `AppHeader.tsx`, `app/attendance/page.tsx`, `CONTEXT.md`.

---

## REWORK v2 (분류 A) — P1-1 after 페이로드 검증

**결함(codex P1-1)**: `POST /api/attendance/requests`(addRequest)가 `after.status`/`clockIn`/`clockOut`를 검증하지 않아 `after:{}`·불량 status 요청이 생성 → `approveRequest` 수락 시 `record.status=undefined` 오염. PRD E-8(형식 검증 400) 미충족.

### 수정 (파일:라인)
- `src/app/api/attendance/requests/route.ts:33-50` — POST 진입부에 after 형식 검증 추가:
  - `after.status`가 `WORK_STATUSES` 미포함 → 400 (`{error}` + no-store, 기존 패턴).
  - `after.clockIn`/`after.clockOut`가 null 아니고 `parseHHMM` NaN → 400 (null은 허용, 형식 불량 문자열만 차단).
- `src/lib/store.ts:248-253` — `approveRequest` 방어 가드(이중 안전): `after.status`가 유효 WorkStatus 아니면 기존 레코드 미반영 보존. 정상 흐름은 route에서 이미 차단되므로 주 수정은 route.

### 추가 테스트 (vertical slice, RED→GREEN)
`src/app/api/attendance/requests/route.test.ts` +4:
- `after:{}`(status 없음) → 400, 미생성
- `after:{status:"이상값"}` → 400, 미생성
- `after:{status:"연장", clockIn:"99:99"}` → 400, 미생성
- 정상 `after:{status:"연장", clockIn:"08:00", clockOut:"16:30"}` → 201, 1건 생성
- approve 회귀: 기존 store.test.ts 9케이스 GREEN 유지(유효 요청 생성→수락 정상).

### DoD (직접 Bash)
- `pnpm test`: **104 passed (15 files)** — 기존 100 + 신규 4, 회귀 0
- `tsc --noEmit`: exit 0
- `pnpm build`: exit 0
- `pnpm lint`: exit 0

범위 한정: P1-1 검증 + 테스트만. 다른 변경 없음(P1-2/P2/P3 follow-up 미손).

---

## REWORK v3 (분류 A + 사용자 지시 AC-13/14)

### 수정 1 — [P1 차단] undefined clock 검증 누락 (route.ts)

- **결함**: `after:{status:"정상"}`처럼 clockIn/clockOut 가 undefined 면 `clock != null` 이 false(JS: `undefined != null === false`)라 형식검사가 스킵 → 수락 시 record.clockOut=undefined 오염.
- **수정**:
  - `src/app/api/attendance/requests/route.ts:43-58` — POST after 검증 루프에 `clock === undefined` 명시 거부(400) 추가. null 은 계속 허용. after 는 status·clockIn·clockOut 3필드 완전체 요구.
  - `src/lib/store.ts:251-262` — `approveRequest` 방어 가드를 fail-closed 로 강화: `afterIsValid = status 유효 && clockIn/clockOut 가 (null|string)`. 무효면 store 미반영 + 안전 중립 레코드 반환(persist 안 함, status 대기 유지).
  - `src/lib/store.ts:308-318` — `emptyRecord(date)` 헬퍼 신규(fail-closed 폴백).
- **AC-14 정상 흐름 영향 없음**: clockIn 은 record 값 그대로 전송하므로 항상 string|null.

### 수정 2 — [사용자 지시 AC-13/14] 시간변경 = 퇴근만 수정

- **AC-13 (출근 읽기전용)**: `src/features/attendance/components/AttendanceDetail.tsx` `TimeChangeSheet`(165-227행 부근) — 출근 input 을 `readOnly`+`disabled` 표시로 변경. 퇴근(clockOut)만 `<input type=time>` 편집 가능. clockIn 로컬 상태 제거, `initial.clockIn` 직접 표시.
- **AC-14 (clockIn 불변·clockOut 만 반영)**:
  - `TimeChangeSheet.onApply`: `clockIn: initial.clockIn`(불변), `clockOut: 편집값`.
  - `AttendanceDetail` 출근 Row: `record.clockIn` 고정 표시(draft 미사용).
  - `EditRequestForm.onSubmit` after: `clockIn: record.clockIn`(항상), `clockOut: effectiveDraft.clockOut`.
- 퇴근 형식 검증(parseHHMM NaN → 적용 비활성) 유지. 연장 재계산은 수락 시 `calcOvertimeByClock(clockOut)` 로 자동 정합(기존 approveRequest 경로).

### 추가 테스트 (TDD vertical slice, RED→GREEN ×2)

| 사이클 | AC/결함 | 테스트 | 파일 |
|---|---|---|---|
| C1 | 수정1 (route undefined clock) | `after.clockOut 필드 부재(after:{status:정상}) 는 400 으로 거부하고 미생성` | `src/app/api/attendance/requests/route.test.ts` |
| C2 | 수정1 fail-closed (store P2) | `after.clockOut 가 undefined 인 손상 요청 수락 시 레코드를 오염시키지 않는다(fail-closed)` | `src/lib/store.test.ts` |

- C1 RED: 201 반환(검증 스킵) → GREEN: route 에서 undefined 차단 후 400.
- C2: store guard 가 미반영(getRecord null + status 대기) 보장. UI(AC-13/14)는 프로젝트 vitest 환경(node, *.test.ts only, no jsdom)상 렌더 단위테스트 미지원 → 빌드/타입/lint 로 검증. AC-14 invariant(after.clockIn=record값)는 route/store 계약 테스트로 커버.

### DoD (직접 실측)

| 항목 | 결과 |
|---|---|
| `pnpm test` | **106 passed (15 files)** — 기존 104 + 신규 2, 회귀 0 |
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm build` | exit 0 (Compiled successfully, 15 라우트/페이지) |
| `pnpm lint` | exit 0 |

범위 한정: 수정 1·2 + 신규 테스트 2건. P1(seed drift)/P2(역전 검증)/P3(에러 토스트) follow-up 미손.
