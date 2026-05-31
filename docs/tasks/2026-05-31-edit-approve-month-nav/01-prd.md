# 수정요청 수락 반영 + 달력 이전달 보기 (Crewmon 확장)

생성일: 2026-05-31
작성자: task-planner
버전: v1

## 1. 배경 & 문제

- **현재**:
  - (기능1) 근무기록 상세에서 "시간변경"으로 입력한 출/퇴근 시각은 `EditRequest`(수정요청)로만 생성된다(`addRequest`, status `대기`). 실제 `AttendanceRecord`에는 반영되지 않고, 요청을 수락/적용하는 경로가 존재하지 않는다. `EditRequestList`는 대기 배지만 표기한다.
  - (기능2) `/attendance` 페이지가 `SEED_MONTH`("2026-05") 고정으로 렌더된다. `MonthSelector`/`AppHeader`의 월 라벨은 표시 전용이며 이전/다음 달로 이동할 수 없다. 단, store/hook(`getMonthRecords(month)`, `useMonthAttendance(month)`)은 이미 month 파라미터를 받도록 설계되어 있다.
- **문제**:
  - (기능1) 점주 승인(데모상 사용자 직접 수락) 시 레코드에 변경이 반영되지 않아, IMG_3609의 "05.05 화 수락 / 정상 07:26~15:00 → 연장 34분" 표기를 재현할 수 없다.
  - (기능1 정합) 선행 task(payroll-bugfix) 리뷰의 **T3 follow-up P1**: `calcOvertime(workMinutes)`는 `max(0, workMinutes − 390)`으로 단순 계산하여, 조기출근으로 workMinutes가 390을 넘는 경우(예 5/28 392분, 07:58 출근·15:00 정시 퇴근) 연장이 0이어야 함에도 2분으로 잘못 산정된다. 수정요청 수락으로 clock이 변경되면 이 결함이 표면화된다.
  - (기능2) 다른 달(시드 없는 2026-04/2026-06 포함) 캘린더를 볼 수 없다.
- **근거**: `docs/tasks/2026-05-31-payroll-bugfix/05-review.md` Follow-up P1 (codex P2 → P1 승격, `src/lib/seed.ts:60` 노출). CONTEXT.md "실근무 인정" 행("연장은 정시 퇴근(15:00) 초과분만 인정").

## 2. 목표 & 비목표

### 목표 (Goals)
- (G1) 대기 상태 수정요청을 **수락**하면 해당 날짜 레코드에 `after`(상태·출근·퇴근)를 반영하고 근무시간/연장/급여 관련 필드를 재계산하며, 요청 status를 `대기→수락`으로 전이한다.
- (G2) 연장(overtime) 산정을 **정시 퇴근(정규 종료시각 15:00) 초과분 기준**으로 정합화한다. 조기출근분·정규내 근무는 연장이 아니다(T3 follow-up 해소).
- (G3) `/attendance` 캘린더에 이전/다음 달 이동을 추가하고, 시드 없는 달은 빈 캘린더로 graceful 처리하며 월 라벨이 갱신된다.

### 비목표 (Non-goals / Out-of-scope)
- 점주 계정·인증·권한 모델 구현 (데모상 사용자가 직접 "수락" — 승인 시뮬레이션). 거절(reject)/철회 액션은 본 범위 밖.
- 수락 취소(`수락→대기` 역전이) 및 수락 후 재편집. status enum은 기존 `대기 | 수락` 2종 유지(append-only, 신규 상태 추가 없음).
- 지각(`deductMinutes`) 산식 정의·변경. 기존 정책(지각은 deduct 보존) 유지 — 본 task에서 지각 차감 로직을 건드리지 않는다.
- 월 점프(드롭다운으로 임의 월 선택), 연(year) 단위 이동 UI. 이전/다음 월 1칸 이동만.
- 주휴수당 산식 구현(시드 고정값 유지), 급여 페이지(`/pay`)의 새 월 네비게이션. 본 task의 월 이동은 `/attendance` 캘린더에 한정.
- store 영속화(인메모리 유지, 서버 재시작 시 시드 초기화 — 명세 동작).

## 3. 솔루션 개요

