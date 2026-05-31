# PRD — 출퇴근 내비게이션 확장 (상세 일자 이동 / 뒤로가기 / 월 선택 picker)

- **task**: 2026-05-31-nav-enhancements
- **version**: v1
- **author**: task-planner
- **status**: 승인 대기 (DRAFT)
- **mode**: teammate (Notion 미사용 — 본 문서가 단일 산출물)
- **low_clarity_warning**: false (지시 3종이 동작 단위로 명확 — 가정 섹션 불필요. 단, 월 picker 범위는 §Unresolved Q로 표면화)

---

## 1. 배경 & 문제

기존 출퇴근(`/attendance`) 캘린더는 T4에서 월 ‹ › 화살표(step 이동)를 갖췄고, 날짜 셀 탭 시 상세(`/attendance/[date]`)로 진입한다. 그러나:

1. 상세뷰에 진입하면 **다른 날짜로 이동하려면 매번 달력으로 돌아가 다시 탭**해야 한다 — 연속 일자 확인(전날/다음날) 동선이 단절.
2. 상세뷰에 **명시적 뒤로가기 진입점이 없다** — 브라우저 back에만 의존(상세 직접 진입/딥링크 시 복귀 불명확).
3. 캘린더 월 이동은 ‹ › step뿐이라 **먼 달로 점프하려면 화살표를 여러 번** 눌러야 한다. 참조 디자인(IMG_3606)은 "2026년 5월 ▾" 라벨 클릭형 picker를 보여준다.

본 task는 위 3개 동선 결함을 **기존 앱에 append-only로 확장**한다. 도메인(급여/근무 산정) 변경은 없으며, 순수 내비게이션/라우팅 확장이다.

### 1.5 Sub-task 분해

| # | sub-task | 산출물(신규/수정) | 사용 가능한 자원 | 검증 |
|---|---|---|---|---|
| **S1** | 순수함수 `shiftDay` 추가 | `src/lib/date.ts`(append), `src/lib/date.test.ts`(append) | 기존 `shiftMonth` 패턴 미러링, vitest | 단위테스트 GREEN |
| **S2** | 상세뷰 일자 이동(이전/다음) + 뒤로가기 UI | `src/features/attendance/components/AttendanceDetail*` 또는 신규 client 래퍼, `src/app/attendance/[date]/page.tsx`(헤더 영역) | `next/navigation` useRouter/Link, `AppHeader`, `shiftDay`, `formatLongDate` | 라우트 동작 수동 + (가능 시)컴포넌트 테스트 |
| **S3** | 월 선택 picker — 라벨 클릭 → 월 선택 | `src/features/attendance/components/AttendanceCalendarView.tsx`(수정), 신규 `MonthPickerSheet`(또는 기존 `MonthSelector` 재사용) | `MonthSelector`(현재 orphan), `BottomSheet`, `shiftMonth`, `formatMonthLabel` | picker 선택→월 전환 동작 |
| **S4** | 회귀 검증 + DoD 게이트 | (없음 — 검증) | `pnpm test/tsc/build/lint` | 기존 106 테스트 + 신규 GREEN |

> 권고 순서: S1 → (S2 ∥ S3) → S4. S1은 S2의 선행(일자 이동이 shiftDay 의존). S2/S3은 상호 독립.

---

## 2. 목표 / 비목표

### 목표
- G1. 상세뷰에서 ±1일 이동(전날/다음날 상세 라우트로 전환), 월/연 경계 안전.
- G2. 상세뷰에서 달력(`/attendance`)으로 명시적 복귀(‹ 뒤로 버튼).
- G3. 캘린더 월 라벨 클릭 시 월을 직접 선택하는 picker 제공. 기존 ‹ › step 화살표와 병존.
- G4. 기존 106 테스트 회귀 0, 4개 하단 탭/전체 라우트 정상.

