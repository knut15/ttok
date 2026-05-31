# 04-implementation — 편집 시트 재구성 + 범위형 휴게 (T7)

- **작성**: task-developer
- **대상**: `01-prd.md`(v1), `02-approval.md`(Q1 범위형/Q2 출근 현행/Q3 수정요청), `03-architecture.md`(v1)
- **방식**: TDD vertical slice (RED→GREEN), mock 0, append-only, 회귀 0
- **결과**: 135 테스트 GREEN (기존 122 + 신규 13), tsc/lint/build 통과

## AC 충족 매핑

| AC | 충족 위치 | 검증 |
|---|---|---|
| AC-1 휴게 시트 clockOut 부재 + 범위입력 | `BreakChangeSheet.tsx`(시작/종료 2입력, clockOut 입력 없음) | grep `aria-label="퇴근` → 0건 |
| AC-2 after.break 범위 담김, clock 불변 | `AttendanceDetail.tsx` EditRequestForm onSubmit(after.breakStart/breakEnd, clockIn=record.clockIn) | 코드 일치 + store.test |
| AC-3 수락→breakMinutes 파생 + work 재계산 | `store.ts recalcClockFields`/`approveRequest` | store.test "휴게 범위(11:30~13:00)→90, work 330" |
| AC-4 퇴근 시트 상태+clockOut | `ClockOutStatusSheet.tsx`(라디오 5종 + clockOut 입력) | grep `aria-label="퇴근 시각"` → 1건 |
| AC-5 after{status,clockIn불변,clockOut}, 요청 | `AttendanceDetail.tsx` 퇴근 행→ClockOutStatusSheet→draft→수정요청 | 코드 일치(즉시 PATCH 아님) |
| AC-6 수락→clockOut+overtime+work 재계산 | `store.ts recalcClockFields`(calcOvertimeByClock) | store.test "16:30→work 480, overtime 90" |
| AC-7 break optional, 미명시 멱등 | 타입 optional + recalc case②③ | store.test "범위 미명시=기존 동작" + route.test |
| AC-8 clockIn 불변 | 모든 after.clockIn=record.clockIn | store.test "clockIn 불변" 단언 |

엣지: E-1(work 하한 0, calcWorkMinutes max), E-2(시트 비활성 + API NaN→400), E-3(동일시각 범위→0 존중, store.test), E-4(clockOut NaN 비활성/400), E-5(역전→0), E-6(clock null→work 0).

## 작업 로그 (시간순, TDD 사이클)

| 사이클 | RED | GREEN | 커밋 |
|---|---|---|---|
| 1 (time) | calcBreakMinutes 테스트 5개 실패(함수 부재) | `calcBreakMinutes` 순수함수 append(O(1), 역전/NaN/fallback) | `feat(time)` |
| 2 (types,seed) | seed.test ⑤ 실패(breakStart undefined) | 타입 optional append + 근무일 시드 11:30~12:00 부여 | `feat(types,seed)` |
| 3 (store) | store.test 2개 실패(범위 미반영, 동일시각 복원됨) | recalcClockFields R1 3-case + approveRequest merge + addRequest before 스냅샷 | `feat(store)` |
| 4 (api) | route.test 2개 실패(NaN 범위가 201) | POST after.break 범위 parseHHMM 검증(NaN→400) | `feat(api)` |
| 5 (UI) | (vitest node 환경상 UI 미지원 → 빌드/타입/lint + 코드 일치 검증) | BreakChangeSheet/ClockOutStatusSheet 신규 + AttendanceDetail 재배선(TimeChangeSheet 제거) | `feat(ui)` |

## 자가 검증 (DoD, 직접 Bash)

- 빌드(`pnpm build`): ✅ (15 라우트 컴파일 성공)
- 타입체크(`tsc --noEmit`): ✅ (에러 0)
- 린트(`pnpm lint`): ✅ (경고/에러 0)
- 단위 테스트(`pnpm test`): ✅ 135/135 (기존 122 + 신규 13, 회귀 0)
- TDD 사이클: 5 (각 RED 실패 확인 → 최소 GREEN). Horizontal slicing: ❌ 미사용(사이클별 커밋).
- mock: 0 (순수함수·인메모리 store 실경로, 시스템 경계 mock 불요).

## 경계면 일치 확인 (FE ↔ API ↔ store)