**기능1 (수락 반영)**: store에 `approveRequest(id)`를 append한다. 동작은 (a) requestId로 대기 요청 조회 → (b) 해당 날짜 레코드에 `after.status/clockIn/clockOut` 반영 → (c) clock 존재 시 `calcWorkMinutes` + 정합화된 연장 산정으로 work/overtime 재계산(기존 `updateStatus`의 정상/연장 분기 재계산 규칙과 동일한 휴게 복원·재계산 패턴 준용, CONTEXT.md "결근/휴가/실근무 인정" 정책 유지) → (d) 요청 status `대기→수락` 전이 → 갱신된 레코드(또는 요청+레코드)를 반환. Route Handler `POST /api/attendance/requests/approve`(body `{ id }`)를 신규 추가하고, `useEditRequests` hook에 `approve(id)` mutate를 append한다. `EditRequestList`는 presentational을 유지하되 `대기` 요청에 한해 "수락" 버튼을 렌더(콜백 prop으로 위임)하고, 수락 후 상세 화면의 레코드/목록을 reload한다.

**기능1 연장 정합 (G2)**: 연장 산정 기준을 workMinutes 초과분이 아니라 **clockOut의 정규 종료시각(15:00=900분) 초과분**으로 변경한다. 신규 순수 함수 `calcOvertimeByClock({ clockOut })`(또는 `calcOvertime` 시그니처 확장)을 `src/lib/time.ts`에 추가하고, 재계산을 수행하는 모든 경로(`approveRequest`, `updateStatus` 정상/연장 분기, `upsertTodayClock`)가 이를 사용하도록 정합화한다. 정규 종료시각은 `src/lib/constants.ts`에 상수로 노출(예 `REGULAR_END_MINUTES = 900` 또는 `REGULAR_END = "15:00"`). 시드 레코드는 명시값 보존(불변식 ②: 연장 6회/544분)이며, 정합화로 인해 시드 5/28(07:58~15:00)이 런타임 재계산되어도 overtime이 0으로 유지되어 불변식이 깨지지 않는다.

**기능2 (월 이동)**: `/attendance` 페이지를 client 월 상태(`useState`)로 전환하거나 캘린더 영역을 client 컴포넌트로 분리(경계 설정은 architect 판단). 월 라벨(`formatMonthLabel`)과 헤더가 현재 month에 동기화되고, 이전/다음 버튼이 month를 ±1개월 이동시킨다. month 변경 시 `useMonthAttendance(month)`가 재fetch하며, 시드 없는 달은 빈 배열 → 빈 그리드(`buildMonthGrid`는 이미 임의 월 그리드 생성). `MonthSelector`는 라벨·콜백 prop을 받는 presentational 유지(시그니처 변경 시 append-only).

### 활용할 프로젝트 자원
- `CONTEXT.md` §"실근무 인정" / §"연장근무" / §"결근·휴가 차감 정책": 재계산 규칙·연장 정의의 단일 출처 — phase 2.5/3 작성 기준. (정독 완료)
- `src/lib/time.ts` `calcWorkMinutes`/`calcOvertime`, `parseHHMM`: 재계산·연장 산정 기반 — phase 3에서 확장/호출.
- `src/lib/store.ts` `updateStatus`(정상/연장 재계산 분기), `addRequest`/`listRequests`: `approveRequest` 구현 시 동일 패턴 준용 — phase 3.
- `src/lib/date.ts` `buildMonthGrid`/`formatMonthLabel`: 월 이동 그리드·라벨 — phase 3에서 호출(빈 달 그리드 이미 지원).
- `src/features/attendance/hooks/useAttendance.ts` `useMonthAttendance(month)`/`useEditRequests`: month 상태화·approve mutate append — phase 3.
- `src/components/MonthSelector.tsx`: 월 라벨/이동 콜백 표현 컴포넌트 재사용 — phase 3.
- (프로젝트 전용 command/skill/agent 미발견 — `project_skills` 입력 없음. 발견되지 않은 자원은 호출하지 않음.)