### 비목표 (Out of Scope)
- OOS1. 상세뷰의 **데이터/도메인 로직 변경** — 출퇴근/급여/연장/차감 산정은 불변(`AttendanceDetail` 본문 카드·상태변경·수정요청 흐름 그대로).
- OOS2. **새 API/store 변경** — 인메모리 store, route handler 무변경. 일자 이동은 기존 `/api/attendance/[date]` 재호출만.
- OOS3. **캘린더 셀 탭 동작 변경** — 셀→상세 진입(T4)은 그대로.
- OOS4. **스와이프 제스처/키보드 단축키** — 본 task는 버튼/탭 기반만. (제스처는 후속 task 후보.)
- OOS5. **상세뷰 미래/과거 무한 범위 제한** — §Unresolved Q1 참조(picker 범위만 결정, 일자 이동은 무제한 허용 권고).
- OOS6. 홈/급여/마이페이지 라우트 변경.

---

## 3. 솔루션 개요

세 가지 모두 **클라이언트 라우팅 확장**으로 해결한다. 새 데이터 흐름·API 없이 `next/navigation`(`useRouter.push` / `Link`)으로 라우트 파라미터를 전환한다.

- **S1 `shiftDay`**: `shiftMonth`와 동일 패턴(`new Date(y, m-1, d+delta)` 정규화)으로 "YYYY-MM-DD"를 ±N일 이동하는 순수함수. JS `Date` 생성자가 일/월/연 오버플로를 자동 정규화하므로 월말·연말·윤년 경계가 자연 처리된다. 로컬 `Date(y, m-1, d)`(시각 미지정=로컬 자정) 사용 — `shiftMonth`와 동일 컨벤션이라 타임존 일관(문자열 입출력, UTC 파싱 회피).
- **S2 상세 일자 이동/뒤로가기**: `/attendance/[date]` RSC 셸은 `date` 검증→`notFound()` 구조 유지. 이동/뒤로 UI는 **client 컴포넌트**(헤더 우측 right 슬롯 또는 신규 `DetailNav` 래퍼)에서 `shiftDay(date,±1)`로 다음 경로를 계산해 `router.push("/attendance/"+next)`. 뒤로가기는 `router.push("/attendance")`(또는 `Link href="/attendance"`) — 브라우저 back이 아닌 **명시적 목적지**(딥링크 진입 시에도 결정적). 데이터 없는 날은 이미 `AttendanceDetail`이 "해당 날짜의 근무기록이 없습니다." 빈 상태를 렌더하므로 graceful(추가 작업 불요, AC로 회귀 고정).
- **S3 월 picker**: `AttendanceCalendarView`(month useState 보유)에 라벨 클릭 핸들러를 추가. 라벨을 `MonthSelector`(현재 미사용 orphan, "라벨 ▾" 형태 = IMG_3606 일치)로 교체하거나 클릭 가능 라벨로 만들고, 클릭 시 `BottomSheet` 기반 `MonthPickerSheet`를 연다. 시트에서 연/월을 선택하면 `setMonth("YYYY-MM")`. ‹ › 화살표는 그대로 두어 step 이동과 병존.

### 활용할 프로젝트 자원
- `src/lib/date.ts` `shiftMonth` (기존 순수함수): `shiftDay` 작성의 **참조 패턴** — S1에서 미러링.
- `src/components/MonthSelector.tsx` (현재 orphan, "{label} ▾"): IMG_3606 디자인과 일치 — S3 라벨 트리거로 재사용 1순위.
- `src/components/BottomSheet.tsx` (open/onClose/title, 바디 스크롤 락): S3 월 picker 시트 셸로 재사용.
- `src/components/AppHeader.tsx` (title/right 슬롯): S2 상세 헤더의 뒤로/이동 버튼 배치 슬롯.
- `next/navigation` useRouter/Link: S2 라우팅.
- `CONTEXT.md`: 도메인 캐논 — 본 task는 도메인 무변경이나 용어 일관성 기준.

