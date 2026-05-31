# 03-architecture — 출퇴근 내비게이션 확장 아키텍처 설계서

- **task**: 2026-05-31-nav-enhancements
- **author**: task-architect
- **version**: v1
- **mode**: teammate (Notion 미사용 — 본 문서가 단일 산출물)
- **입력**: `01-prd.md`(승인), `02-approval.md`(Q1 입사월~현재월 / Q2 architect 결정 / Q3 무제한), 기존 코드, `CONTEXT.md`
- **detected_stack**: react-nextjs
- **project_structure.primary_pattern**: feature-based (`src/features/<domain>/components`, 공용 `src/components`, 순수 유틸 `src/lib`, RSC 셸 `src/app`)
- **원칙**: append-only · 회귀 0 · RSC/client 경계 보존 · 도메인(급여/근무 산정) 무변경 · scope = 내비게이션/라우팅 확장만

---

## §1. 변경 범위 & 모듈 경계

### 1.1 파일 목록 (신규/수정) + 단일 책임

| 종류 | 파일 | 단일 책임 | append-only 여부 |
|---|---|---|---|
| 수정(append) | `src/lib/date.ts` | 순수함수 `shiftDay(date, delta)` 추가. 기존 export·시그니처 불변 | append-only (함수 1개 추가) |
| 수정(append) | `src/lib/date.test.ts` | `shiftDay` 단위 테스트 추가 (AC-1~5). 기존 케이스 불변 | append-only (describe 1개 추가) |
| 신규 | `src/features/attendance/components/AttendanceDetailNav.tsx` | `"use client"` 내비 래퍼. 이전/다음 일자(shiftDay) + 뒤로(`/attendance`) 라우팅만 담당. 데이터/도메인 비접근 | 신규 파일 |
| 신규 | `src/features/attendance/components/MonthPickerSheet.tsx` | `"use client"` 월 선택 시트. `BottomSheet` 셸 + 입사월~현재월 목록 렌더 + 선택 콜백만 | 신규 파일 |
| 수정(append) | `src/app/attendance/[date]/page.tsx` | RSC 셸 유지. 헤더 영역에 `AttendanceDetailNav` 마운트(검증·`notFound()`·`AttendanceDetail` 호출은 불변) | append (마운트 1줄 영역) |
| 수정(라벨 영역 교체) | `src/features/attendance/components/AttendanceCalendarView.tsx` | 기존 month state·‹›화살표·`MonthlyCalendar` 보존. 라벨을 클릭 트리거로 만들고 `MonthPickerSheet` 마운트 + open state 추가 | append (라벨/시트만, 화살표 핸들러 불변) |

> 검증 안 함(verification only, 코드 산출물 없음): `src/app/attendance/page.tsx`, `MonthlyCalendar.tsx`, `AttendanceDetail.tsx`, `useAttendance` 훅, route handler, `store.ts` — **전부 무변경**(OOS2/OOS3 고정).

### 1.2 모듈 간 의존성 방향 (단방향 강제)

```
src/app/attendance/[date]/page.tsx (RSC 셸)
        │ (mount, date prop)
        ▼
AttendanceDetailNav (client)  ──uses──▶ src/lib/date.ts: shiftDay
        │                     ──uses──▶ next/navigation: useRouter
        ▼ (router.push)
[같은 라우트 재진입] ──▶ AttendanceDetail (불변, 데이터 페칭 자기 책임)

AttendanceCalendarView (client, month state owner)
        │ (open state, month, onSelect)
        ▼
MonthPickerSheet (client) ──uses──▶ BottomSheet (공용 셸)
        │                  ──reads──▶ src/lib/constants: SEED_JOIN_DATE, SEED_MONTH
        │                  ──uses──▶ src/lib/date: shiftMonth, formatMonthLabel
        ▼ (onSelect "YYYY-MM")
AttendanceCalendarView.setMonth ──▶ MonthlyCalendar (불변, month prop fetch)
```

- 방향: `app(RSC) → features(client) → lib(순수)/components(공용 presentational)`. 역참조 없음. lib는 어떤 컴포넌트도 import하지 않음(isomorphic 순수 유지).
- `AttendanceDetailNav`는 `AttendanceDetail`을 import하지 않는다(형제 — page가 둘 다 마운트). 내비와 데이터 표시는 책임 분리.
- `MonthPickerSheet`는 attendance 도메인 종속(범위 계산이 입사월 의미를 가짐) → `src/components`가 아닌 `src/features/attendance/components`에 배치(PRD §3 배치 권고, feature-based 패턴 준수).