### 프로젝트 구조
- 패턴: feature-based (`src/features/<feature>/{components,hooks,domain.ts}`), 도메인 계약 단일 출처 `src/types/index.ts`, 순수 계산 `src/lib/*.ts`(부수효과 0, store 비의존), 인메모리 store + Next.js Route Handler.
- 신규 산출물 배치 (architect 확정 전 제안):
  - 연장 정합 함수 → `src/lib/time.ts` (append, 순수 함수)
  - 정규 종료시각 상수 → `src/lib/constants.ts` (append)
  - `approveRequest` → `src/lib/store.ts` (append)
  - 수락 API → `src/app/api/attendance/requests/approve/route.ts` (신규 폴더)
  - hook mutate(`approve`) → `useAttendance.ts` `useEditRequests`에 append
  - "수락" 버튼/콜백 → `EditRequestList.tsx`(+상위 `AttendanceDetail.tsx` 연결)
  - 월 이동 UI → `src/app/attendance/page.tsx` + `MonthlyCalendar`(또는 신규 래퍼 client 컴포넌트, architect 판단)
- 기존 export는 append-only(시그니처 파괴 금지).

## 4. Acceptance Criteria

연장 산정 기준선: 정규 시작 08:00(480분), 정규 종료 15:00(900분), 휴게 30분, 정규 390분.

| # | AC | 검증 방법 |
|---|---|---|
| AC-1 | Given store에 날짜 D의 레코드와 대기 EditRequest(id=R, after.status/clockIn/clockOut)가 존재, When `approveRequest(R)` 호출, Then 레코드 D의 status/clockIn/clockOut이 after 값으로 갱신된다 | `store.test.ts` 단위 |
| AC-2 | Given AC-1과 동일, When `approveRequest(R)`, Then 요청 R의 status가 `대기→수락`으로 전이한다(다른 요청은 불변) | `store.test.ts` 단위 |
| AC-3 | Given after에 clockIn·clockOut이 모두 존재(정상/연장), When `approveRequest(R)`, Then 레코드의 workMinutes = `calcWorkMinutes(after.clockIn, after.clockOut, 휴게)` 로 재계산되고 overtimeMinutes가 정합 규칙(AC-5~7)으로 재계산된다 | `store.test.ts` 단위 |
| AC-4 | Given after.status가 `결근`/`휴가`, When `approveRequest(R)`, Then 기존 CONTEXT.md 차감 정책(결근 deduct=390·work/overtime/break=0 / 휴가 deduct=0·work/overtime/break=0)이 일관 적용된다 | `store.test.ts` 단위 |
| AC-5 (연장 정합) | Given clockIn=07:58·clockOut=15:00 (조기출근·정시퇴근), When 재계산, Then overtimeMinutes === 0 (workMinutes는 392여도 연장 아님) | `time.test.ts` + `store.test.ts` 단위 |
| AC-6 (연장 정합) | Given clockIn=08:00·clockOut=16:30, When 재계산, Then overtimeMinutes === 90 (정규 종료 900분 초과분 990−900) | `time.test.ts` + `store.test.ts` 단위 |
| AC-7 (연장 정합) | Given clockIn=07:26·clockOut=15:00 (IMG_3609 5/05 케이스의 정시퇴근 변형) Then overtime===0; Given clockOut=15:34 Then overtime===34. 즉 연장 = `max(0, parseHHMM(clockOut) − 900)`, clockIn 무관 | `time.test.ts` 단위 |
| AC-8 | Given 수정요청 수락 통합 흐름, When `POST /api/attendance/requests/approve` body `{ id: R }` (R=유효 대기), Then 200/201과 갱신된 레코드(또는 레코드+요청)를 반환하고 `GET /api/attendance/{date}`·`GET /api/attendance/requests`가 갱신 결과를 반영한다 | `requests/approve/route.test.ts` 통합 |
| AC-9 | Given 상세 화면에서 날짜 D의 대기 요청이 목록에 있음, When 해당 요청의 "수락" 버튼 클릭, Then 요청 배지가 `수락`(coral)으로 바뀌고 출/퇴근 Row가 after 값을 반영(reload)한다. `수락` 상태 요청에는 "수락" 버튼이 렌더되지 않는다 | UI 확인 / 컴포넌트 렌더 검증 |
| AC-10 (월 이동) | Given `/attendance` 진입(기본 SEED_MONTH), When "다음달" 버튼 클릭, Then month가 2026-06으로 바뀌고 헤더/라벨이 "2026년 6월"로 갱신되며 `GET /api/attendance?month=2026-06` 결과로 그리드가 렌더된다. "이전달" 동작은 대칭(2026-04) | UI 확인 / 통합 |
| AC-11 (빈 달 graceful) | Given 시드 없는 달(2026-04 또는 2026-06)로 이동, When 캘린더 렌더, Then 에러·크래시 없이 해당 월 그리드가 일자 셀만(근무 라벨/배지 없음, 휴가 없음) 정상 표시된다 | UI 확인 / 통합 |
| AC-12 (회귀 0) | Given 본 변경 적용, When `pnpm test`, Then 기존 75 테스트가 GREEN(연장 정합으로 의도적 갱신이 필요한 단정값 외 회귀 0)이고, 홈(`/`)·출퇴근(`/attendance`,`/attendance/[date]`)·급여(`/pay`,`/pay/[date]`)·마이페이지(`/mypage`,`/mypage/profile`) 라우트가 정상 렌더된다 | `pnpm test` + 라우트 수동/빌드 확인 |

