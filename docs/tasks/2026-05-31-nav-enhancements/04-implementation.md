# 04-implementation — 출퇴근 내비게이션 확장 구현 노트

- **task**: 2026-05-31-nav-enhancements
- **author**: task-developer
- **mode**: teammate (Notion 미사용 — 본 문서가 단일 산출물)
- **입력**: `01-prd.md`(승인), `02-approval.md`(Q1 입사월~현재월 / Q2 뒤로=래퍼상단·이동=헤더우측 / Q3 무제한), `03-architecture.md`(충실 구현), 기존 코드
- **방식**: TDD(RED→GREEN→REFACTOR, vertical slice), append-only, 회귀 0
- **status**: ✅ DoD 4종 전부 GREEN

---

## AC 충족 매핑

| AC | 구현 위치 | 요약 |
|---|---|---|
| AC-1~5 (shiftDay) | `src/lib/date.ts:62~71`, `src/lib/date.test.ts:49~73` | `new Date(y,m-1,d+delta)` 로컬 정규화 + zero-pad 재조립. shiftMonth 미러. 6케이스(월/연/윤년/항등/포맷) GREEN |
| AC-6 (다음날) | `AttendanceDetailNav.tsx` "다음 날" → `router.push("/attendance/"+shiftDay(date,+1))`; 타이틀 갱신=라우트 재진입으로 page가 formatLongDate 재계산 | 경로 전환 + 본문 재로드(useDayAttendance 재호출) |
| AC-7 (이전날) | 동, "이전 날" → `shiftDay(date,-1)` | |
| AC-8 (월/연 경계) | shiftDay 단일 출처(AC-2/3 검증) | 5/31→6/01, 1/1→전년 12/31 |
| AC-9 (빈 상태 graceful) | `AttendanceDetail`(무변경) — 회귀 고정만 | "근무기록이 없습니다" 빈 상태 + 버튼 계속 동작. 무제한 이동(Q3) |
| AC-10 (뒤로 목적지) | `AttendanceDetailNav.tsx` ‹ → `router.push("/attendance")` | history 무관 결정적 목적지(딥링크 안전) |
| AC-11 (접근성) | `aria-label`: "뒤로"/"이전 날"/"다음 날" `<button>` | |
| AC-12 (라벨 클릭→열림) | `AttendanceCalendarView.tsx` `MonthSelector` onClick → `setPickerOpen(true)` | |
| AC-13 (선택→전환) | `MonthPickerSheet` onSelect → `setMonth(m)`+`setPickerOpen(false)` → MonthlyCalendar 새 month fetch, 라벨 formatMonthLabel 갱신 | |
| AC-14 (화살표 병존) | `AttendanceCalendarView.tsx` ‹›화살표 핸들러(shiftMonth) **불변** | 라벨 span만 MonthSelector로 교체 |
| AC-15 (닫기) | `MonthPickerSheet` BottomSheet onClose → `setPickerOpen(false)`, month 불변 | |
| AC-16 (회귀/DoD) | 전 모듈 append-only | test 116(106+10) / tsc 0 / build OK(7라우트) / lint 0 |

---

## 작업 로그 (시간순, TDD 사이클)

| # | 사이클 | 의도 | 변경 | 검증 |
|---|---|---|---|---|
| 1 | RED→GREEN | shiftDay 순수함수(S1) | `date.ts` shiftDay append + `date.test.ts` 6케이스 | RED: `shiftDay is not a function` → GREEN: 15 pass. 커밋 dbbf6e8 |
| 2 | RED→GREEN | monthsBetween 헬퍼(S3 범위) | `date.ts` monthsBetween append + `date.test.ts` 4케이스 | RED: 4 fail → GREEN: 19 pass. 커밋 6732bd8 |
| 3 | 구현(UI) | AttendanceDetailNav(S2) | 신규 client 래퍼 + `[date]/page.tsx` 마운트 교체(RSC 유지) | tsc/build/lint GREEN |
| 4 | 구현(UI) | MonthPickerSheet + 배선(S3) | 신규 시트 + `AttendanceCalendarView` 라벨 트리거화 + pickerOpen state | test 116 / tsc / build / lint 전부 GREEN. 커밋 39a5bdd |

> 사이클 1·2(순수 로직)는 RED→GREEN→REFACTOR(불요) 완결. 사이클 3·4(라우팅/시트 UI)는 vitest node 환경상 렌더 단위테스트 미지원 → 설계(03 §"검증") 방침대로 tsc/build/lint + 코드 일치로 검증. Horizontal slicing 미사용(AC 단위 vertical slice).