- break 범위: FE `after.breakStart/breakEnd:"HH:MM"` → API parseHHMM NaN→400 → store `calcBreakMinutes`→breakMinutes 파생 → 일치.
- clockOut: FE `after.clockOut:"HH:MM"|null` → API 기존 NaN→400(불변) → store calcWork/Overtime → 일치.
- clockIn: FE `after.clockIn=record.clockIn` 고정 → 기존 검증 불변 → merged 그대로 불변 → 일치(AC-8).
- break 미명시: FE after에 break 키 부재 → API 분기 미진입 → store fallback=기존 breakMinutes → 멱등 일치.

## 회귀 0 근거

- append-only: AttendanceRecord/EditRequestChange 기존 필드·시그니처 불변, breakStart?/breakEnd? optional 추가만.
- seed 불변식 ①440 ②6회544 ③totalPay: 근무일 범위 11:30~12:00 파생 30 = 기존 DEFAULT_BREAK_MINUTES → 입력 전부 불변(seed.test GREEN).
- StatusChangeSheet/AppHeader/PaySummaryCard 등 무수정. 출근 행 즉시 PATCH 현행 유지.
- T4 approve 흐름(멱등 no-op/upsert/결근·휴가 정책) store.test 기존 케이스 전부 GREEN.

## 신규/변경 파일

- 변경: `src/types/index.ts`, `src/lib/time.ts`, `src/lib/seed.ts`, `src/lib/store.ts`, `src/app/api/attendance/requests/route.ts`, `src/features/attendance/components/AttendanceDetail.tsx`, `CONTEXT.md`
- 신규: `src/features/attendance/components/BreakChangeSheet.tsx`, `src/features/attendance/components/ClockOutStatusSheet.tsx`, `docs/adr/0004-edit-sheet-roles-and-break-edit.md`
- 테스트 변경: `src/lib/time.test.ts`(+5), `src/lib/seed.test.ts`(+1), `src/lib/store.test.ts`(+4), `src/app/api/attendance/requests/route.test.ts`(+3)

## 미충족 AC

없음. AC-1~AC-8 전부 충족(UI는 코드 일치 + 빌드/타입/lint로 검증).

---

## REWORK v2 (분류 B — 아키텍처 계약 미이행, 범위 한정)

- **회차**: rework v2, 분류 B(스펙 불일치). 회귀 0(기존 135 테스트 그대로 GREEN).
- **대상 결함**: P2-1 (`05-review.md`) — `POST /api/attendance/requests` 가 `after.breakStart`/`after.breakEnd` 의 형식(NaN)만 검증하고 역전(end<=start) 거부 누락. 아키텍처 §2.7 경계면 표("end<=start→400") 및 §1("역전 검증") 미이행.

### 수정 (TDD: RED→GREEN, refactor 불요)

- **RED**: `src/app/api/attendance/requests/route.test.ts` 에 실패 테스트 3건 추가 — 역전(12:00~11:30)→400+미생성, 동일(11:30~11:30)→400, 정상(11:30~12:00)→201. 실행 결과 역전/동일 2건이 `201` 반환(기대 `400`)으로 RED 확인.
- **GREEN**: `src/app/api/attendance/requests/route.ts:71~80` — NaN 검증 루프 직후, `addRequest` 호출 전에 분기 추가. `breakStart`/`breakEnd` 가 **둘 다 명시(!== undefined)** 인 경우에만 `parseHHMM(breakEnd) <= parseHHMM(breakStart)` → 400(`{error:"휴게 종료가 시작보다 빠르거나 같습니다."}` + `no-store`). 한쪽만/미명시는 분기 미진입 → 기존 멱등 동작 보존. NaN 은 기존 루프가 선차단.

### 자가 검증 (DoD, 직접 Bash)

| 항목 | 결과 | 수치 |
|---|---|---|
| `pnpm test` | ✅ | 138/138 (기존 135 + 신규 3, 회귀 0) |
| `tsc --noEmit` | ✅ | 에러 0 |
| `pnpm build` | ✅ | 컴파일 성공 |
| `pnpm lint` | ✅ | 경고/에러 0 |

### 경계면 재일치 (architect §2.7)

- `break 범위 | API 검증: 존재 시 parseHHMM NaN→400, end<=start→400` — NaN(기존) + **end<=start(신규)** 모두 구현됨 → 경계면 표와 일치.
- ADR 0004 Consequences "fallback(0) 처리" 와 §2.7 간 모순은 **§2.7(거부) 우선**으로 해소(승인 스펙=아키텍처 우선).