## 5. 엣지 케이스

| # | 케이스 | 기대 동작 |
|---|---|---|
| E-1 | 존재하지 않는 requestId로 수락 (`approveRequest("req-999")`) | store는 변경 없이 `null` 반환; API는 404 + 에러 JSON(레코드/요청 불변) |
| E-2 | 이미 `수락` 상태인 요청 재수락 | 멱등 또는 거부 — 레코드를 중복 반영하지 않는다. 권장: API 409(또는 200 no-op)로 status 유지, 레코드 불변. (architect/리뷰 합의 필요 시 §11) |
| E-3 | 수락 대상 요청의 date에 레코드가 없음(시드 외 날짜) | `upsertTodayClock` 준용으로 신규 레코드를 after로 생성하거나, "레코드 없음" 404 처리. 정책 §11 질의 |
| E-4 | after.clockIn/clockOut 중 하나만 존재하거나 둘 다 null(결근/휴가 after) | clock 미완(한쪽 null) → workMinutes/overtime 0(`calcWorkMinutes` end<=start→0 규칙), 상태만 반영. 결근/휴가는 AC-4 정책 |
| E-5 (연장 경계: 정시퇴근) | clockOut === "15:00"(=900분) | overtimeMinutes === 0 (초과 0) |
| E-6 (연장 경계: 조기출근) | clockIn < 08:00, clockOut <= 15:00 (예 07:00~15:00) | overtimeMinutes === 0 (조기출근은 연장 아님), workMinutes는 실근무 인정 |
| E-7 (연장 경계: 연장퇴근) | clockOut > 15:00 (예 17:00=1020분) | overtimeMinutes === 120 (1020−900) |
| E-8 | clockOut < clockIn (역전) 또는 형식 불량 | `calcWorkMinutes`=0, overtime=0; API는 입력 검증 단계에서 400(또는 0 처리) — 기존 parseHHMM/검증 규칙 준용 |
| E-9 (빈 달 이동) | 시드 없는 달로 이동 | 빈 그리드 graceful(E 없음), 라벨 갱신 — AC-11 |
| E-10 | 월 경계 넘기(2026-12 → 2027-01 / 2026-01 → 2025-12) | month 산술이 연도 경계를 정확히 처리(±1개월), 라벨 정상. 빈 달이면 E-9 |

## 6. 데이터 모델 / API 계약

```
// 신규 — 수정요청 수락
POST /api/attendance/requests/approve
Request body: { id: string }      // EditRequest.id
Response 200/201: AttendanceRecord (갱신된 레코드)   // 또는 { record, request } (architect 확정)
Response 404: { error } // 존재하지 않는 id
Response 409: { error } // 이미 수락된 요청 (E-2 정책 채택 시)

// store (append-only)
approveRequest(id: string): AttendanceRecord | null
// → 대기 요청 조회 → 레코드에 after 반영 + work/overtime 재계산(연장 정합) → status 대기→수락

// time.ts (append, 순수)
calcOvertimeByClock(i: { clockOut: string | null }): number
// → clockOut === null → 0; max(0, parseHHMM(clockOut) − REGULAR_END_MINUTES)
//   (또는 calcOvertime 시그니처 확장 — architect 확정. 기존 호출부는 append-only로 보존)

// constants.ts (append)
REGULAR_END_MINUTES = 900   // 15:00 (정규 종료시각)

// hook (append) — useEditRequests
approve(id: string): Promise<boolean>   // POST 후 reload

// 기존 타입(types/index.ts) 변경 없음 — EditRequest/AttendanceRecord/EditRequestStatus 그대로 사용
```