### 1.3 RSC / client 경계

- `src/app/attendance/[date]/page.tsx`: **RSC 유지**. `await params` → `isValidDateString` → `notFound()` 셸 책임 불변. `"use client"` 침범 금지(R4 완화). 내비 UI는 client 자식으로 격리.
- `AttendanceDetailNav`, `MonthPickerSheet`: `"use client"`(useRouter/useState 필요).
- `AttendanceCalendarView`: 이미 `"use client"` — 경계 변화 없음.

### 1.4 MonthSelector orphan 재사용 결정

- **결정**: `src/components/MonthSelector.tsx`(orphan, `{label} ▾` 트리거)를 **`AttendanceCalendarView`의 라벨 트리거로 재사용**한다. picker 시트 본문은 신규 `MonthPickerSheet`.
- **근거**: `MonthSelector`는 이미 `label`/`onClick` 동적 prop을 가져 IMG_3606 "2026년 5월 ▾"와 동형(PRD R1). 시그니처 무변경(append-only 준수), 데모 주석만 갱신 가능. 단, 기존 ‹›화살표 레이아웃과 병존해야 하므로(AC-14) `AttendanceCalendarView`는 `‹  [MonthSelector label onClick]  ›` 형태로 라벨 위치에만 끼운다. **화살표 `<button>` 2개와 그 핸들러(shiftMonth)는 그대로 둔다** — 라벨 `<span>`만 트리거로 교체.

### 1.5 Q2 — 상세 뒤로 버튼 배치 결정

- **결정**: `AppHeader`에 prop append 하지 **않는다**. 대신 `AttendanceDetailNav`(client 래퍼)가 page 헤더 영역에서 **`AppHeader`의 `right` 슬롯에 [이전 | 다음] 묶음**을 전달하고, **뒤로(‹) 버튼은 `AppHeader` 위 별도 얇은 바(래퍼 상단 좌측)**로 렌더한다.
- **근거**: (a) `AppHeader`는 공용 presentational이며 4개 라우트가 공유 — `left`/`back` prop을 추가하면 공용 컴포넌트 시그니처 변경 = 회귀 표면 확대(append이긴 하나 옵셔널 prop 추가도 공용 컨트랙트 변동). 승인 권장안 2개 중 **"상세 client 래퍼 상단 ‹ 버튼"**을 택해 공용 컴포넌트 무변경 + 회귀 0 보장. (b) page.tsx는 `<AppHeader title={formatLongDate(date)} />`를 이미 렌더 → 래퍼는 그 위/우측을 차지하므로 title(타이틀=`formatLongDate`)은 §7대로 유지(AC-6 타이틀 갱신은 라우트 재진입으로 page가 새 date의 `formatLongDate` 재계산하여 자연 충족).
- 구체 배치: `AttendanceDetailNav`가 `right`로 줄 이동 버튼은 page가 `AppHeader right={<AttendanceDetailNav .../>}`로 합성하거나, 래퍼가 헤더 전체를 감싸는 형태 중 **developer 재량**(레이아웃 디테일). 본 설계는 "뒤로=래퍼 상단 좌측, 이동=헤더 우측, 공용 AppHeader 시그니처 무변경"만 강제.

### 1.6 AC ↔ 모듈 매핑

| AC | 모듈 |
|---|---|
| AC-1~5 (shiftDay) | `src/lib/date.ts` + `date.test.ts` |
| AC-6~8 (일자 이동) | `AttendanceDetailNav` (shiftDay + router.push) |
| AC-9 (빈 상태 graceful) | `AttendanceDetail`(불변) — 회귀 고정만 |
| AC-10 (뒤로 목적지) | `AttendanceDetailNav` (router.push "/attendance") |
| AC-11 (aria-label) | `AttendanceDetailNav` 버튼 |
| AC-12 (라벨 클릭→열림) | `AttendanceCalendarView` + `MonthSelector` 트리거 |
| AC-13 (선택→전환) | `MonthPickerSheet` onSelect → `setMonth` |
| AC-14 (화살표 병존) | `AttendanceCalendarView` (화살표 핸들러 불변) |
| AC-15 (닫기) | `MonthPickerSheet` + `BottomSheet onClose` |
| AC-16 (회귀/DoD) | 전 모듈 append-only + 무변경 보존 |