### 프로젝트 구조 (기존 패턴 인용)
- **패턴**: feature-based. 도메인 UI는 `src/features/attendance/components/`, 공용 presentational은 `src/components/`, 순수 유틸은 `src/lib/`, 라우트 셸은 `src/app/`(RSC).
- **신규 산출물 배치**:
  - 순수함수 `shiftDay` → `src/lib/date.ts` (append) + 테스트 `src/lib/date.test.ts` (append).
  - 상세 내비 client(`DetailNav` 또는 인라인) → `src/features/attendance/components/`.
  - 월 picker 시트(`MonthPickerSheet`) → `src/features/attendance/components/` (attendance 도메인 종속) — 단, 범용성 판단은 architect 위임.
- **RSC/client 경계**: `page.tsx`는 RSC 유지(검증·셸). 라우팅/상태는 `"use client"` 컴포넌트로 격리(기존 `AttendanceCalendarView` 선례 준수).
- **append-only**: 기존 export·함수 시그니처 변경 금지. `date.ts`에 추가, `AttendanceCalendarView`는 라벨 영역만 교체.

---

## 4. Acceptance Criteria

표기: GWT = Given-When-Then. 모든 날짜는 "YYYY-MM-DD" 문자열.

### shiftDay 순수함수 (S1)
- **AC-1** `shiftDay("2026-05-29", +1) === "2026-05-30"` / `shiftDay("2026-05-29", -1) === "2026-05-28"`.
- **AC-2 (월 경계)** `shiftDay("2026-05-31", +1) === "2026-06-01"` ; `shiftDay("2026-06-01", -1) === "2026-05-31"`.
- **AC-3 (연 경계)** `shiftDay("2026-12-31", +1) === "2027-01-01"` ; `shiftDay("2026-01-01", -1) === "2025-12-31"`.
- **AC-4 (윤년 2월)** `shiftDay("2028-02-28", +1) === "2028-02-29"` ; `shiftDay("2028-03-01", -1) === "2028-02-29"` (2028 윤년). 비윤년: `shiftDay("2026-02-28", +1) === "2026-03-01"`.
- **AC-5 (포맷 보존)** 출력은 항상 zero-pad된 `YYYY-MM-DD` (예 `shiftDay("2026-01-05",-4)==="2026-01-01"`, 월·일 2자리 유지). 입출력 모두 순수(부수효과·전역 `Date.now` 의존 없음).

### 상세뷰 일자 이동 (S2 / G1)
- **AC-6 (다음날)** Given `/attendance/2026-05-29` 상세, When "다음 날" 버튼 클릭, Then 경로가 `/attendance/2026-05-30`으로 전환되고 헤더 타이틀이 `formatLongDate("2026-05-30")`("2026년 5월 30일 토")로 갱신, 상세 본문이 5/30 레코드로 재로드된다.
- **AC-7 (이전날)** Given `/attendance/2026-05-29`, When "이전 날" 클릭, Then `/attendance/2026-05-28`로 전환·재로드.
- **AC-8 (월/연 경계 이동)** Given `/attendance/2026-05-31`, When "다음 날", Then `/attendance/2026-06-01`. Given `/attendance/2026-01-01`, When "이전 날", Then `/attendance/2025-12-31`. (AC-2/3 순수함수가 경로 계산의 단일 출처.)
- **AC-9 (데이터 없는 날 graceful)** Given 레코드가 없는 유효 날짜(예 시드 외 `2026-06-01`)로 이동, Then `notFound()`가 아니라 상세 화면에 빈 상태 문구("해당 날짜의 근무기록이 없습니다.")가 표시되고 이전/다음/뒤로 버튼은 계속 동작한다(앱 크래시·404 없음).

### 상세뷰 뒤로가기 (S2 / G2)
- **AC-10 (뒤로 목적지)** Given 임의 상세 `/attendance/[date]`(달력 경유 진입이든 직접 URL 진입이든), When 상단 ‹ 뒤로 버튼 클릭, Then 경로가 `/attendance`(달력)로 전환된다. (브라우저 history 유무와 무관하게 결정적 목적지.)
- **AC-11 (접근성)** 뒤로/이전/다음 버튼은 각각 식별 가능한 `aria-label`(예 "뒤로", "이전 날", "다음 날")을 가진 `<button>` 또는 접근 가능한 `<Link>`이다.