기존 export(`calcOvertime`, `addRequest`, `listRequests`, `updateStatus`, `useMonthAttendance` 등) 시그니처는 보존(append-only). `calcOvertime`을 정합 규칙으로 변경할 경우, 인자 의미가 workMinutes→clockOut으로 바뀌므로 **신규 함수 추가 후 호출부 교체**를 권장(기존 함수 시그니처 파괴 회피, architect §확정).

## 7. 메트릭

| 지표 | 현재 | 목표 |
|---|---|---|
| 수정요청 수락→레코드 반영 성공률 (대기 요청 수락 시 레코드 갱신) | 0% (수락 경로 없음) | 100% |
| 연장 오산정 케이스(조기출근·정시퇴근 시 overtime>0) | 1건 노출(5/28: 2분) | 0건 |
| 접근 가능 캘린더 월 수 | 1 (SEED_MONTH 고정) | 임의 월(±N 이동, 빈 달 포함) |
| 기존 테스트 회귀 | — | 75/75 GREEN + 신규 테스트 GREEN |

## 8. 의존성

- 선행 task: `docs/tasks/2026-05-31-payroll-bugfix` (T3 follow-up P1을 본 task에서 해소). 해당 커밋(d411bed)의 store/seed/CONTEXT 상태를 base로 함.
- 외부 API: 없음 (인메모리 store + Route Handler).
- 데이터 마이그레이션: 없음 (시드 명시값 보존, 런타임 재계산만 정합화).
- 빌드/런타임: Next.js 16.2.6 (Turbopack), pnpm, vitest.

## 9. 리스크

- (R1) 연장 산정 기준 변경이 `updateStatus`/`upsertTodayClock`의 기존 동작을 바꿔 회귀 유발 → 완화: 신규 함수 추가 후 호출부만 교체, 시드 명시값은 보존, 기존 75 테스트 GREEN을 AC-12로 강제. 의도적 단정값 변경이 필요하면 해당 테스트만 갱신하고 리뷰에 명시.
- (R2) 수락 멱등성 미정의 시 중복 반영으로 work/overtime 이중 계산 → 완화: E-2 정책(이미 수락 요청 거부/no-op)을 AC/테스트로 박음. store가 status `대기`만 처리.
- (R3) 월 이동을 위해 `/attendance` RSC→client 전환 시 헤더/다운로드 아이콘 등 기존 셸 회귀 → 완화: 경계 분리는 architect가 결정, AC-12 라우트 정상 렌더로 검증.
- (R4) seed 불변식②(연장 6회/544분) 런타임 위반(T3 P1 원인) → 완화: AC-5/E-5로 정시퇴근 연장 0 강제, 5/28 재계산 시 overtime 0 유지를 단위 테스트로 고정.

## 10. Repository Artifacts 갱신 대상

| 종류 | 대상 파일 | 갱신 사유 |
|---|---|---|
| 도메인 용어 | `CONTEXT.md` (기존) | "근무기록 수정요청" 행에 status 전이 = `대기 → 수락` **수락 시 레코드 반영(after 적용 + 재계산)** 의미 명문화. "연장근무"/"실근무 인정" 행을 **연장 = 정시 퇴근(정규 종료시각 15:00) 초과분 = `max(0, clockOut − 900)`, workMinutes 기준 아님**으로 정밀화(기존 단순 `workMinutes−390` 표현 교정). |
| 결정 사유 (ADR) | `docs/adr/0001-overtime-by-clockout.md` (신규) | 결정 2건 ≥ 2 → ADR 1개 작성: ①연장 산정 기준을 workMinutes 초과분이 아닌 clockOut의 정규 종료시각 초과분으로 변경(조기출근 연장 오산정 해소, 기존 `calcOvertime` 시그니처 보존 위해 신규 함수 추가)한 사유, ②수락 멱등성 정책(대기만 처리·재수락 거부/no-op) 선택 사유. |
| 운영 메타 | `.task-orchestrator.yml` | 해당 없음 (protected_files·검증강도 오버라이드 변경 없음). |

