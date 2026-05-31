# 🏛 아키텍처 설계서 (v1) — Crewmon 출퇴근·급여 웹앱

- **작성자**: task-architect
- **작성일**: 2026-05-31
- **운영 모드**: teammate (Notion 미사용, 로컬 markdown 산출물)
- **레포**: `/Users/goyoung/workspace/Study/ttok`
- **detected_stack**: `react-nextjs` (Next 16.2.6 App Router / React 19.2.4 / Tailwind v4 / TS5)
- **입력**: `01-prd.md` (승인), `02-approval.md` §0 최종 사용자 결정 (쟁점 A/B/C)
- **구조 강제 기준**: `.task-orchestrator.yml` → `primary_pattern: feature-based` (+ nextjs-app-router), `user_confirmed: true`
- **범위**: 코드 미작성. 설계 결정만 기록. 변수명·함수 내부 분리 디테일은 developer 재량.

## 📌 승인 §0 결정 반영 요약 (architect 강제 준수)

| 쟁점 | 결정 | 본 설계 반영 위치 |
|---|---|---|
| **A** 캘린더 배지 | 부족(−)/초과(+) 분 표기, **`+0분` 숨김** | §1 `CalendarCell`, §3 `formatBadge()`, §4 /attendance |
| **B** 주휴수당 | **시드 고정값**(67,080원), 산식 미구현, summary=items 합계 일치 | §2 `PaySummary`/`PayItem(kind:"weekly_holiday")`, §3 시드 테이블 |
| **C** 토글 시각 | **현재 시각 기록**(`new Date()`) | §2 토글 mutation 흐름, §3 시각 계산 일관성, §4 / 라우트 |

---

## §1. 변경 범위 & 모듈 경계

### 1.1 feature-based 디렉토리 책임 & 경계 (강제 기준 = `.task-orchestrator.yml.folders`)

| 디렉토리 | 책임 (single responsibility) | 의존 허용 방향 | RSC/Client |
|---|---|---|---|
| `src/app/` | 라우팅 + 페이지 셸(RSC 기본) + Route Handler(api) | → features, lib, types, components | 페이지=RSC, api=server runtime |
| `src/features/attendance/` | 출퇴근 도메인 UI + client 훅 + 도메인 한정 타입 | → lib, types, components | client 컴포넌트 위주 |
| `src/features/pay/` | 급여 도메인 UI + client 훅 + 도메인 한정 타입 | → lib, types, components | client 컴포넌트 위주 |
| `src/components/` | **도메인 비의존** 공용 UI (BottomNav/Card/BottomSheet/StatusBadge/ProgressBar/MonthSelector/AppHeader) | → types(표현 props 한정), lib/constants | 인터랙션 있는 것만 client |
| `src/lib/` | 인메모리 store + 순수 계산 util(time/pay) + 시드 + 상수 | → types 만 | server-only (store/seed), 순수함수는 isomorphic |
| `src/types/` | 공용 도메인 타입 정의(계약의 단일 출처) | (의존 없음 — leaf) | type-only |

**의존성 방향 (단방향 강제)**: `app → features → components → lib → types`. 역방향·순환 금지.
- `src/components/`는 **도메인을 모른다**: `AttendanceRecord` 같은 도메인 타입을 import하지 않고 표현용 원시 props(`label: string`, `value: number`, `tone: 'coral'|'green'|'blue'|'gray'`)만 받는다. (features가 도메인→표현 매핑 책임)
- `src/lib/store.ts`, `seed.ts`는 **서버 전용**(모듈 싱글톤). client 컴포넌트가 직접 import 금지 → 반드시 Route Handler API 경유. (Next 빌드에서 server-only 경계 보호)
- `src/lib/time.ts`, `pay.ts`는 **순수 함수**(부수효과 0, store 비의존) → Vitest에서 독립 import 가능, RSC/Route Handler 양쪽에서 재사용.

### 1.2 RSC vs Client Component 경계 (명시)

