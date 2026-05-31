# 03-architecture — 아키텍처 설계서

- **작성**: task-architect
- **대상 PRD**: `01-prd.md` (v1, APPROVED)
- **승인 결정**: `02-approval.md` (Q1=upsert / Q2=멱등 no-op / Q3=`{request,record}` / Q4=화살표)
- **detected_stack**: `react-nextjs` (Next.js 16.2.6, App Router, Turbopack, RSC + client fetch + 인메모리 store)
- **primary_pattern**: feature-based (`src/features/<feature>/{components,hooks,domain.ts}`), 도메인 계약 단일 출처 `src/types/index.ts`, 순수 계산 `src/lib/*.ts`(부수효과 0·store 비의존), 인메모리 store + Route Handler
- **최우선 원칙**: 기존 75 테스트 회귀 0, 기존 export append-only(시그니처 파괴 금지)

---

## §1. 변경 범위 & 모듈 경계

### 1.1 신규/수정 파일 (단일 책임 + append-only 표기)

| # | 파일 | 종류 | 단일 책임 | append-only |
|---|---|---|---|---|
| F1 | `src/lib/constants.ts` | 수정(append) | `REGULAR_END_MINUTES = 900`(15:00 정규 종료시각) 상수 추가 | ✅ 기존 export 불변 |
| F2 | `src/lib/time.ts` | 수정(append) | 신규 순수 함수 `calcOvertimeByClock({clockOut})` 추가. 기존 `calcOvertime(workMinutes)` **시그니처/구현 보존** | ✅ 신규 함수만 추가 |
| F3 | `src/lib/store.ts` | 수정(append + 호출부 교체) | 신규 `approveRequest(id)` + 내부 헬퍼 `recalcClockFields(rec)`. 기존 `updateStatus`/`upsertTodayClock`의 연장 산정 호출부를 `calcOvertime(work)` → `calcOvertimeByClock({clockOut})`로 교체 | ✅ export 시그니처 불변, 내부 계산만 교체 |
| F4 | `src/app/api/attendance/requests/approve/route.ts` | 신규 | `POST` Route Handler — body `{id}` 검증 → `approveRequest` → 200 `{request,record}` / 404 / (멱등 200) | 신규 폴더 |
| F5 | `src/app/api/attendance/requests/approve/route.test.ts` | 신규 | AC-8 통합 테스트(유효/없는 id/이미 수락 멱등) | 신규 |
| F6 | `src/features/attendance/hooks/useAttendance.ts` | 수정(append) | `useEditRequests`에 `approve(id): Promise<boolean>` mutate 추가(POST 후 reload) | ✅ 기존 반환객체에 키 추가 |
| F7 | `src/features/attendance/components/EditRequestList.tsx` | 수정 | presentational 유지 + `대기` 요청에 한해 "수락" 버튼 렌더(콜백 `onApprove?` prop 위임). `수락`엔 버튼 없음(AC-9) | prop 추가(optional) |
| F8 | `src/features/attendance/components/AttendanceDetail.tsx` | 수정 | `useEditRequests().approve` 연결 → `EditRequestList`에 `onApprove` 전달 + 수락 후 상세 record reload | 콜백 배선만 |
| F9 | `src/app/attendance/page.tsx` | 수정 | RSC 셸 유지, 신규 client 래퍼(F10)로 month 상태 위임. `SEED_MONTH` 고정 제거 | 구조 변경(아래 §4.1 근거) |
| F10 | `src/features/attendance/components/AttendanceCalendarView.tsx` | 신규(client) | month `useState` 보유 + 이전/다음 화살표 + 월 라벨 + 매장명 + `MonthlyCalendar` 래핑 | 신규 client 경계 |
| F11 | `src/lib/date.ts` | 수정(append) | 월 ±1 산술 `shiftMonth(month, delta)`(연도 경계 처리) 추가 | ✅ 신규 함수만 추가 |
| F12 | `src/lib/time.test.ts` | 수정(append) | `calcOvertimeByClock` 경계 테스트(AC-5/6/7, E-5/6/7) 추가 | ✅ 기존 테스트 보존 |
| F13 | `src/lib/store.test.ts` | 수정(append) | `approveRequest` 테스트(AC-1~4, E-1~4) 추가 | ✅ 기존 보존 |
| F14 | `src/lib/date.test.ts` | 수정(append) | `shiftMonth` 연/월 경계 테스트(E-10) 추가 | ✅ |
| F15 | `CONTEXT.md` | 수정 | 연장 정의 정밀화 + 수정요청 수락 의미 명문화(Repo Artifacts) | 문서 |
| F16 | `docs/adr/0001-overtime-by-clockout.md` | 신규 | 결정 2건 ADR | 문서 |