## 11. Unresolved Questions

- (Q1) E-3: 수락 대상 요청의 date에 기존 레코드가 없을 때 — 신규 레코드 생성(upsert) vs 404. 현재 시드 흐름상 요청은 레코드 존재일에 생성되므로 실제 발생 가능성 낮음. **권장: 404(레코드 없음)**, architect/reviewer 확인.
- (Q2) E-2 재수락 — 409 거부 vs 200 no-op. **권장: 멱등 no-op(200, status 유지·레코드 불변)** 또는 409. 둘 중 택1을 승인 게이트에서 확정.
- (Q3) 수락 API 응답 형태 — 갱신 레코드만 vs `{ record, request }`. UI가 목록·상세를 모두 reload하므로 레코드만으로 충분하나, architect가 reload 호출 수 최소화 위해 결합 응답을 택할 수 있음.
- (Q4) 월 이동 UI 형태 — `MonthSelector`(▾ 드롭다운 표기)에 좌우 화살표를 붙일지, 별도 prev/next 버튼을 둘지. 디자인 IMG 참조(architect/디자인 확정). 기능 요구는 "이전/다음 1칸 이동 + 라벨 갱신"으로 충족.

---

### §1.5 sub-task 분해 (vertical slice, 4개)

| # | sub-task | 범위(슬라이스) | 대표 AC | 사용 가능한 자원 |
|---|---|---|---|---|
| ST-1 | 연장 정합 함수 + 상수 (lib) | `time.ts` `calcOvertimeByClock`(또는 시그니처 확장) + `constants.ts` `REGULAR_END_MINUTES`. 순수 단위 테스트(정시/조기/연장 경계) | AC-5,6,7 / E-5,6,7 | `time.ts`, `constants.ts`, CONTEXT §실근무 인정 |
| ST-2 | `approveRequest` store + 재계산 정합 | `store.ts` `approveRequest(id)`: after 반영 + work/overtime 재계산(ST-1 사용) + status 전이. 결근/휴가 정책 일관. 단위 테스트 | AC-1,2,3,4 / E-1,2,3,4 | `store.ts`(`updateStatus` 패턴), ST-1, CONTEXT 차감 정책 |
| ST-3 | 수락 API + hook mutate + UI 버튼 (vertical) | `POST /api/attendance/requests/approve` route + `useEditRequests.approve` + `EditRequestList` 대기 요청 "수락" 버튼 + `AttendanceDetail` reload 연결. 통합 테스트 | AC-8,9 / E-1,2 | route/requests 패턴, `useAttendance.ts`, `EditRequestList.tsx`, `AttendanceDetail.tsx` |
| ST-4 | 달력 월 이동 (vertical) | `/attendance` month 상태화(경계 분리 architect) + 이전/다음 이동 + 라벨 갱신 + 빈 달 graceful. 통합/렌더 테스트 | AC-10,11 / E-9,10 | `useMonthAttendance`, `buildMonthGrid`, `formatMonthLabel`, `MonthSelector`, `MonthlyCalendar` |
| ST-회귀 | 회귀·DoD 게이트 | 기존 75 테스트 GREEN, 라우트 정상, 의도적 단정값 갱신 명시 | AC-12 | `pnpm test`/`tsc`/`build`/`lint` |

### Definition of Done (DoD)
- `pnpm test` GREEN — 기존 75 + 신규 테스트(ST-1 연장 경계, ST-2 approveRequest after반영·재계산·status전이, ST-3 API 통합·없는/이미 수락 id, ST-4 월 이동·빈 달) 모두 통과. 회귀 0(연장 정합으로 불가피한 단정값 갱신은 리뷰에 명시).
- `tsc --noEmit` exit 0.
- `pnpm build` (next build) Compiled successfully.
- `pnpm lint` exit 0.
- 라우트 수동/빌드 확인: `/`, `/attendance`, `/attendance/[date]`, `/pay`, `/pay/[date]`, `/mypage`, `/mypage/profile` 정상 렌더.
- CONTEXT.md(수정요청 수락 + 연장 정의) 동일 커밋 내 갱신, ADR 0001 작성.