### 1.7 developer 사용 명령 (project_skills.commands)

- `pnpm test`(vitest, 106+신규 GREEN), `pnpm tsc --noEmit`, `pnpm build`, `pnpm lint` — AC-16 게이트.

---

## §2. 데이터 흐름 & 계약

### 2.1 순수함수 `shiftDay` 계약

```typescript
// src/lib/date.ts (append). isomorphic 순수 — Date.now 비의존(AC-5).
/**
 * "YYYY-MM-DD"를 delta 일 이동. 월/연/윤년 경계 자동 정규화.
 * 입출력 모두 zero-pad "YYYY-MM-DD". shiftMonth와 동일 컨벤션(로컬 Date(y, m-1, d) 생성).
 */
export function shiftDay(date: string, delta: number): string;
// shiftDay("2026-05-31", +1) === "2026-06-01"
// shiftDay("2026-01-01", -1) === "2025-12-31"
```

- **타임존 함정 회피**: `new Date(y, m-1, d+delta)`(로컬, 시각 미지정=로컬 자정) 사용 — `Date.parse("2026-05-31")`(UTC 파싱) 금지. 기존 `shiftMonth`/`isValidDateString`/`weekdayKo` 전부 로컬 `Date(y, m-1, d)` 컨벤션이므로 일관. 출력은 `getFullYear/getMonth/getDate`를 다시 zero-pad 조립 → 파싱·포맷 모두 로컬 동일 기준이라 오프바이원 없음.
- **계약**: 입력은 `isValidDateString`이 보장하는 유효 "YYYY-MM-DD"(상세 라우트는 이미 검증 통과한 date만 전달). delta는 정수(±1 사용). 부수효과 없음.

### 2.2 상세 일자 이동 데이터 흐름

```
page(RSC, date="2026-05-29")
  └─ AttendanceDetailNav(date)  [client]
       "다음 날" click
         → next = shiftDay("2026-05-29", +1) = "2026-05-30"
         → router.push("/attendance/2026-05-30")
              → Next.js 라우트 재진입 → page RSC 재실행(date="2026-05-30")
                   → AppHeader title = formatLongDate("2026-05-30")  [AC-6 타이틀 갱신]
                   → AttendanceDetail(date="2026-05-30")
                        → useDayAttendance("2026-05-30") fetch (cache:"no-store" 기존)
                        → 레코드 있으면 카드, 없으면 "근무기록이 없습니다"(AC-9)
```

- **store/API 무변경**: 이동은 라우트 파라미터 전환일 뿐 — `useDayAttendance`/`/api/attendance/[date]`/store 모두 기존 그대로 재호출(OOS2). 새 fetch·새 계약 없음. `no-store`이므로 연속 클릭 멱등(E7).
- **뒤로(AC-10)**: `router.push("/attendance")` — 브라우저 history 무관 결정적 목적지(E8 딥링크 안전). `Link href="/attendance"`도 동등하나, 이동 버튼이 `router.push`라 일관성·접근성(`<button aria-label>`)을 위해 `router.push` 통일 권고(developer 재량으로 뒤로만 `Link` 허용).

### 2.3 월 picker 범위 계산 & 흐름 (Q1: 입사월~현재월)

```typescript
// 범위 경계는 상수에서 도출(하드코딩 회피, approval 지침).
// SEED_JOIN_DATE = "2026-04-01" (constants.ts) → 입사월 "2026-04"
// SEED_MONTH     = "2026-05"   (constants.ts) → 현재월(데모 기준월)
// 월 목록: 입사월부터 현재월까지 오름차순 "YYYY-MM"[] (2026-04 권장 시 최신월 먼저 등 정렬은 UI 재량)
// 예: ["2026-04", "2026-05"]
```