> `MonthSelector.tsx`는 **변경하지 않는다**(현재 표기는 `▾` 드롭다운 의미. Q4 화살표 UI는 신규 래퍼 F10에서 자체 구현). PRD §3 "MonthSelector 재사용"은 선택지였으나, 화살표(‹ ›)는 드롭다운 표기와 의미가 달라 MonthSelector 시그니처를 건드리지 않고 F10에서 직접 화살표 버튼을 렌더한다 → append-only 보존.

### 1.2 모듈 의존성 방향 (단방향 강제)

```
types/index.ts (leaf, 의존 0)
        ▲
        │
lib/constants.ts ── lib/time.ts ── lib/date.ts        (순수, store 비의존)
        ▲                ▲              ▲
        └──────┬─────────┘              │
               │                        │
          lib/store.ts (server-only, 순수 lib 의존)
               ▲
               │
   app/api/**/route.ts (Route Handler, store 경유)
               ▲
               │ (HTTP fetch, no-store)
   features/attendance/hooks/useAttendance.ts (client)
               ▲
               │
   features/attendance/components/** (client) ── app/attendance/page.tsx (RSC 셸)
```

- 의존은 항상 아래(leaf)→위 단방향. `lib/*`는 store/React를 절대 import하지 않는다(순수성 보존).
- client는 store를 직접 import 금지 — 반드시 Route Handler 경유(기존 규약 유지).

### 1.3 AC ↔ 모듈 매핑

| AC | 모듈 |
|---|---|
| AC-1 레코드 after 반영 | F3 `approveRequest` |
| AC-2 status 대기→수락 | F3 `approveRequest` |
| AC-3 work/overtime 재계산 | F3 `recalcClockFields` + F2 `calcOvertimeByClock` |
| AC-4 결근/휴가 정책 일관 | F3 `approveRequest`(updateStatus 분기 준용) |
| AC-5/6/7 연장 정합 | F2 `calcOvertimeByClock` + F1 `REGULAR_END_MINUTES` |
| AC-8 수락 API 계약 | F4 route + F3 store |
| AC-9 수락 버튼 UI | F7 `EditRequestList` + F8 `AttendanceDetail` + F6 hook |
| AC-10 월 이동 | F9 page + F10 래퍼 + F11 `shiftMonth` |
| AC-11 빈 달 graceful | F10 + 기존 `buildMonthGrid`(임의 월 지원) + `getMonthRecords` 빈 `[]` |
| AC-12 회귀 0 | 전체 append-only 설계 |

### 1.4 프로젝트 구조 준수

- 신규 순수 함수는 `src/lib/*`(F2/F11), 신규 도메인 헬퍼는 store 내부(F3) — 패턴 일치.
- 신규 client 경계 컴포넌트 F10은 `src/features/attendance/components/` 배치 — feature 폴더 role 준수.
- 신규 API는 `src/app/api/attendance/requests/approve/` — 기존 `requests/` 하위 nest, route 패턴 일치.
- `confidence: medium` 이하 모호 폴더 없음(전부 기존 확정 폴더 내 배치).

---

## §2. 데이터 흐름 & 계약

### 2.1 수락 흐름 (props/state)

```
[EditRequestList] 대기 요청 "수락" 버튼 클릭
   └─ onApprove(req.id) 콜백
        └─ [AttendanceDetail] approve(id)  (useEditRequests)
             └─ POST /api/attendance/requests/approve  body {id}
                  └─ approveRequest(id) → {request, record}
             ├─ 성공 시 useEditRequests.reload()  (목록 배지 갱신)
             └─ useDayAttendance.reload()          (출/퇴근 Row after 반영)
```

- `EditRequestList`는 presentational 유지(상태 0). `onApprove?: (id:string)=>void` optional prop만 추가.
- `AttendanceDetail`이 `approve` + 두 reload(`useDayAttendance.reload`, `useEditRequests` 내부 reload)를 오케스트레이션. 응답이 `{request,record}` 결합형이므로 추가 GET 없이도 즉시 반영 가능하나, 기존 reload 패턴(no-store 재조회)을 재사용해 진실원(store) 일치 보장.