| 단위 | 종류 | 근거 |
|---|---|---|
| `src/app/layout.tsx` | **RSC** | 정적 셸. BottomNav만 client로 분리 |
| `src/app/page.tsx` (홈) | **RSC 셸 + client 섬** | 헤더/공지 카드는 RSC, 출퇴근 토글+진행바는 `ClockToggle`(client, 'use client') |
| `src/app/attendance/page.tsx` | **RSC 셸 + client 캘린더** | `MonthlyCalendar`(client, fetch+탭 상태) |
| `src/app/attendance/[date]/page.tsx` | **RSC 셸 + client 상세** | 바텀시트/textarea/PATCH·POST → `AttendanceDetail`(client) |
| `src/app/pay/page.tsx` | **RSC 셸 + client 리스트** | `PaySummaryCard`+`PayList`(client, fetch+월 선택) |
| `src/app/pay/[date]/page.tsx` | **RSC 셸 + client 상세** | `PayDetail`(client, fetch) |
| `src/app/api/**/route.ts` | **server runtime** | store 접근, JSON 응답 |
| `src/components/BottomNav.tsx` | **client** | `usePathname()` 활성탭 하이라이트 |
| `src/components/BottomSheet.tsx` | **client** | open/close 상태·포커스·바디 스크롤 락 |
| `src/components/{Card,StatusBadge,ProgressBar,AppHeader}.tsx` | **RSC 가능(presentational)** | 상호작용 없으면 RSC, props만 |
| `src/components/MonthSelector.tsx` | **client** | 선택 상태·드롭다운 |

> **불변식**: RSC(page.tsx, layout.tsx)는 `useState/useEffect/usePathname` 등 client 훅을 직접 호출하지 않는다. 상호작용은 features의 'use client' 컴포넌트로 위임한다. (체크리스트 ②)

### 1.3 생성 파일 목록 (경로별 한 줄 책임) — PRD §1 배치와 1:1 정합

```
src/app/
  layout.tsx                          # 모바일 세로 셸(max-w-md mx-auto) + globals + 하단 BottomNav 고정
  page.tsx                            # 홈 RSC 셸: AppHeader + StoreInfo + ClockToggle(client) + 안내/공지/바로가기
  globals.css                         # (수정) @theme 코랄 토큰 + 모바일 셸 base
  attendance/page.tsx                 # /attendance RSC 셸 → MonthlyCalendar(client)
  attendance/[date]/page.tsx          # /attendance/[date] RSC 셸 → AttendanceDetail(client). date param 검증→404
  pay/page.tsx                        # /pay RSC 셸 → PaySummaryCard + PayList(client)
  pay/[date]/page.tsx                 # /pay/[date] RSC 셸 → PayDetail(client). date param 검증→404
  api/attendance/route.ts             # GET ?month / PATCH(status) — 월간 조회·상태변경
  api/attendance/[date]/route.ts      # GET 단일일 상세 (없으면 404/빈 상태 일관)
  api/attendance/requests/route.ts    # GET 수정요청 내역 / POST 수정요청 생성
  api/pay/route.ts                    # GET ?month — {summary, items}
  api/pay/[date]/route.ts             # GET 일별 급여 상세
src/features/attendance/
  components/MonthlyCalendar.tsx      # client: 월 그리드 셀(Nh/배지/휴가/상태점) + 날짜 탭
  components/CalendarCell.tsx         # presentational: 셀 1칸 표현(배지 +0분 숨김 규칙 적용)
  components/AttendanceDetail.tsx     # client: 출근/퇴근/휴게 카드 + 상태변경 시트 + 시간변경 + 수정요청
  components/StatusChangeSheet.tsx    # client: BottomSheet 내용(라디오 5종 + 변경 버튼) → PATCH
  components/EditRequestForm.tsx      # client: textarea 0/100 + 수정요청 버튼 → POST
  components/EditRequestList.tsx      # presentational: 요청내역(날짜/시각/대기 배지)
  hooks/useAttendance.ts              # client: month/단일일 fetch + PATCH/POST mutate
  domain.ts                           # 도메인→표현 매핑(상태 색, 배지 라벨) — components로 전달할 표현값 산출
src/features/pay/
  components/PaySummaryCard.tsx       # presentational: 합계/차감440분/연장6회9시간4분
  components/PayList.tsx              # client: 일별 리스트(휴가0원/연장표기/주휴 블루행)
  components/PayDetail.tsx            # client: 시급/급여인정시간/휴게/차감/연장 + 확인 버튼
  hooks/usePay.ts                     # client: month/단일일 급여 fetch
  domain.ts                           # PayItem→표현(블루행 판정, 금액 포맷) 매핑
src/components/
  BottomNav.tsx                       # client: 홈/출퇴근/급여/마이페이지(비활성), 활성 하이라이트
  AppHeader.tsx                       # presentational: 브랜드/날짜/매장명 헤더
  Card.tsx                            # presentational: 라운드 카드 컨테이너
  BottomSheet.tsx                     # client: 모달 시트 셸(open/onClose/children)
  StatusBadge.tsx                     # presentational: 상태/연장/휴가 배지(tone props)
  ProgressBar.tsx                     # presentational: 진행바(percent props)
  MonthSelector.tsx                   # client: '2026년 5월 ▾' 월 선택
src/lib/
  store.ts                            # 인메모리 store(모듈 싱글톤): records Map, requests[]
  seed.ts                             # 2026-05 명시 시드 테이블(§3.3) — 차감440/연장6회9h4m/주휴 고정
  time.ts                            # 순수: parseHHMM/formatHHMM/calcWorkMinutes/calcOvertime
  pay.ts                              # 순수: calcPaidMinutes/calcDailyPay/buildPaySummary
  constants.ts                        # 컬러 토큰 상수, WORK_STATUS enum, 정규근무(REGULAR=390분), 시급 등
src/types/
  index.ts                            # AttendanceRecord/WorkStatus/PayItem/PaySummary/EditRequest 등
```