- **계약(MonthPickerSheet props)**:
```typescript
interface MonthPickerSheetProps {
  open: boolean;
  current: string;          // "YYYY-MM" 현재 선택월(강조용, AC-14 화살표 이동 후 기준)
  joinMonth: string;        // "YYYY-MM" 입사월 = SEED_JOIN_DATE.slice(0,7)
  currentMonth: string;     // "YYYY-MM" 현재월 = SEED_MONTH
  onSelect: (month: string) => void;  // 선택 시 "YYYY-MM"
  onClose: () => void;
}
```
- **흐름**: `AttendanceCalendarView`의 month state(이미 `useState(SEED_MONTH)`) + 신규 `pickerOpen` state.
  - 라벨(`MonthSelector`) click → `setPickerOpen(true)` (AC-12)
  - 시트에서 월 선택 → `onSelect(m)` → `setMonth(m)` + `setPickerOpen(false)` → `MonthlyCalendar`가 새 month fetch, 라벨이 `formatMonthLabel(m)` 갱신 (AC-13)
  - 배경/× → `onClose` → `setPickerOpen(false)`, month 불변 (AC-15)
  - ‹›화살표는 `setMonth(shiftMonth(m, ±1))` 그대로 — picker open과 독립(AC-14). 화살표로 바뀐 month가 `current` prop으로 시트에 반영.
- **범위 상수 출처**: `AttendanceCalendarView`(client)가 `SEED_JOIN_DATE`·`SEED_MONTH`를 `constants.ts`에서 직접 import → store(server-only) 비의존, API 무변경. `storeInfo.joinDate`도 동일 값(`SEED_STORE_INFO.joinDate = SEED_JOIN_DATE`)이나 client는 정적 상수 경로가 안전(no-store fetch 불요).

### 2.4 경계면 일치 검증 (Frontend ↔ API ↔ DB)

| 경계 | 검증 |
|---|---|
| Nav → 라우트 | `shiftDay` 출력 = 유효 "YYYY-MM-DD" = `[date]` 동적 세그먼트 형식 일치. `isValidDateString` 통과 보장(정규화 출력은 항상 실존 일자). |
| Detail → API | `useDayAttendance(date)` 시그니처·`/api/attendance/[date]` 응답 스키마 무변경(불변 계약, PRD §8). |
| Picker → Calendar | `onSelect` "YYYY-MM" = `MonthlyCalendar` month prop = `useMonthAttendance(month)` = `/api/attendance?month=` 형식 일치. 무변경. |
| 범위 상수 | `SEED_JOIN_DATE`(date) → `.slice(0,7)`로 "YYYY-MM" 변환 후 사용. `SEED_MONTH`는 이미 "YYYY-MM". |

---

## §3. 알고리즘 & 클린코드 사전 점검

### 3.1 `shiftDay` 의사코드 + 경계 분석

```
shiftDay(date, delta):
  (y, m, d) = date.split("-").map(Number)
  dt = new Date(y, m-1, d + delta)        // JS Date 생성자가 오버/언더플로 자동 정규화
  return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`
```

- **시간복잡도: O(1)** — split(고정 길이 10자) + Date 생성 + 조립. 입력 크기 무관 상수.
- **경계 분석**(AC-2/3/4, E1~E3):
  - 월말 `"2026-05-31"` +1 → `Date(2026, 4, 32)` → JS가 2026-06-01로 정규화 → `"2026-06-01"` ✅
  - 월초 역 `"2026-06-01"` -1 → `Date(2026, 5, 0)` → 5월 31일 → `"2026-05-31"` ✅
  - 연말 `"2026-12-31"` +1 → `Date(2026, 11, 32)` → 2027-01-01 ✅ / 연초 `"2026-01-01"` -1 → `Date(2026, 0, 0)` → 2025-12-31 ✅
  - 윤년 `"2028-02-28"` +1 → `Date(2028, 1, 29)` → 2028-02-29 (2028 윤년) ✅ / `"2028-03-01"` -1 → `Date(2028, 2, 0)` → 02-29 ✅
  - 비윤년 `"2026-02-28"` +1 → `Date(2026, 1, 29)` → 2026-03-01 ✅
  - 다중 `"2026-01-05"` -4 → `Date(2026, 0, 1)` → 2026-01-01, zero-pad 유지 ✅ (AC-5)

### 3.2 월 목록 생성 알고리즘

```
buildMonthList(joinMonth, currentMonth):     // 둘 다 "YYYY-MM"
  list = []
  cur = joinMonth
  while cur <= currentMonth (문자열 비교 또는 shiftMonth 누적):
    list.push(cur); cur = shiftMonth(cur, +1)
  return list