### 2.2 API 계약 (AC와 1:1, 타입)

신규 타입 추가 — `src/types/index.ts`에 응답 결합형 추가(append, leaf 보존):

```typescript
// 신규 (append) — 수락 API 응답 결합형
export interface ApproveResult {
  request: EditRequest;       // status "수락"으로 전이된 요청
  record: AttendanceRecord;   // after 반영 + 재계산된 레코드
}
```

```typescript
// 신규 store API (append-only)
export function approveRequest(id: string): ApproveResult | null;
// → 요청 없음: null (route가 404)
// → 이미 "수락": 멱등 no-op, 현재 {request, record} 반환(Q2)
// → "대기": after 반영(upsert) + 재계산 + status 대기→수락 → {request, record}

// 신규 time 순수 함수 (append-only)
export function calcOvertimeByClock(i: { clockOut: string | null }): number;
// → clockOut === null → 0
// → max(0, parseHHMM(clockOut) − REGULAR_END_MINUTES); NaN → 0

// 신규 date 순수 함수 (append-only)
export function shiftMonth(month: string, delta: number): string;
// → "2026-12" +1 → "2027-01"; "2026-01" -1 → "2025-12"

// 신규 hook mutate (append-only) — useEditRequests
approve: (id: string) => Promise<boolean>;  // POST 후 reload, ok 반환
```

HTTP 계약 (AC-8 / E-1 / E-2):

```json
// POST /api/attendance/requests/approve
// Request
{ "id": "req-1" }

// 200 OK — 유효 대기 요청 수락 후 (또는 이미 수락 멱등 no-op, Q2)
{
  "request": { "id": "req-1", "date": "2026-05-04", "status": "수락",
               "before": { "...": "..." }, "after": { "...": "..." },
               "reason": "...", "createdAt": "..." },
  "record":  { "date": "2026-05-04", "status": "연장",
               "clockIn": "07:26", "clockOut": "15:34",
               "breakMinutes": 30, "workMinutes": 458,
               "overtimeMinutes": 34, "deductMinutes": 0 }
}

// 400 — id 누락
{ "error": "id 가 필요합니다." }

// 404 — 존재하지 않는 id (E-1)
{ "error": "존재하지 않는 요청입니다." }
```

- E-2(재수락): Q2 결정에 따라 **200 멱등 no-op**. store가 status `수락`을 감지하면 레코드를 재반영하지 않고 현 `{request,record}`만 반환(work/overtime 이중계산 방지, R2 완화). 409 미채택.
- E-3(레코드 없는 날): Q1 결정에 따라 **upsert**. store가 after로 신규 레코드 생성. 404 아님.

### 2.3 RSC vs Client Component 결정 (Next.js)

| 영역 | 경계 | 사유 |
|---|---|---|
| `app/attendance/page.tsx` | **RSC 유지** | 정적 셸(AppHeader 다운로드 아이콘 등). 회귀 최소화(R3). |
| `AttendanceCalendarView` (F10) | **신규 client** (`"use client"`) | month `useState` + 화살표 핸들러 보유. 헤더/매장명/캘린더를 month에 동기화. |
| `MonthlyCalendar` | client 유지 | 기존대로 `month` prop 받아 `useMonthAttendance` 호출. |

근거: page를 통째로 client 전환하면 RSC 셸(다운로드 아이콘 등) 회귀 위험(R3). month 상태는 **캘린더 영역에만** 필요하므로 client 경계를 F10으로 좁힌다 → RSC 셸 보존 + 상태 지역화. AppHeader title도 F10이 month 라벨로 렌더(헤더 동기화 AC-10).

### 2.4 경계면 일치 검증 (Frontend ↔ API ↔ store)

- `approve(id)` body `{id}` ↔ route body `{id}` ↔ `approveRequest(id: string)` — 일치.
- 응답 `{request, record}` ↔ `ApproveResult` ↔ `EditRequest`/`AttendanceRecord`(기존 타입 불변) — 일치.
- 월 GET `?month=` ↔ 기존 `GET /api/attendance` `getMonthRecords(month)` — 기존 계약 재사용(변경 0).

---

## §3. 알고리즘 & 클린코드 사전 점검

### 3.1 `calcOvertimeByClock` (F2, 순수, O(1))