테스트 파일(developer 배치): `src/lib/time.test.ts`, `src/lib/pay.test.ts`, `src/lib/seed.test.ts`(검산), `src/app/api/**/route.test.ts`(핵심 분기). developer가 사용할 명령: `pnpm add -D vitest @vitest/coverage-v8`, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm lint` (PRD DoD).

### 1.4 AC → 모듈 매핑

| AC | 모듈/파일 |
|---|---|
| AC-1,2,3,5 | `src/lib/time.ts`, `pay.ts` |
| AC-4 (연장 분리) | `src/lib/time.ts` (calcOvertime) |
| AC-6 | `api/attendance/route.ts` (GET) |
| AC-7 | `api/attendance/[date]/route.ts` |
| AC-8 | `api/attendance/route.ts` (PATCH) + `store.ts` |
| AC-9 | `api/attendance/requests/route.ts` |
| AC-10 | `api/pay/route.ts` + `pay.ts buildPaySummary` + `seed.ts` |
| AC-11,12 | `app/page.tsx` + `features/attendance ClockToggle`(홈용)·`StoreInfo`, `components/ProgressBar` |
| AC-13,14 | `features/attendance/MonthlyCalendar,CalendarCell` |
| AC-15 | `features/attendance/StatusChangeSheet` + `components/BottomSheet` |
| AC-16 | `features/attendance/EditRequestForm,EditRequestList` |
| AC-17 | `app/pay/page.tsx` + `features/pay/PaySummaryCard,PayList` + `seed.ts` |
| AC-18 | `app/pay/[date]/page.tsx` + `features/pay/PayDetail` |
| AC-19,20 | `components/BottomNav,Card,BottomSheet`, `globals.css`, `layout.tsx` |

> ⚠️ 패턴 위배 없음: 모든 신규 파일이 `ai_suggested_placements`(feature→`src/features/<name>/`, 공용 UI→`src/components/`, util/store→`src/lib/`, api→`src/app/api/<name>/route.ts`, 타입→`src/types/`)를 정확히 따른다. 모든 폴더 `confidence: high` — 모호 영역 신규 배치 없음. 홈의 출퇴근 토글은 출퇴근 도메인이므로 `features/attendance`에 둔다(app/page.tsx는 RSC 셸로 import만).

---

## §2. 데이터 흐름 & 계약 (contract)

### 2.1 인메모리 store 구조 (모듈 싱글톤, server-only)

```typescript
// src/lib/store.ts (설계 — developer가 구현)
import type { AttendanceRecord, EditRequest } from "@/types";

type StoreShape = {
  records: Map<string, AttendanceRecord>; // key = date "YYYY-MM-DD"
  requests: EditRequest[];
};

// 모듈 싱글톤. globalThis 가드로 Next dev HMR 중복 초기화 방지.
declare global { var __crewmonStore: StoreShape | undefined; }
function getStore(): StoreShape { /* lazy seed() 1회 주입 */ }

// 노출 API (Route Handler에서만 호출)
getMonthRecords(month: string): AttendanceRecord[]
getRecord(date: string): AttendanceRecord | null
updateStatus(date: string, status: WorkStatus): AttendanceRecord | null   // AC-8
upsertTodayClock(field: "clockIn"|"clockOut", time: string): AttendanceRecord // 쟁점 C
listRequests(): EditRequest[]
addRequest(req: NewEditRequest): EditRequest                              // AC-9
```

> 휘발성: 서버 재시작 시 `seed()`로 초기화(엣지#7, 명세 동작). `globalThis` 가드로 dev 핫리로드 시 상태 보존.

### 2.2 도메인 타입 (계약 단일 출처 — `src/types/index.ts`)

```typescript
export type WorkStatus = "정상" | "지각" | "결근" | "휴가" | "연장";