### 월 선택 picker (S3 / G3)
- **AC-12 (라벨 클릭 → picker 열림)** Given `/attendance` 캘린더, When 월 라벨("2026년 5월 ▾" 형태)을 클릭, Then 월 선택 picker(시트/드롭다운)가 열린다.
- **AC-13 (선택 → 월 전환)** Given picker 열림, When 특정 월(예 2026년 4월)을 선택, Then picker가 닫히고 캘린더가 해당 월로 전환되며(`MonthlyCalendar`가 그 월 레코드 fetch), 라벨이 `formatMonthLabel("2026-04")`로 갱신된다.
- **AC-14 (화살표 병존)** Given picker 도입 후, When 기존 ‹ / › step 화살표 클릭, Then 종전대로 ±1개월 이동이 동작한다(picker가 화살표를 대체하지 않음). 화살표 이동 후 라벨 재클릭 시 picker는 현재 월을 기준으로 연다.
- **AC-15 (picker 닫기)** Given picker 열림, When 배경/닫기(BottomSheet ×) 클릭, Then 월 변경 없이 닫힌다.

### 회귀 / DoD (S4 / G4)
- **AC-16 (회귀 0)** `pnpm test`로 **기존 106개 테스트 전부 GREEN**(0 fail), 신규 `shiftDay` 테스트가 추가되어 총합 증가. `tsc --noEmit`, `pnpm build`, `pnpm lint` 모두 에러 0. 4개 하단 탭(홈/출퇴근/급여/마이페이지) 및 전체 라우트(`/`, `/attendance`, `/attendance/[date]`, `/pay`, `/pay/[date]`, `/mypage`, `/mypage/profile`) 정상 렌더(빌드 통과로 입증).

---

## 5. 엣지 케이스

| # | 엣지 | 기대 동작 | 관련 AC |
|---|---|---|---|
| E1 | 상세에서 월말(5/31)→다음날 | 6/01로 이동(월 넘김) | AC-2, AC-8 |
| E2 | 상세에서 연말(12/31)→다음날 / 연초(1/1)→이전날 | 다음해 1/1 / 전년 12/31 | AC-3, AC-8 |
| E3 | 윤년 2월 경계(2028-02-28 ↔ 02-29 ↔ 03-01) | 2/29 정상 진입 | AC-4 |
| E4 | 데이터 없는 유효 날짜로 일자 이동 | 404 아님, 빈 상태 문구 + 버튼 계속 동작 | AC-9 |
| E5 | 상세에 **잘못된/존재하지 않는 날짜** URL 직접 진입(예 `2026-05-99`) | 기존대로 `notFound()`(이 동작은 불변 — 일자 이동은 항상 유효일자만 산출하므로 사용자가 직접 잘못된 URL을 칠 때만 발생) | (기존 보존) |
| E6 | 월 picker에서 캘린더 빌드 범위 밖(아주 먼 미래/과거) 월 선택 | §Unresolved Q1 — 범위 정책 결정 필요. 미결 시 picker 노출 범위 자체를 제한해 회피 권고 | AC-13, Q1 |
| E7 | 일자 이동을 빠르게 연속 클릭 | 각 클릭이 다음 경로로 push, race 없이 최종 경로 상세 렌더(no-store fetch 멱등) | AC-6/7 |
| E8 | 상세 직접 딥링크 진입 후 뒤로 | history 없어도 `/attendance`로 결정적 이동 | AC-10 |

---

## 6. 측정 메트릭

| 메트릭 | 정의 | 목표 |
|---|---|---|
| M1 회귀율 | 기존 테스트 실패 수 / 106 | 0% |
| M2 경계 정확도 | shiftDay 경계 테스트(월말/연말/윤년) pass 비율 | 100% |
| M3 빌드 게이트 | tsc·build·lint 에러 수 | 0 |

---

## 7. UX / 디자인 노트