```
function calcOvertimeByClock({ clockOut }):
    if clockOut is null: return 0
    end = parseHHMM(clockOut)            # O(1) 정규식 1회
    if isNaN(end): return 0              # 형식 불량 방어(E-8)
    return max(0, end - REGULAR_END_MINUTES)   # REGULAR_END_MINUTES = 900
```

- 시간복잡도 **O(1)** — 분기/산술만, 반복 없음. clockIn에 무관(AC-7 핵심: 연장은 퇴근시각만 의존).
- 경계 검증:
  - 07:58~15:00 → clockOut=15:00=900 → max(0,900−900)=**0** (AC-5, work는 392여도 연장 아님) ✓
  - 08:00~16:30 → 990−900=**90** (AC-6) ✓
  - 07:26~15:00 → 900−900=**0**; 15:34 → 934−900=**34** (AC-7) ✓
  - 17:00 → 1020−900=**120** (E-7) ✓; 15:00 정시 → **0** (E-5) ✓; 조기출근 clockOut≤900 → **0** (E-6) ✓

### 3.2 `recalcClockFields` 헬퍼 + `approveRequest` (F3, DRY 공통화)

기존 `updateStatus`/`upsertTodayClock`의 "clock 양쪽 존재 → break 복원 → work/overtime 재계산" 로직이 3곳에 중복될 위험 → 내부 헬퍼로 공통화(DRY + 일관성):

```
# store 내부 private 헬퍼 — clock 기반 정상/연장 재계산(휴게 복원 포함)
function recalcClockFields(rec): AttendanceRecord
    if rec.clockIn and rec.clockOut:
        break = rec.breakMinutes == 0 ? DEFAULT_BREAK_MINUTES : rec.breakMinutes
        work  = calcWorkMinutes({clockIn, clockOut, break})          # O(1)
        return { ...rec, breakMinutes: break, workMinutes: work,
                 overtimeMinutes: calcOvertimeByClock({clockOut}) }   # ← 정합 함수
    else:
        return { ...rec, workMinutes: 0, overtimeMinutes: 0 }   # 한쪽 null(E-4)
```

`updateStatus`의 정상/연장 분기(현재 line 104~121)와 `upsertTodayClock`(line 165~172)이 이 헬퍼의 work/overtime 계산을 호출하도록 교체 → 연장 산정이 단일 경로로 수렴(R1/R4 완화). `deductMinutes` 처리(지각 보존/해소)는 status별 정책이라 각 호출부에 유지.

```
function approveRequest(id): ApproveResult | null
    req = store.requests.find(r => r.id == id)        # O(n), n=요청 수(소규모)
    if not req: return null                            # E-1 → 404
    record_after_lookup:
    if req.status == "수락":                            # Q2 멱등 no-op
        rec = store.records.get(req.date) ?? <after로 구성된 미저장 뷰>
        return { request: req, record: rec }           # 레코드 불변

    after = req.after
    # Q1 upsert: 레코드 없으면 after 기반 신규 생성
    base = store.records.get(req.date) ?? newRecord(req.date, DEFAULT_BREAK_MINUTES)
    merged = { ...base, status: after.status,
               clockIn: after.clockIn, clockOut: after.clockOut }

    # status별 정합 재계산 — updateStatus와 동일 정책(AC-4)
    if after.status == "결근":
        rec = { ...merged, workMinutes:0, overtimeMinutes:0,
                deductMinutes: REGULAR_MINUTES, breakMinutes:0 }
    elif after.status == "휴가":
        rec = { ...merged, workMinutes:0, overtimeMinutes:0,
                deductMinutes:0, breakMinutes:0 }
    else:  # 정상/연장/지각
        rec = recalcClockFields(merged)                # 공통 헬퍼 (DRY)
        rec.deductMinutes = (after.status == "지각") ? base.deductMinutes : 0
    store.records.set(req.date, rec)                   # O(1)
    req.status = "수락"                                 # 대기→수락 (AC-2)
    return { request: req, record: rec }
```

- 전체 시간복잡도 **O(n)** (요청 조회 1회 선형 탐색). n = 누적 요청 수로 소규모(데모). 정당화: store는 인메모리·요청 수십 건 수준, Map 인덱싱 도입은 과설계. 재계산은 O(1).
- 중첩 깊이 ≤ 3, 함수 길이 ≤ 50줄 가이드 충족(approveRequest는 상태 분기 1단). 변수명/추가 분리는 developer 재량.