export interface AttendanceRecord {
  date: string;            // "YYYY-MM-DD"
  status: WorkStatus;
  clockIn: string | null;  // "HH:MM" (휴가/결근/미출근 → null)
  clockOut: string | null; // "HH:MM"
  breakMinutes: number;    // 휴게(분), 기본 30
  workMinutes: number;     // = clockOut-clockIn-break (휴가 0)
  overtimeMinutes: number; // 정규(390) 초과분, 없으면 0
  deductMinutes: number;   // 급여차감(지각·결근분), 기본 0
}

export type EditRequestStatus = "대기" | "수락";
export interface EditRequest {
  id: string;
  date: string;            // 대상 근무일
  reason: string;          // 0~100자
  before: { status: WorkStatus; clockIn: string|null; clockOut: string|null };
  after:  { status: WorkStatus; clockIn: string|null; clockOut: string|null };
  status: EditRequestStatus; // 생성 시 "대기"
  createdAt: string;       // ISO
}

export type PayItemKind = "work" | "vacation" | "weekly_holiday"; // 근무/휴가/주휴
export interface PayItem {
  date: string;
  kind: PayItemKind;
  label: string;           // "6시간 30분" | "휴가" | "주휴수당 6시간 30분"
  amount: number;          // 일급(원). 휴가=0
  overtimeMinutes: number; // 연장표기용(없으면 0)
  isWeeklyHoliday: boolean; // true → 블루행 (쟁점 B)
}

export interface PaySummary {
  totalPay: number;        // = Σ items.amount (주휴 포함) — AC-10 검산 불변식
  deductMinutes: number;   // 시드 합산 = 440 (AC-17)
  overtimeCount: number;   // = 6 (AC-17)
  overtimeMinutes: number; // = 544 (= 9시간4분) (AC-17)
}
export interface PayResponse { summary: PaySummary; items: PayItem[]; }
```

### 2.3 API Route 계약 6종 (AC-6~10과 1:1)

```typescript
// 1) GET /api/attendance?month=YYYY-MM            → AC-6
//    200: AttendanceRecord[]   (시드 근무일 월~금 포함, 빈 달 → [])
// 2) PATCH /api/attendance?date=YYYY-MM-DD         → AC-8
//    body: { status: WorkStatus }
//    200: AttendanceRecord(갱신됨)  | 404 if no record
// 3) GET /api/attendance/[date]                    → AC-7
//    200: AttendanceRecord | 404 (또는 빈 상태객체, 일관 1택: 본 설계는 404 채택)
// 4) GET /api/attendance/requests                  → AC-9
//    200: EditRequest[]
//    POST /api/attendance/requests                 → AC-9
//    body: { date, reason, after:{status,clockIn,clockOut} }
//    201: EditRequest(status:"대기")  | 400 if reason 빈문자열(엣지#6)
// 5) GET /api/pay?month=YYYY-MM                     → AC-10
//    200: PayResponse  (summary.totalPay === Σ items.amount 불변식)
// 6) GET /api/pay/[date]                            → AC-18 데이터
//    200: { date, clockIn, clockOut, hourlyWage, paidMinutes, breakMinutes,
//           breakRange, deductMinutes, overtimeMinutes, amount } | 404
```

> route.ts는 `?month` PATCH `?date` 쿼리를 동일 파일에서 메서드 분기(GET/PATCH). PRD §1 `route.ts # GET 월간 / PATCH 상태변경`과 정합. `[date]` 동적 세그먼트는 별도 파일.

### 2.4 클라이언트 데이터 페칭 방식 결정 + 근거

- **결정: client fetch (Route Handler 호출)**. RSC server fetch 미채택.
- **근거**:
  1. 인메모리 store는 **서버 프로세스 메모리**에 있으므로 RSC가 `fetch(self)` 하면 자기 서버를 다시 타는 불필요한 왕복 발생. 직접 store import는 client mutation 흐름(토글/상태변경)과 데이터 출처가 갈려 일관성 깨짐.
  2. 화면 대부분이 **상호작용 후 즉시 재조회**(토글→상태, PATCH→재GET, 월 변경→재fetch)가 필요 → client 훅(`useAttendance`/`usePay`)에서 fetch + mutate가 자연스럽다.
  3. 인메모리 = no-store 이므로 RSC 캐싱 이점이 없음. (§4 캐시 정책 참조)
- **경계**: RSC page.tsx는 정적 셸/레이아웃/헤더만 렌더, 데이터 의존 영역은 client 컴포넌트가 마운트 후 `fetch('/api/...')`. RSC는 client 훅을 호출하지 않는다(체크리스트 ②).

### 2.5 쟁점 C — 오늘 레코드 mutation 흐름 (현재 시각 기록)