### AC ↔ TDD 사이클 매핑

| AC | 사이클 | 테스트 |
|---|---|---|
| AC-1~5 | 1 | `date.test.ts > shiftDay` (6 it) |
| (S3 범위) | 2 | `date.test.ts > monthsBetween` (4 it) |
| AC-6~16 | 3·4 | 빌드/타입/lint 게이트 (UI 렌더 단위테스트 비지원) |

---

## 자가 검증 (DoD)

| 게이트 | 결과 | 수치 |
|---|---|---|
| `pnpm test` | ✅ | **116 passed** (기존 106 **회귀 0** + 신규 10: shiftDay 6 + monthsBetween 4) |
| `tsc --noEmit` | ✅ | 에러 0 |
| `pnpm build` | ✅ | 성공. app 7라우트(`/`,`/attendance`,`/attendance/[date]`,`/pay`,`/pay/[date]`,`/mypage`,`/mypage/profile`) + API 라우트 전부 생성 |
| `pnpm lint` | ✅ | 에러 0 |

- TDD 사이클: 2(순수 로직 RED→GREEN, 리팩토링 불요 — 둘 다 ≤10줄·0~1중첩)
- Horizontal slicing 여부: ❌ (AC 단위 vertical slice)
- mock: 0 (순수함수 — 시스템 경계 없음)

---

## 경계면 일치 확인

| 경계 | 확인 |
|---|---|
| Nav → 라우트 | `shiftDay` 출력 = 유효 "YYYY-MM-DD" = `[date]` 세그먼트 형식. 정규화 출력은 항상 실존 일자 → `isValidDateString` 통과 |
| Detail → API | `useDayAttendance(date)`·`/api/attendance/[date]` **무변경**(불변 계약) |
| Picker → Calendar | `onSelect`("YYYY-MM") = `MonthlyCalendar` month prop = `/api/attendance?month=` 형식 일치. 무변경 |
| 범위 상수 | `SEED_JOIN_DATE.slice(0,7)`("2026-04") ~ `SEED_MONTH`("2026-05") — constants.ts 직접 import(store 비의존, 하드코딩 회피) |
| AppHeader 시그니처 | **무변경**(title/right 슬롯만 사용, §1.5 결정) → 4개 공유 라우트 회귀 0 |
| RSC/client 경계 | `[date]/page.tsx` 'use client' 침범 없음(RSC 유지). 라우팅/상태는 client 래퍼로만 |

---

## 변경/신규 파일

**신규**
- `src/features/attendance/components/AttendanceDetailNav.tsx` (S2 client 래퍼)
- `src/features/attendance/components/MonthPickerSheet.tsx` (S3 시트)

**수정(append-only)**
- `src/lib/date.ts` (shiftDay, monthsBetween 추가 — 기존 export 불변)
- `src/lib/date.test.ts` (shiftDay 6 + monthsBetween 4 케이스 추가)
- `src/app/attendance/[date]/page.tsx` (AppHeader 인라인 → AttendanceDetailNav 마운트 교체, RSC 유지)
- `src/features/attendance/components/AttendanceCalendarView.tsx` (라벨 span → MonthSelector 트리거 + pickerOpen state + 시트 마운트. ‹›화살표 핸들러 불변)

**무변경 보존**: `AttendanceDetail`, `MonthlyCalendar`, `useAttendance` 훅, route handler, `store.ts`, `AppHeader`(시그니처), `MonthSelector`(시그니처), `BottomSheet`, `constants.ts`.

---

## 설계 이탈 / 미충족 AC

- **설계 이탈**: 없음. 03 §1~§4 결정을 그대로 따름(Q2 뒤로=래퍼상단·이동=헤더우측, AppHeader 무변경, RSC 유지, MonthSelector 재사용, 범위=상수 도출).
- **미충족 AC**: 없음. AC-1~16 전부 충족.

## Repository Artifacts

- **CONTEXT.md**: 갱신 **불요**(PRD §10 — 순수 내비게이션 확장, 새 도메인 용어·산정 규칙 없음. 도메인 무변경 선언).
- **ADR**: 작성 **불요**(PRD §10 — 결정 2개 미만, ADR 남발 금지 원칙).

## 커밋

- `dbbf6e8` feat(date): shiftDay 순수함수 추가 (S1, AC-1~5)
- `6732bd8` feat(date): monthsBetween 헬퍼 추가 (S3 월 picker 범위)
- `39a5bdd` feat(attendance): 상세 일자이동·뒤로 + 월 picker (S2,S3)