### 3.3 seed 불변식 보존 증명 (R4)

- `buildSeedRecords()`(seed.ts:94~105)는 `SEED_ROWS`의 **리터럴 `overtimeMinutes`를 그대로 매핑**한다 — `calcOvertime`/`calcOvertimeByClock`을 **호출하지 않는다**. 따라서 연장 산정 함수 변경은 seed 빌드 결과에 **영향 없음**.
- 불변식 ②(연장 6회/544분 = 34+90+90+80+130+120)는 5/04(07:26~15:00, 리터럴 34)를 포함. 신규 calc로는 5/04가 0이 될 것이나, **seed는 재계산 경로를 타지 않으므로 리터럴 34 유지** → 불변식 ② 보존. ✓
- 5/28(07:58~15:00, 리터럴 0)은 어떤 경로로 재계산되어도 `calcOvertimeByClock({clockOut:"15:00"})=0` → 불변식 보존(메트릭 "오산정 0건" 달성). ✓
- seed에 대해 `updateStatus`/`approveRequest`가 boot 시 호출되지 않음(store 생성은 `createStore`가 리터럴 set만 수행, store.ts:30~40) → 런타임 재계산 없음. ✓

### 3.4 기존 호출부 교체 영향 분석 (회귀)

- `time.test.ts:67` `calcOvertime(work)===120` — **기존 함수 보존**(F2 append-only)이라 GREEN. ✓
- `store.test.ts:70-71` 휴가→정상 `08:00~17:00 → overtime 120` — 신규 `calcOvertimeByClock({clockOut:"17:00"})=1020−900=120` → 동일 결과 GREEN. ✓
- `store.test.ts:122` 휴가→정상 `08:00~15:00 → overtime 0` — `calcOvertimeByClock({clockOut:"15:00"})=0` → 기존 `calcOvertime(390)=0`과 동일 GREEN. ✓
- 결근/휴가/지각 분기는 work/overtime를 0 또는 보존 처리 → 연장 함수 무관, 영향 없음. ✓
- **잠재 위험**: `upsertTodayClock`/`updateStatus`에서 clockOut이 정규 미달이지만 workMinutes가 정규 초과인 케이스(조기출근). 신규 함수가 이를 0으로 정정(의도된 G2). 기존 store 테스트에 해당 단정 없음 → 회귀 0. 신규 단정은 F12/F13에서 추가. AC-12 의도적 갱신 대상 **없음**(기존 단정값 전부 보존).

---

## §4. 렌더링 & 성능 정책 (react-nextjs)

### 4.1 월 상태 경계 & 렌더 정책

- **client 경계**: F10 `AttendanceCalendarView`(`"use client"`)가 `useState<string>(SEED_MONTH)` 보유. page(RSC)는 셸만 렌더 → RSC/CSR 분리로 셸 회귀 방지(R3).
- **fetch 캐시**: month 변경 시 `useMonthAttendance(month)` effect 의존성 `[month]`로 재fetch. 기존 `cache: "no-store"`(NO_STORE) 유지 — 인메모리 진실원 일치(CONTEXT 운영메모). 수락/PATCH도 no-store reload 패턴 유지.
- **effect 의존성**: `useMonthAttendance` effect `[month]`만(기존 설계 §4.1 주석 유지). `approve`는 mutate 후 명시 reload, effect 추가 없음.
- **메모이제이션**: `MonthlyCalendar`의 `byDate`/`cells` `useMemo([records])`/`[month]` 기존 유지. 화살표 클릭 → month 변경 → cells 재계산은 O(셀 수)=O(42)로 미미. 추가 메모 불요.
- **suspense/dynamic**: 미사용(client fetch 패턴 유지). SSG/ISR/revalidate 무관(전 라우트 동적 인메모리).

### 4.2 화살표 UI (Q4)

- F10이 `‹ {formatMonthLabel(month)} ›` 형태로 양옆 화살표 버튼 렌더. 클릭 → `setMonth(shiftMonth(month, ±1))`.
- AppHeader title을 month 라벨과 동기화(AC-10 헤더 갱신). `MonthSelector`(▾)는 미사용/미변경.

### 4.3 빈 달 graceful & 회귀 (AC-11/AC-12)