```

- **시간복잡도: O(n)**, n = 입사월~현재월 사이 개월 수. 데모는 n=2(2026-04, 2026-05). 실사용도 수십 개월 상한이라 무시 가능. O(n²) 미발생.
- 문자열 "YYYY-MM" 사전식 비교가 시간순과 일치(zero-pad 보장)하므로 `<=` 직접 비교 안전. 무한루프 방지: `shiftMonth` 단조 증가 + 상한 현재월.

### 3.3 일자 이동 / 뒤로 / picker 클릭 핸들러

- 각 핸들러: shiftDay 1회 + router.push 1회 = **O(1)**. 반복문/중첩 없음.
- `MonthPickerSheet` 목록 렌더: `list.map`(O(n)) 단일 루프, 중첩 없음.

### 3.4 클린코드 가이드 적용

- 중첩 깊이 ≤ 3: `shiftDay`(0 중첩), `buildMonthList`(while 1중첩), 핸들러(0~1). 전부 충족.
- 함수 길이 ≤ 50줄: 전 신규 함수 10줄 이내 예상.
- 네이밍/패턴(CLAUDE.md/CONTEXT.md 우선): `shiftDay`는 기존 `shiftMonth` 미러(delta 인자명·"YYYY-MM-DD" 컨벤션 동일). 컴포넌트 PascalCase, `"use client"` 선두. 도메인 용어 무도입(내비 확장 — CONTEXT.md 갱신 불요, §10 PRD 일치).
- DRY: 경로 계산 단일 출처 = `shiftDay`(AC-8이 명시). picker 라벨/포맷은 기존 `formatMonthLabel` 재사용.

---

## §4. 렌더링 & 성능 정책 (react-nextjs)

- **상세 client 래퍼 경계**: `AttendanceDetailNav`는 `"use client"`. `useRouter`(next/navigation, App Router)로 `router.push`. page.tsx는 RSC 유지(SSR 셸) — 클라 경계는 래퍼/Detail로만 침투(R4 완화).
- **라우팅 방식 결정**: 일자 이동·뒤로 모두 `router.push`(프로그래매틱, `<button aria-label>`). 사유: 이동/뒤로가 동일 인터랙션군 → 접근성·일관성. (뒤로만 `<Link href="/attendance">` 허용 — developer 재량.) `router.replace` 아님(history 보존이 자연스러움, 단 AC-10은 history 무관 결정적 목적지라 push/replace 무관하게 충족).
- **렌더링 모드**: 본 앱은 전 라우트 client fetch + `cache:"no-store"`(CONTEXT.md 운영 메모 — 인메모리 store 진실원 일치). 일자 이동·월 전환은 SSG/ISR/revalidate 대상 아님 — **no-store 동적 데이터 페칭 유지**(회귀 0). `router.push`는 App Router 클라 네비게이션으로 page RSC payload 재요청, Detail의 useDayAttendance가 no-store fetch. **새 캐시 정책 도입 없음**.
- **월 picker 시트 상태**: `BottomSheet`(기존, 바디 스크롤 락 useEffect 내장) 재사용. `MonthPickerSheet`는 `open`/`onClose`/`onSelect`만 상태로 — `AttendanceCalendarView`가 단일 상태 소유(month + pickerOpen). 시트 내부는 controlled, 추가 effect 불필요(BottomSheet가 스크롤 락 effect 담당).
- **메모이제이션**: `MonthlyCalendar`는 기존 `useMemo`(byDate/cells) 보존 — 무변경. 신규 핸들러는 O(1)이라 `useCallback` 불요(렌더 비용 무시 가능, 과최적화 금지). `buildMonthList`는 n작아 매 렌더 재계산 무해하나, 시트 props가 안정적이면 `useMemo([joinMonth,currentMonth])`로 감싸도 무방(developer 재량).
- **effect 의존성**: 신규 코드에 데이터 effect 도입 없음(라우팅은 이벤트 핸들러, 페칭은 기존 훅). BottomSheet의 `[open]` effect만 관여(기존). useEffect로 라우트 동기화 금지(이벤트 기반).
- **접근성(AC-11)**: 뒤로 `aria-label="뒤로"`, 이전 `aria-label="이전 날"`, 다음 `aria-label="다음 날"` `<button>`. 라벨 트리거(MonthSelector)는 기존 `<button>` — 접근 가능. BottomSheet × 닫기 `aria-label="닫기"` 기존.
- **회귀 없음**: 기존 라우트(`/`,`/attendance`,`/attendance/[date]`,`/pay`,`/pay/[date]`,`/mypage`,`/mypage/profile`) 및 셀 탭(CalendarCell `Link`) 동작 불변. 화살표 핸들러 불변(AC-14). 모바일 max-w-md 단일 컬럼 레이아웃 준수.

---

## 자체 체크리스트 결과

- §1 모듈 경계 분리됨: ✅ (Nav/Picker/lib 단방향, page RSC 유지, append-only)
- §2 경계면 타입 일치: ✅ (shiftDay→[date], onSelect→month prop, API/store 무변경)
- §3 시간복잡도 명시: ✅ (shiftDay O(1), buildMonthList O(n), 핸들러 O(1))
- §4 렌더링 정책 명시: ✅ (use client 경계, no-store 유지, router.push, effect 미도입)

추가 PRD 체크:
- [x] append-only, 회귀 0 (공용 AppHeader 시그니처 무변경 결정으로 회귀 표면 최소화)
- [x] shiftDay 경계 정확 (AC-2/3/4 의사코드 검증)
- [x] RSC/client 경계 (page RSC, Nav/Picker client)
- [x] 월 picker 범위 입사월~현재월 (SEED_JOIN_DATE~SEED_MONTH 상수 도출)
- [x] T4 화살표와 picker 병존 (라벨만 트리거 교체, 화살표 핸들러 불변)
- [x] 뒤로/일자이동 라우팅 (router.push, 결정적 목적지)

---

## 📊 정규식 자가 검증 결과

- §1 파일 경로 패턴 (`\.(tsx?|ts|...)`): ✅ 매치 (`date.ts`, `date.test.ts`, `AttendanceDetailNav.tsx`, `MonthPickerSheet.tsx`, `[date]/page.tsx`, `AttendanceCalendarView.tsx` 등 6+)
- §2 타입/계약 코드 블록 (` ```typescript `): ✅ 3개 매치 (shiftDay 시그니처, 범위 상수, MonthPickerSheetProps)
- §3 시간복잡도 `O(...)`: ✅ 매치 (O(1) shiftDay/핸들러, O(n) 월목록, "O(n²) 미발생")
- §4 렌더링 키워드 (react-nextjs: use client/router/cache/no-store/effect): ✅ 다수 매치 (use client, router.push, no-store, useEffect, SSG/ISR/revalidate 언급)