```
[홈 ClockToggle(client)]
  미출근 → "출근" 클릭
     → POST/PATCH /api/attendance?date=<today>  body:{ field:"clockIn", time: HH:MM(new Date()) }
     → store.upsertTodayClock("clockIn", now) → workMinutes/overtime 재계산(time.ts)
     → 응답 반영 → "퇴근" 버튼 노출 (상태 "근무중")
  근무중 → "퇴근" 클릭
     → PATCH /api/attendance?date=<today> body:{ field:"clockOut", time: now }
     → 마감 상태 표시
```
- **현재 시각 산출**: client에서 `new Date()` → "HH:MM"로 변환 후 body 전송(서버 TZ 의존 제거). 시각 문자열은 **동일 `time.ts` 계산 함수**(parseHHMM)를 통과 → 시드 과거 데이터와 계산 일관성 유지(승인 §0-C 요구).
- **단위테스트 분리 전략**: 급여/시간 순수함수 테스트(AC-1~5)는 **고정 입력값**(`"08:00"/"15:00"`)으로만 검증하며 `new Date()`를 절대 호출하지 않는다 → 토글의 비결정성과 완전 격리. 토글 경로 테스트는 store/route 레벨에서 "주입된 time 문자열"로 검증(시각 생성은 client 책임이므로 순수함수 테스트 오염 없음). 시드(2026-05) 과거 데이터는 고정 시각 유지(승인 §0-C).

### 2.6 경계면 일치 검증 (Frontend ↔ API ↔ Store)

| 경계 | Frontend 기대 | API 응답 | Store 보유 | 일치 |
|---|---|---|---|---|
| 월간 캘린더 | `AttendanceRecord[]` | GET /api/attendance | records Map values | ✅ 동일 타입 |
| 일자 상세 | `AttendanceRecord` | GET /[date] | records.get | ✅ |
| 상태변경 | 갱신 `AttendanceRecord` | PATCH | updateStatus | ✅ |
| 수정요청 | `EditRequest(대기)` | POST/GET requests | requests[] | ✅ |
| 급여 메인 | `PayResponse` | GET /api/pay | seed+pay.ts 합성 | ✅ totalPay=Σitems 불변식 |
| 급여 상세 | 계산 필드셋 | GET /api/pay/[date] | record+pay.ts | ✅ amount=paidMin×wage 검산 |

> 단일 출처 = `src/types/index.ts`. FE/API/store 모두 이 타입을 import → 경계면 타입 드리프트 0 (체크리스트 ③).

---

## §3. 알고리즘 & 복잡도

### 3.1 `time.ts` / `pay.ts` 순수함수 시그니처 + 의사코드 + 복잡도

```typescript
// ── src/lib/time.ts ──────────────────────────────────────
// 시각문자열 ↔ 분
parseHHMM(t: string): number          // "HH:MM" → 분(0~1439). 형식불량→NaN가드
// 의사: [h,m]=split(":").map(Number); return h*60+m;  복잡도 O(1)
formatHHMM(min: number): string        // 분 → "HH:MM"  복잡도 O(1)

calcWorkMinutes(i: { clockIn:string; clockOut:string; breakMinutes:number }): number
// 의사:
//   start=parseHHMM(in); end=parseHHMM(out);
//   if (isNaN||end<=start) return 0;           // 엣지#4 자정역전/역전 방어
//   return max(0, end - start - breakMinutes);   // 음수하한 0
// AC-1 검산: 08:00→480, 15:00→900, -30 = 390 ✔   복잡도 O(1)

calcOvertime(workMinutes: number, regular = REGULAR/*390*/): number
// 의사: return max(0, workMinutes - regular);
// AC-4 검산: clockOut17:00 break30 → work510, overtime=510-390=120 ✔  복잡도 O(1)

// ── src/lib/pay.ts ───────────────────────────────────────
calcPaidMinutes(i: { workMinutes:number; deductMinutes:number; status:WorkStatus }): number
// 의사:
//   if (status==="휴가") return 0;              // 엣지#2 휴가 0처리
//   return max(0, workMinutes - deductMinutes);  // AC-5, 엣지#3 차감>근무 → 0
//   복잡도 O(1)

calcDailyPay(i: { paidMinutes:number; hourlyWage:number; status?:WorkStatus }): number
// 의사:
//   if (status==="휴가") return 0;              // AC-3
//   return Math.round(paidMinutes/60 * hourlyWage);
// AC-2 검산: 390/60*10320 = 6.5*10320 = 67,080 ✔   복잡도 O(1)

buildPaySummary(items: PayItem[]): PaySummary
// 의사:
//   totalPay = items.reduce(+amount)            // 주휴 포함, AC-10 불변식
//   deductMinutes = Σ record.deductMinutes (work items)
//   overtime: count = #(overtimeMinutes>0), minutes = Σ overtimeMinutes
//   복잡도 O(n)  (n = 월 일수 ≤ 31, 사실상 상수)
```