- `shiftMonth`로 산출된 임의 월 → `buildMonthGrid(month)`가 이미 임의 월 그리드 생성(date.ts:56) + `getMonthRecords`가 빈 `[]` 반환 → 빈 셀만 렌더, 크래시 없음(E-9). 주휴 블루행은 `buildPayItems`가 월 격리(pay 페이지 무관, 본 task 범위 밖).
- 월 경계: `shiftMonth("2026-12",1)="2027-01"`, `shiftMonth("2026-01",-1)="2025-12"`(E-10) — `Date(y, m-1+delta, 1)` 산술로 연도 자동 보정.
- 회귀: 다른 라우트(`/`,`/pay`,`/mypage`)는 본 변경과 파일 비중첩 → 영향 0. AC-12 `pnpm test`/build로 강제.

---

## 자체 체크리스트 결과

- §1 모듈 경계 분리됨: ✅ (단방향 의존, 신규 client 경계 F10 좁힘)
- §2 경계면 타입 일치: ✅ (`{id}` / `ApproveResult` / 기존 타입 불변)
- §3 시간복잡도 명시: ✅ (`calcOvertimeByClock` O(1), `approveRequest` O(n))
- §4 렌더링 정책 명시: ✅ (RSC/client 경계, no-store, effect `[month]`)

### 추가 task 체크리스트
- [✅] 회귀 0 — §3.4 호출부 교체 영향 분석(기존 단정값 전부 보존)
- [✅] append-only — `calcOvertime` 시그니처 보존(F2), 전 export 보존
- [✅] 연장 정합 정확 — §3.1 경계 6케이스 검증(AC-5/6/7, E-5/6/7)
- [✅] 재계산 DRY — §3.2 `recalcClockFields` 공통 헬퍼로 3경로 수렴
- [✅] approve 멱등/upsert — §2.2 Q2 no-op / Q1 upsert 반영
- [✅] 월 경계 — §4.3 `shiftMonth` 연/월 경계(E-10)

---

## 📊 정규식 자가 검증 결과

- §1 파일 경로 패턴 (`*.ts/tsx`): ✅ 16개 이상 매치 (constants.ts, time.ts, store.ts, route.ts, useAttendance.ts, AttendanceCalendarView.tsx 등)
- §2 타입/계약 코드 블록 (` ```typescript ` / ` ```json `): ✅ 2개 매치
- §3 시간복잡도 `O(...)`: ✅ 5개 매치 (O(1) ×3, O(n) ×1, O(42))
- §4 렌더링 키워드 (react-nextjs: RSC/CSR/no-store/cache/suspense/use client/revalidate): ✅ 7개 이상 매치

---

## developer 인계 요약

1. **회귀 0 (최우선)**: `calcOvertime(workMinutes)`는 **건드리지 말 것**(append-only). 신규 `calcOvertimeByClock({clockOut})`를 추가하고 `updateStatus`/`upsertTodayClock`/`approveRequest`의 연장 산정 호출부만 교체. `store.test.ts:70-71`(17:00→120), `:122`(15:00→0)은 신규 함수로도 동일 통과하므로 기존 75 단정값 갱신 불필요.
2. **연장 정합**: 연장 = `max(0, parseHHMM(clockOut) − 900)`, clockIn 무관. clockOut=null/NaN→0. 경계 6케이스(§3.1)를 `time.test.ts`에 추가.
3. **재계산 DRY**: store 내부 `recalcClockFields(rec)` private 헬퍼로 "break 복원 + calcWorkMinutes + calcOvertimeByClock"을 단일화. updateStatus 정상/연장 분기와 approveRequest가 공유. deduct(지각 보존/해소) 정책은 각 호출부 유지.
4. **approveRequest**: Q1 upsert(레코드 없으면 after로 신규 생성), Q2 멱등 no-op(이미 수락이면 레코드 불변 + 현 `{request,record}` 반환), status 대기→수락, 결근/휴가는 updateStatus와 동일 정책. 응답은 `{request, record}`(신규 타입 `ApproveResult`).
5. **월 이동**: page는 RSC 유지, 신규 client 래퍼 `AttendanceCalendarView`가 month `useState` + 화살표(‹ ›) 보유. `shiftMonth(month, ±1)`(date.ts append, 연도 경계 처리) 사용. MonthSelector(▾)는 미변경. 빈 달은 기존 buildMonthGrid/getMonthRecords가 graceful 처리.