자체 PASS — FAIL 항목 없음, 바이패스 0건.

---

## developer 인계 요약

1. **shiftDay**(S1 선행): `src/lib/date.ts`에 append. `new Date(y, m-1, d+delta)` 로컬 정규화 + zero-pad 재조립 — `shiftMonth` 미러. UTC 파싱 금지. AC-1~5 경계 테스트를 `date.test.ts`에 추가(윤년 2028, 월말/연말 필수).
2. **상세 내비**(S2): 신규 client `AttendanceDetailNav.tsx`. 이전/다음 = `router.push("/attendance/"+shiftDay(date,±1))`, 뒤로 = `router.push("/attendance")`(결정적 목적지). page.tsx는 **RSC 유지** — 마운트만 추가, `notFound`/`AttendanceDetail` 불변. 타이틀 갱신은 라우트 재진입으로 자동(별도 작업 불요). `AttendanceDetail`·store·API **절대 무변경**(AC-9 빈 상태는 기존 동작 그대로 회귀 고정).
3. **월 picker**(S3): `AttendanceCalendarView` 라벨을 orphan `MonthSelector`(시그니처 무변경)로 트리거화 + `pickerOpen` state 추가. 신규 `MonthPickerSheet.tsx`는 `BottomSheet` 재사용, 범위 = `SEED_JOIN_DATE.slice(0,7)`~`SEED_MONTH`(constants.ts 직접 import, store 비의존). 선택→`setMonth`. **‹›화살표 핸들러는 손대지 말 것**(AC-14 병존).
4. **Q2 배치**: 공용 `AppHeader` 시그니처 변경 금지 — 뒤로 버튼은 래퍼 상단, 이동은 `right` 슬롯/래퍼로. 모든 내비 버튼 `aria-label` 필수(AC-11).
5. **DoD 게이트**(S4): `pnpm test`(기존 106 + 신규 GREEN, 회귀 0) / `tsc --noEmit` / `pnpm build` / `pnpm lint` 에러 0. CONTEXT.md·ADR 갱신 불요(도메인 무변경).