**복잡도 종합**: 모든 시각/일급 함수 **O(1)**. 월 집계(`buildPaySummary`, GET /api/pay)만 **O(n), n≤31** — 선형, 정당(데이터 상한 명확, O(n²) 없음). 캘린더 렌더 셀 매핑도 **O(n)**. **O(n²) 이상 발생 지점 없음.** 중첩 깊이 ≤ 3, 함수 길이 ≤ 50줄 가이드 적용(developer 준수 권고).

**엣지 방어 지점**: parseHHMM 형식불량(NaN), end≤start 역전(엣지#4→0), 음수 하한 0(엣지#3), 휴가 0처리(엣지#2 NaN/null 방지), 빈 달 빈 배열(엣지#1, route 레벨).

### 3.2 캘린더 배지 포맷 (쟁점 A — `+0분` 숨김)

```typescript
// features/attendance/domain.ts
formatBadge(r: AttendanceRecord): { text:string; tone:'green'|'gray' } | null
// 의사:
//   if (status==="휴가") return null (휴가 라벨 별도)
//   diff = workMinutes - REGULAR(390)
//   if (diff === 0) return null;                 // ★ +0분 숨김 (승인 §0-A)
//   if (diff > 0)  return { text:`+${diff}분`, tone:'green' }; // 초과=연장
//   return { text:`${diff}분`, tone:'gray' };    // 부족(−)
//   복잡도 O(1)
```
> 이미지 검산: 5/4 work424 → +34분(green), 5/22 work90 → -300분, 5/25 work510 → +120분. 5/5의 `+0분`은 **렌더 안 함**.

### 3.3 시드 데이터 명시 테이블 (AC-17 검산 만족 — approver 요구 "자의적 구성 금지")

**기준**: 시급 10,320원, 정규 390분(6.5h), 휴게 30분(11:30~12:00), 월~금 근무. **검산 목표**: 차감합 **440분**, 연장 **6회 / 544분(=9시간4분)**, 주휴수당 67,080원 블루행, summary.totalPay = Σ items.amount.

> 아래는 **검산 제약을 만족하는 구성 원칙 + 골격 테이블**이다. developer는 이 제약(차감Σ=440, 연장 6회/544분, 주휴 1행 67,080)을 정확히 만족하는 한 날짜 배정의 미세조정 재량을 가진다. 이미지(IMG_3606/3611) 관측값을 우선 고정한다.

| date | status | clockIn | clockOut | break | work분 | overtime분 | deduct분 | 일급 | 근거 |
|---|---|---|---|---|---|---|---|---|---|
| 05-04(월) | 연장 | 07:26 | 15:00 | 30 | 424 | 34 | 0 | 72,928? → **표기 우선 work=424** | IMG_3606 +34분 |
| 05-06(수) | 연장 | — | — | 30 | 630 | 240 | 0 | — | +240분 |
| 05-07(목) | 연장 | — | — | 30 | 630 | 240 | 0 | — | +240분 |
| 05-08(금) | 연장 | — | — | 30 | 630 | 240 | 0 | — | +240분 |
| 05-22(금) | 정상 | — | — | 30 | 90 | 0 | 300 | — | -300분(부족) |
| 05-24(일) | 연장 | — | — | 30 | 520 | 130 | 0 | 89,440 | 8h40m, IMG_3611 |
| 05-24(일) | weekly_holiday(주휴) | — | — | — | 390 | 0 | 0 | **67,080(블루)** | IMG_3611 |
| 05-25(월) | 연장 | — | — | 30 | 510 | 120 | 0 | 82,560 | 8h, 연장2시간, IMG_3611 |
| 05-26~28(화수목) | 정상 | 08:00 | 15:00 | 30 | 390 | 0 | 0 | 67,080×3 | IMG_3611 |
| 05-29(금) | 휴가 | null | null | 0 | 0 | 0 | 0 | **0원** | IMG_3611 휴가 |
| (그 외 평일) | 정상 | 08:00 | 15:00 | 30 | 390 | 0 | (잔여 차감 배분) | 67,080 | 차감Σ=440 충족 |

**연장 6회 검산**: 05-04, 06, 07, 08, 24, 25 = **6회** ✔. 연장분 합 = 34+240+240+240+130+120 = **1004분**.
> ⚠️ **검산 주의(developer 필독)**: 이미지의 `+240분`을 액면 합산하면 연장분 합이 9시간4분(544분)을 **초과**한다. AC-17의 "연장 6회 9시간4분(544분)"이 합계 제약이므로, **연장 6회는 유지하되 각 연장분 값은 합이 544분이 되도록 시드에서 재배분**해야 한다(예: 이미지의 `+240분`은 배지 표기 데모용이고, summary 합산은 별도 연장 필드로 544분에 맞춤). developer는 ST-2에서 `seed.test.ts`로 다음 3개 불변식을 **반드시** 검증한다:
> 1. `Σ deductMinutes(work items) === 440`
> 2. `overtimeCount === 6 && Σ overtimeMinutes === 544`
> 3. `summary.totalPay === Σ items.amount` (주휴 67,080 포함)
>
> 충돌 시(배지 표기값 vs summary 제약) → **AC-17 summary 검산값(544/440)을 우선**하고, 캘린더 배지는 표기 데모로 분리한다. 본 모호성은 reviewer 분류 D 회귀 방지를 위해 명시한다.

### 3.4 네이밍/패턴 컨벤션
- CLAUDE.md/AGENTS.md 부재(신규 repo) → Next/React 관례 우선: 컴포넌트 PascalCase, 훅 `useXxx`, 순수함수 camelCase 동사, 타입 PascalCase. 도메인 용어는 한글 enum 값 유지(`"정상"|"지각"...`)하되 식별자는 영문. `@/*` path alias 사용(tsconfig 기존).

---

## §4. 렌더링 정책 (react-nextjs)

### 4.1 라우트별 렌더링 전략

| 라우트 | 렌더 전략 | 'use client' 경계 | 캐시/revalidate |
|---|---|---|---|
| `/` (홈) | RSC 셸 + client 섬(ClockToggle) | features/attendance ClockToggle, components/BottomNav | API fetch `cache:'no-store'` (인메모리·실시간 토글, 쟁점C) |
| `/attendance` | RSC 셸 + client(MonthlyCalendar) | MonthlyCalendar, MonthSelector | `no-store` |
| `/attendance/[date]` | **dynamic** RSC 셸 + client(AttendanceDetail) | AttendanceDetail/StatusChangeSheet/EditRequestForm | `no-store`; mutation 후 즉시 재fetch |
| `/pay` | RSC 셸 + client(PayList) | PayList, MonthSelector | `no-store` |
| `/pay/[date]` | **dynamic** RSC 셸 + client(PayDetail) | PayDetail | `no-store` |
| `/api/**` | server runtime | — | `Response` 헤더 `Cache-Control: no-store` |

- **SSR/SSG/ISR/CSR 결정**: 정적 셸은 RSC(서버 렌더). 데이터 영역은 **CSR fetch**(client 마운트 후) — 인메모리 store가 빌드타임에 없고 mutation이 잦으므로 SSG/ISR 부적합. **revalidate 미사용**(no-store가 인메모리 진실원과 일치). 메모이제이션: 캘린더 셀 표현 매핑은 `useMemo`(month 데이터 의존), 토글 핸들러 `useCallback`. effect 의존성: `useAttendance(month)`의 fetch effect는 `[month]`만 의존(불필요 재실행 차단). Suspense: client fetch 로딩은 컴포넌트 내부 `isLoading` 플래그로 처리(라우트 단위 Suspense 불필요).

### 4.2 동적 라우트 [date] 검증 · 404 정책 (엣지#5)
- `[date]` param 정규식 검증: `^\d{4}-\d{2}-\d{2}$` + 실제 유효일자(`2026-05-99` 거부). 불량 → `notFound()`(404). 유효하나 레코드 없음 → 빈 상태 UI("데이터 없음", 크래시 금지, 엣지#1). API GET /[date]도 동일하게 404 일관 반환(§2.3).

### 4.3 바텀시트 모달 구현 정책
- **결정: 별도 라우트 아님 → 클라이언트 상태**(`components/BottomSheet` + `features/attendance/StatusChangeSheet`). 근거: 상태변경 시트는 상세 화면 컨텍스트(선택 날짜)에 종속된 일시적 모달 → intercepting route보다 로컬 `useState(open)`가 단순·정합(IMG_3610 오버레이 형태). 닫힘 시 URL 변화 없음.

### 4.4 Tailwind v4 디자인 토큰 정책 (`globals.css @theme`)
- 기존 `globals.css`의 `@theme inline` 확장: 코랄 `--color-coral: #F26B4D`(1차 액션/강조 — 출근/변경/확인 버튼, 활성 탭), 보조 `--color-coral-soft`, 상태색(연장 green, 주휴 blue `text-blue-*`, 부족 gray). prefers-color-scheme dark 블록은 모바일 라이트 셸 우선이므로 본 앱 셸 색은 토큰 고정(다크 자동반전 제외). AC-19(a) 충족.
- **모바일 세로 셸**: `layout.tsx`에서 `max-w-md mx-auto min-h-dvh relative` + 하단 `BottomNav` `fixed bottom-0`(스크롤 컨텐츠 `pb-[nav]`). 단일 컬럼(AC-19e). 라운드 카드 = `components/Card` `rounded-2xl`(AC-19c). 바텀탭 4개 + 활성 하이라이트(AC-19b, AC-20: 마이페이지 `disabled`/플레이스홀더, 라우트 미생성으로 깨진 링크 방지).

---

## 자체 체크리스트 결과

- [x] **feature-based 경계가 PRD 배치와 일치** ✅ — §1.3 파일 목록이 PRD §1 라인 40~62와 1:1. 모든 폴더 confidence high, 위배 0.
- [x] **RSC/client 경계 명시 (client 훅을 RSC에서 안 씀)** ✅ — §1.2 표 + §2.4 불변식. page.tsx/layout.tsx는 셸만, 훅은 features client 컴포넌트.
- [x] **API 계약이 AC-6~10과 1:1** ✅ — §2.3 6종 ↔ AC 주석 매핑, §2.6 경계면 일치.
- [x] **순수함수 시그니처가 AC-1~5와 1:1, 복잡도 명시** ✅ — §3.1 calcWorkMinutes(AC-1)/calcDailyPay(AC-2,3)/calcOvertime(AC-4)/calcPaidMinutes(AC-5), 전부 O(1), 집계만 O(n≤31).
- [x] **쟁점 A/B/C 결정이 설계에 반영됨** ✅ — A: §3.2 `+0분` 숨김. B: §2.2 weekly_holiday 고정값 + §3.3 시드. C: §2.5 현재시각 기록 + 테스트 격리.
- [x] **렌더링 정책(인메모리 no-store) 명시** ✅ — §4.1 전 라우트 no-store, revalidate 미사용, [date] 404 정책 §4.2.

---

## 📊 정규식 자가 검증 결과 (4섹션 본문 대상)

- §1 파일 경로 패턴 `[a-zA-Z0-9_./-]+\.(tsx?|...)`: ✅ 다수 매치 (layout.tsx, store.ts, time.ts, MonthlyCalendar.tsx 등 30+)
- §2 타입/계약 코드 블록 ```` ```typescript ````: ✅ 4개 블록 (store/types/API/mutation)
- §3 시간복잡도 `O(...)`: ✅ 다수 매치 (O(1) 시각·일급 함수, O(n) 집계)
- §4 렌더링 키워드(react-nextjs: SSR|SSG|ISR|CSR|revalidate|use client|cache|suspense): ✅ 다수 매치 (no-store, CSR, RSC, Suspense, revalidate 미사용, dynamic)

> detected_stack = react-nextjs. 바이패스 0건. SELF_REWORK 없음 — PASS.

---

## developer 인계 요약 (핵심 설계 결정)

1. **모듈 경계**: `app→features→components→lib→types` 단방향. `components/`는 도메인 타입을 모르고 표현 props만 받음. `lib/store.ts`,`seed.ts`는 server-only(client는 반드시 Route Handler 경유), `time.ts`/`pay.ts`는 부수효과 0 순수함수.
2. **RSC/client**: page.tsx/layout.tsx는 RSC 셸(훅 금지). 데이터·인터랙션은 features의 'use client' 컴포넌트가 마운트 후 `fetch('/api/...', {cache:'no-store'})`.
3. **순수함수 시그니처**(AC-1~5, 전부 O(1)): `calcWorkMinutes`(390분), `calcOvertime`(초과분), `calcPaidMinutes`(휴가0·차감음수하한0), `calcDailyPay`(반올림·휴가0), `buildPaySummary`(O(n≤31)).
4. **렌더링**: 전 라우트 CSR fetch + no-store(인메모리), revalidate 미사용. `[date]`는 정규식+유효일자 검증→`notFound()`. 바텀시트는 별도 라우트 아닌 client `useState`.
5. **⚠️ 최대 주의 — 시드 검산(§3.3)**: 이미지 `+240분` 배지 액면 합산은 AC-17 "연장 544분"을 초과한다. **시드는 3개 불변식**(차감Σ=440 / 연장6회·Σ544분 / totalPay=Σitems주휴포함)을 `seed.test.ts`로 강제 검증하고, 배지 표기 vs summary 충돌 시 **summary 제약 우선**. 토글(쟁점C)은 `new Date()`로 오늘 clockIn/clockOut 기록하되 순수함수 테스트는 고정 입력값만 사용(비결정성 격리).