- 상세 헤더: `AppHeader`의 `title`(기존 `formatLongDate`)은 유지. **뒤로(‹)는 헤더 좌측**, **이전/다음 일자 이동은 상세 본문 상단 또는 헤더 우측 right 슬롯**에 배치(architect가 레이아웃 확정). 기존 헤더는 `title`/`right` 슬롯만 제공하므로 좌측 back 배치는 (a) right 슬롯 활용 또는 (b) 헤더 위 별도 바 중 택일 — §Unresolved Q2.
- 월 picker: IMG_3606 "2026년 5월 ▾" = `MonthSelector` orphan과 동형. BottomSheet 시트 내 연/월 리스트(또는 `<select>`) 권장. 메인 컬러 코랄 `#F26B4D`(선택 강조).
- 모바일 단일 컬럼(max-w-md) 레이아웃 준수.

---

## 8. 의존성

- **선행**: 없음(기존 라우트·hook·store 모두 존재). 외부 API·마이그레이션 없음.
- **내부**: S2는 S1(`shiftDay`) 완료 후. S3는 독립.
- **불변 계약**: `/api/attendance/[date]`, `/api/attendance?month=` 응답 스키마·`useDayAttendance`/`useMonthAttendance` 시그니처 무변경.

---

## 9. 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| R1 `MonthSelector` 데모 주석("5월 고정 표기")대로 만들어진 orphan을 동적 라벨로 전환 시 의도 충돌 | 낮음 | label prop은 이미 동적 — 주석만 갱신, 시그니처 무변경 |
| R2 `AttendanceCalendarView` 헤더 라벨 영역 교체 시 ‹ › 화살표 회귀 | 중 | AC-14로 병존 고정, 화살표 핸들러 무변경 |
| R3 일자 이동 무제한 → 의미 없는 빈 날 무한 탐색 | 낮음(UX) | §Q1 범위 정책. 미결 시 graceful 빈 상태로 허용 |
| R4 RSC/client 경계 오염(page.tsx에 use client 침범) | 중 | 라우팅 UI를 client 컴포넌트로 분리, page는 셸 유지 |

---

## 10. Repository Artifacts 갱신 대상

- **CONTEXT.md (도메인 용어집)**: 갱신 **불필요**. 본 task는 순수 내비게이션 확장으로 새 도메인 용어·산정 규칙이 없다(출근상태/근무시간/급여 정의 불변). → 명시적 "도메인 변화 없음" 선언.
- **docs/adr/**: **불필요**. "왜 이걸 골랐는가" 수준의 결정이 1개 이하(뒤로가기를 router.push 고정 목적지로 = 자명, browser-back은 딥링크 비결정). 결정 2개 미만이므로 ADR 남발 금지 원칙에 따라 미작성.
- **운영 메타(.task-orchestrator.yml)**: 변경 없음. protected_files 추가 불요.

---

## 📌 Unresolved Questions (승인자 판단 위임)

- **Q1 (월 picker 범위)** picker가 제공할 월 범위를 어떻게 둘 것인가?
  - (a) **입사월~현재월** (`SEED_JOIN_DATE`=2026-04 ~ 현재월) — 의미 있는 데이터 구간만 노출, 빈 날 탐색 방지. (권고)
  - (b) **자유**(임의 연/월 `<select>`) — 단순하나 빈 달 다수.
  - (c) 시드 데모 범위(2026-05 단일) 고정.
  - → 권고는 (a). 미결 시 developer는 (b) 자유 선택형으로 구현하고 추후 좁히기 가능.
- **Q2 (상세 뒤로 버튼 배치)** 기존 `AppHeader`는 좌측 back 슬롯이 없다. (a) `right` 슬롯에 이동/back 묶기, (b) `AppHeader`에 `left`/`back` prop append, (c) 헤더 위 별도 내비 바. → 시각 우선순위·재사용성 고려해 architect가 §7 노트 기반 확정 권고. (도메인 영향 없음 — 구현 디테일.)
- **Q3 (일자 이동 범위 제한)** 상세 일자 이동도 Q1 범위로 제한할지, 무제한 허용할지. → 권고: **무제한 허용**(AC-9 graceful 빈 상태로 충분, 버튼 비활성화 로직은 복잡도만 증가). 승인자가 제한 원하면 AC 추가.
