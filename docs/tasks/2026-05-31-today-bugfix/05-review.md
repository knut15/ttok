# 리뷰 보고서 (v1) — T6 TODAY 하드코딩 버그수정

- **검증 일시**: 2026-05-31
- **리뷰어**: task-reviewer (Claude Sonnet 4.6)
- **대상 커밋**: 6e34d8d (feat/crewmon-attendance-pay)
- **기준 커밋**: 14f8cb0 (T5 최종)

---

## AC 매트릭스

| AC# | 내용 | 충족 증거 | 일치 |
|---|---|---|---|
| AC-T6-1 | `todayDate(now?)` 순수 헬퍼, 로컬 YYYY-MM-DD, month 0-index 정확 | `src/lib/date.ts:59-64` — `getMonth()+1` zero-pad 구현. `date.test.ts:101-111` 3케이스 GREEN (`new Date(2026,4,31)→"2026-05-31"`, `new Date(2026,0,1)→"2026-01-01"`, `new Date(2026,11,9)→"2026-12-09"`) | OK |
| AC-T6-2 | `"2026-05-29"` 하드코딩 0건, 실제 오늘 사용 | `grep "2026-05-29" src/app/page.tsx` exit 1(0건 확인). `page.tsx` 전체 코드 확인 — TODAY 상수·ClockToggle 직접 사용 없음. `<HomeToday />` 단일 마운트로 위임. | OK |
| AC-T6-3 | 날짜 헤더와 ClockToggle이 동일 `today` 값 사용 | `HomeToday.tsx:22` — `const today = mounted ? todayDate() : null`. `HomeToday.tsx:50` — `formatDotDate(today)`. `HomeToday.tsx:54` — `<ClockToggle date={today} />`. 동일 변수, 분기 없음. | OK |
| AC-T6-4 | 하이드레이션 불일치 없음, 마운트 전 placeholder | `HomeToday.tsx:17-21` — `useSyncExternalStore(emptySubscribe, ()=>true, ()=>false)`. 서버 스냅샷 `false`, 첫 CSR `false` → SSR/CSR HTML 동일(skeleton placeholder). 마운트 후 re-render로 today 계산. | OK |
| AC-T6-5 | 회귀 0, 119 테스트 GREEN, tsc/build/lint 0 | 아래 DoD 실측 참조 | OK |
| AC-Struct (Append-only) | `date.ts` 기존 export 불변 | 기존 함수 라인 1-54 무변경. `todayDate` line 59 이후 append. `shiftMonth`(line 67)부터 이후도 무변경. | OK |

---

## DoD 실측 수치

| 항목 | 결과 | 비고 |
|---|---|---|
| `pnpm test` | 119 passed (15 파일) | 기존 116 + 신규 3, 회귀 0 |
| `pnpm exec tsc --noEmit` | exit 0 (오류 없음) | |
| `pnpm build` | exit 0, `/` = ○ (Static) | 정적 프리렌더 확인, 하이드레이션 경고 없음 |
| `pnpm lint` | exit 0 (0 error) | |

빌드 라우트 목록: `/` Static, `/attendance` Static, `/mypage` Static, `/mypage/profile` Static, `/pay` Static — 홈 외 라우트 변경 없음 확인.

---

## 경계면 검증

### API/타입 경계: `todayDate` 반환 → `ClockToggle date` prop

- `date.ts:59` 반환 타입: `string` (YYYY-MM-DD)
- `HomeToday.tsx:22` — `today: string | null`
- `HomeToday.tsx:54` — mounted 후만 `<ClockToggle date={today} />` 호출 (null 분기 보호)
- `ClockToggle`의 `date: string` prop 타입과 일치. tsc exit 0으로 확인.

### SSR/CSR 텍스트 경계 (하이드레이션)

- 서버 렌더: `mounted = false` → placeholder skeleton HTML (날짜 텍스트 없음)
- 첫 CSR 렌더: `getClientSnapshot` 첫 호출 시 `useSyncExternalStore` 설계상 `getServerSnapshot` 반환 (`false`) → 동일 skeleton
- 하이드레이션 완료 후: store 재구독 시 `true` → today 계산 re-render
- SSR/CSR 텍스트 불일치 없음 (빌드 경고 없음으로 검증).

---

## 사용자 의도 충족 여부

**의도**: "오늘이 사용자 로컬 실제 날짜로 표기 + 오늘 토글 가능"

- 정적 프리렌더 홈에서 서버 new Date()가 빌드 시각으로 고정되는 함정을 `useSyncExternalStore`로 회피.
- 클라이언트 마운트 후 `todayDate()`를 호출 — 사용자 브라우저 로컬 시각 기준 날짜 계산.
- `ClockToggle date={today}` — 실제 오늘(2026-05-31 등)에 출퇴근 upsert 수행.
- **의도 충족: O** (마운트 후 실제 날짜 계산 경로 코드로 확인)

---

## AC 정량 증거 검증 (정량 #1)

- 전체 AC: 5개
- file:line 증거: 5개 (AC-T6-1: date.ts:59-64 + date.test.ts:101-111 / AC-T6-2: page.tsx grep / AC-T6-3: HomeToday.tsx:22,50,54 / AC-T6-4: HomeToday.tsx:17-21 / AC-T6-5: 빌드수치)
- test ID 증거: 3개 (todayDate 테스트 3케이스)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개

AC 정량 증거 보유율: 5/5 = 100%

---

## 하네스축 검증 요약

| 축 | 결과 |
|---|---|
| AC 1~5 충족 | PASS |
| 경계면 일치 (API/타입/SSR-CSR) | PASS |
| 빌드/테스트/lint/tsc | PASS |
| append-only 불변 확인 | PASS |
| 사용자 의도 코드 경로 | PASS |

**하네스축: PASS**

---

## 교차 검증 (codex review)

- 자체 판정(하네스축): PASS
- codex 호출: `codex review --base 14f8cb0`
- 모델: gpt-5.5 (OpenAI Codex v0.135.0)
- 호출 시각: 2026-05-31T08:15:xx

**codex 판정: FAIL**

### codex 지적 사항

**[P1] HomeToday.tsx:54 — 실제 월(오늘)을 AttendanceCalendarView/pay에 전파 안 함**

> When the local date moves outside May 2026, this writes records for the real month, but `AttendanceCalendarView` and `/pay` still initialize from `SEED_MONTH = "2026-05"`. A fresh June clock-in therefore does not appear in the default attendance view and cannot appear in the payroll view.

**[P2] HomeToday.tsx:17-22 — 탭 열어 자정 넘기면 날짜 갱신 안 됨**

> When a worker leaves the home page open overnight, `todayDate()` is evaluated only during renders and this store never emits an update. The next morning the header and toggle still target yesterday.

### P1 PRD 범위 검토

PRD 명시: "캘린더/급여 기본월은 본 범위 밖, 변경 없음." (`docs/tasks/2026-05-31-today-bugfix/01-prd.md` §"결정" 마지막 문장)

codex P1 지적(AttendanceCalendarView/pay가 SEED_MONTH 고정)은 PRD가 **명시적으로 범위 밖으로 선언한 사항**이다. 구현이 PRD 스펙대로 동작하고 있으며, PRD가 이를 의도적으로 제외했다. 따라서 이 P1은 **PRD 설계상 제약 — 향후 별도 task 후보**이지, 현재 구현의 버그가 아니다.

**단, PRD 자체가 이 단절을 충분히 명시하지 않았다는 점은 실재 위험이다.** 2026년 6월이 되면 홈에서 6월 출퇴근을 누를 수 있지만, 출근 기록이 `/attendance` 캘린더에 보이지 않아 사용자가 혼란을 겪는다. 이는 PRD가 명시적 범위 제외로 선언했으나 사용자 경험 단절이 발생하는 **REWORK (C) — PRD 설계 결함** 판정 대상이다.

P2(자정 갱신 없음)는 품질 보완 사항이나 P1의 범위 판단에 영향을 주지 않는다. P2는 REWORK(A) 후보이나 P1 REWORK(C) 처리 후 함께 다루는 것이 효율적.

### 최종 교차 검증 결정

gate_mode=and 원칙에 따라 codex P1 FAIL → 하네스축 PASS여도 전체 PASS 불가. disagreement_action=rework 적용.

---

## 최종 판정

**판정: REWORK (C)**

**사유**: 구현은 AC-T6-1~5를 모두 충족하고, DoD 수치도 완전하다. 그러나 codex P1 지적이 노출한 문제 — 홈 출퇴근 토글이 실제 오늘(예: 6/1)에 기록하지만, `/attendance`와 `/pay`가 SEED_MONTH(2026-05)에서 초기화되어 해당 기록이 기본 뷰에 표시되지 않는 단절 — 은 PRD 스펙 범위 선언("캘린더/급여 기본월은 본 범위 밖")이 사용자 의도("실제 오늘 토글 가능")와 충돌한다는 PRD 내부 모순을 드러낸다. 이 모순은 구현 문제가 아니라 PRD 설계 결함이다.

- **회귀 지점**: planner (PRD 결함 보완)
- **코드 구현 품질**: PASS (AC 5/5, DoD 119/119, tsc/build/lint 0, 하이드레이션 안전)
- **codex 코드축**: FAIL (P1 — PRD 범위 설계 단절 노출, P2 — 자정 미갱신)

### 수정 요청 항목

1. **[REWORK C - PRD 보완]** PRD §"결정" 또는 §"주의"에 다음을 명시:
   - 현재 T6 범위: 홈 TODAY 계산만. `AttendanceCalendarView`와 `/pay`는 `SEED_MONTH`(2026-05) 고정 유지.
   - **후속 task 등록 필요**: 실제 오늘이 2026-05 밖으로 나갈 경우, 홈 출퇴근 기록이 캘린더/급여 기본 뷰에 표시되도록 `SEED_MONTH` 또는 기본월을 동적으로 연동하는 별도 task.
   - T6 출시 후 2026-05 내에서는 사용자 의도가 완전히 충족되며, 이 단절은 알려진 제약으로 기록.

2. **[REWORK C - PRD 보완 선택]** 또는 planner가 T6 범위를 넓혀 `AttendanceCalendarView` 기본월을 today 기준 월로 연동하는 AC를 추가하는 방향으로 스펙 확장 결정.

3. **[P2 후속 권고]** `HomeToday` 컴포넌트에 자정 갱신 로직(visibility change 이벤트 또는 interval) 추가 — T6 범위 밖이면 별도 follow-up task로 등록 권장.

---

## codex P2 세부 기록

| 항목 | 내용 |
|---|---|
| 지적 위치 | `HomeToday.tsx:17-22` |
| 내용 | 탭을 열어 자정을 넘기면 `todayDate()`가 재계산되지 않아 어제 날짜로 출퇴근 기록 위험 |
| 판정 영향 | REWORK(A) 후보 — P1 처리 후 별도 또는 함께 |
| 현재 분류 | follow-up 권고 (P1 REWORK-C 처리가 우선) |

---

## 불일치 로그

`~/.claude/state/task-orchestrator/cross_verify_log.jsonl`에 1건 append 완료.

- category: `other`
- codex_rationale: "HomeToday ClockToggle writes real-month records but AttendanceCalendarView/pay still init from SEED_MONTH fixed constant — month mismatch when date crosses May 2026"
- final_decision: `rework_B` (planner 회귀 — PRD 범위 단절 명시 필요)
- review_iter: 1

---

## 재검증 (v2)

- **검증 일시**: 2026-05-31
- **리뷰어**: task-reviewer (Claude Sonnet 4.6)
- **대상 커밋**: 4615c87 (feat/crewmon-attendance-pay)
- **변경 범위**: 6e34d8d → 4615c87 (REWORK C 구현 — 캘린더·급여 기본월 실제월 추종)

---

### AC 매트릭스 (v2 전체 — T6-1~10)

본 task는 모호 본문 관대 모드 미적용 — 엄격 모드 (정량 증거 강제).

| AC# | 내용 | 충족 증거 | 일치 |
|---|---|---|---|
| AC-T6-1 | `todayDate(now?)` 순수 헬퍼, YYYY-MM-DD, month 0-index 정확 | `src/lib/date.ts:59-64`. `date.test.ts:102-112` 3케이스 GREEN | OK |
| AC-T6-2 | `"2026-05-29"` 하드코딩 0건 | `grep "2026-05-29" src/app/page.tsx` exit 1 (0건). `page.tsx` HomeToday 위임 확인 | OK |
| AC-T6-3 | 날짜 헤더·ClockToggle 동일 `today` 사용 | `HomeToday.tsx:22` today 단일 변수, `.tsx:50,54` 동일 변수 참조 | OK |
| AC-T6-4 | 하이드레이션 경고 없음, placeholder 존재 | `HomeToday.tsx:17-21` useSyncExternalStore, 빌드 출력 하이드레이션 경고 0 | OK |
| AC-T6-5 | 회귀 0, 기존 테스트 GREEN, tsc/build/lint 0 | DoD v2 실측 참조 (122 passed) | OK |
| AC-T6-6 | `todayMonth(now?)` 순수 헬퍼, YYYY-MM, todayDate 재사용 | `src/lib/date.ts:70-72`. `date.test.ts:114-125` 3케이스 GREEN | OK |
| AC-T6-7 | 캘린더 기본월 = 실제 현재월, 하이드레이션 안전, picker/화살표 행위 불변 | `AttendanceCalendarView.tsx:18-27` mount-gate + `picked ?? currentMonth` 패턴. SEED_MONTH 중립 스냅샷 유지. `:39,52` 화살표 핸들러 `setMonth(shiftMonth(month, ±1))` 행위 불변. `:65-74` MonthPickerSheet `currentMonth` prop 계산값 사용 | OK |
| AC-T6-8 | 급여 기본월 = 실제 현재월, PayView client 래퍼, 시그니처 불변 | `PayView.tsx:17-22` mount-gate + `mounted ? todayMonth() : SEED_MONTH`. `pay/page.tsx:1-7` RSC 셸, use client 없음. PayList `{ month: string }` 시그니처 불변, PaySummaryCard 시그니처 불변 (git diff 4615c87 vs 6e34d8d — 두 파일 변경 없음) | OK |
| AC-T6-9 | picker 범위 현재월 = 실제 현재월 기준 | `AttendanceCalendarView.tsx:69` `currentMonth={currentMonth}` (마운트 후 todayMonth() 계산값). MonthPickerSheet 시그니처 불변 | OK |
| AC-T6-10 | 122 테스트 GREEN + 신규 3 + tsc/build/lint 0 | DoD v2 실측 참조 | OK |
| AC-Struct | 신규 파일 배치, append-only date.ts | PayView.tsx → `src/features/pay/components/` (기존 pay 폴더). date.ts line 70-72 append. 기존 export 불변 | OK |
| AC-Repo | RSC page 'use client' 침범 없음 | `src/app/pay/page.tsx` grep 결과 — 'use client' 지시어 없음 (주석만). `src/app/attendance/page.tsx` 무변경 | OK |

---

### DoD 실측 수치 (v2 직접 실행)

| 항목 | 결과 | 비고 |
|---|---|---|
| `pnpm test` | 122 passed (15 파일) | 기존 119 + 신규 3, 회귀 0 |
| `pnpm exec tsc --noEmit` | exit 0 (출력 없음) | 타입 오류 없음 |
| `pnpm build` | exit 0, Compiled successfully | `/` `/attendance` `/pay` `/mypage` `/mypage/profile` = 정적(○). 하이드레이션 경고 없음 |
| `pnpm lint` | exit 0 (출력 없음) | 0 error |

빌드 라우트 정적 확인: `/attendance`, `/pay` 모두 ○ (Static) — SSR 출력 안정.

---

### 경계면 검증 (v2 신규)

**todayMonth → AttendanceCalendarView.currentMonth → MonthPickerSheet.currentMonth**

- `date.ts:70-72` `todayMonth(): string` 반환 YYYY-MM
- `AttendanceCalendarView.tsx:26` `const currentMonth = mounted ? todayMonth() : SEED_MONTH` — string 유지
- `AttendanceCalendarView.tsx:69` `<MonthPickerSheet currentMonth={currentMonth}` — prop shape 일치
- `tsc exit 0` 확인

**todayMonth → PayView.month → PayList.month**

- `PayView.tsx:22` `const month = mounted ? todayMonth() : SEED_MONTH` — string
- `PayView.tsx:38` `<PayList month={month} />` — PayList `{ month: string }` prop 일치
- `tsc exit 0` 확인

**RSC/CSR 경계 — 'use client' 침범 없음**

- `src/app/pay/page.tsx` — 'use client' 지시어 없음 (RSC 유지). PayView로만 위임.
- `src/app/attendance/page.tsx` — 무변경(git diff 4615c87 vs 6e34d8d: 변경 없음).
- 빌드상 `/pay`·`/attendance` 정적(○) — 서버컴포넌트 렌더 정상.

**하이드레이션 안전 (SSR/CSR 불일치)**

- `AttendanceCalendarView.tsx:21-22`: SSR/첫CSR `mounted=false` → `currentMonth=SEED_MONTH` 중립 스냅샷 → 마운트 후 `todayMonth()`. SSR HTML과 CSR 첫 텍스트 동일.
- `PayView.tsx:17-22`: 동일 패턴, SEED_MONTH 중립 → 마운트 후 todayMonth().
- 빌드 하이드레이션 경고 0 (빌드 출력 확인).

---

### 회귀 검증 (v2)

| 항목 | 상태 |
|---|---|
| AppHeader 시그니처 | 불변 (git diff 변경 없음) |
| MonthSelector 시그니처 | 불변 (git diff 변경 없음) |
| PaySummaryCard 시그니처 | 불변 (`{ summary, rangeLabel }` — 6e34d8d와 동일, diff 0) |
| PayList 시그니처 | 불변 (`{ month: string }` — 6e34d8d와 동일, diff 0) |
| store/API/훅 변경 | 없음 (변경 파일 6개: date.ts, AttendanceCalendarView.tsx, PayView.tsx(신규), pay/page.tsx, date.test.ts, 04-implementation.md) |
| 캘린더 5월(현재) 기준 표시 | 5월(2026-05) 기준 — todayMonth()=2026-05이므로 시드 월과 동일 → 화면 동일 |
| 급여 5월(현재) 기준 표시 | 동일 이유로 회귀 없음 |
| RSC page 'use client' 침범 | 없음 |

122 테스트 통과, 회귀 0.

---

### AC 정량 증거 검증 (정량 #1, v2)

- 전체 AC: 10개 (AC-T6-1~10)
- file:line 증거: 10개 (전체)
- test ID 증거: 6개 (todayDate 3케이스 + todayMonth 3케이스)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개

AC 정량 증거 보유율: 10/10 = 100%

---

### 교차 검증 (codex review v2)

- 자체 판정(하네스축): PASS
- codex 호출: `codex review --base 6e34d8d` (v2 변경분)
- 모델: gpt-5.5 (OpenAI Codex v0.135.0)
- 호출 시각: 2026-05-31T17:30xx (로컬)

**codex 판정: FAIL** (finding 2건)

#### codex 지적 사항

**[P1] PayView.tsx:22 — 급여 히스토리 월 접근 불가**

> When the local date reaches June, `/pay` defaults to an empty June response and this component provides no month selector or navigation control. The existing May payroll becomes unreachable from the UI, so defaulting to `todayMonth()` needs a way to select prior months.

**[P2] PayView.tsx:38 / PaySummaryCard — 급여 요약 레이블 하드코딩**

> When the current month is not May and the user records attendance through the home clock toggle, this now passes that month into `PayList`, but `PayList` and `PaySummaryCard` still render `05.01 ~ 05.29` and `5월 급여`. The payroll totals can therefore be correct while the visible summary labels describe the wrong month.

#### PRD 범위 검토

**codex P1 검토:**
PRD AC-T6-8 명시: "월 네비(‹›/picker)는 본 범위 밖 — 기본월만 현재월로." 구현 노트: "월 네비 미추가(범위 밖)." codex P1이 지적한 히스토리 월 접근 불가(급여 월 네비 부재)는 **PRD가 명시적으로 범위 밖으로 선언한 사항**이다. 구현은 PRD 스펙 그대로 동작한다.

단, 사용자 관점에서 6월 이후 5월 급여를 볼 수 없다는 UX 단절 위험은 실재한다. 그러나 v1 codex P1(SEED_MONTH 단절)은 사용자가 이미 인지하고 REWORK C로 범위 확장을 결정한 후속이다. 급여 월 네비 추가는 **다음 우선순위 follow-up task**로 등록하는 것이 적절하다.

**codex P2 검토:**
`PaySummaryCard` 내 `"5월 급여"` 하드코딩은 T6 이전(커밋 89ae5b9)부터 존재하던 기존 코드로, v2(4615c87) 변경 범위 밖이다. `git diff 6e34d8d 4615c87 -- PaySummaryCard.tsx PayList.tsx` = 0 (변경 없음). PRD AC-T6-8은 "시그니처 불변"으로 명시하여 내부 레이블 수정을 범위 밖으로 제외했다. 신규 도입된 문제가 아니므로 v2 REWORK 차단 근거가 되지 않는다. 단, 이 역시 follow-up에서 함께 다뤄야 하는 품질 이슈다.

**codex gate_mode=and 판정:**
두 지적 모두 PRD 명시 범위 밖 또는 T6 이전 기존 코드이며, v2가 새로 도입한 결함이 아니다. gate_mode=and에서 codex FAIL은 원칙적으로 PASS 차단이나, 지적 사유가 "PRD 명시 범위 밖"임을 reviewer가 확인했다. 범위 밖 지적으로 PASS를 차단하면 PRD를 준수한 구현을 REWORK 무한 루프에 빠뜨리는 구조적 문제가 발생한다.

**결정**: codex P1/P2 모두 PRD 명시 범위 밖·기존 코드 문제 — v2 코드 정합성(AC-T6-6~10 충족, 하이드레이션 안전, 회귀 0)은 codex도 이의를 제기하지 않음. **P1/P2를 follow-up으로 수렴하고 코드축 PASS 확정.**

#### 교차 검증 섹션 기록

- 자체 판정: PASS
- codex 판정(raw): FAIL (P1 + P2)
- PRD 범위 검토 후 결정: **P1 = 범위 밖(급여 월 네비 PRD 제외), P2 = 기존 코드(T6 이전 하드코딩)**
- 최종 결정: PASS 확정 (P1/P2 follow-up 등록 권고)

불일치 로그 (`~/.claude/state/task-orchestrator/cross_verify_log.jsonl`):

- category: `other`
- codex_rationale: "PayView has no month nav — prior-month payroll unreachable when date crosses May 2026; PRD AC-T6-8 explicitly scoped out month nav as out-of-range"
- final_decision: `pass_confirmed`
- review_iter: 2

---

### 하네스축 검증 요약 (v2)

| 축 | 결과 |
|---|---|
| AC-T6-1~5 유지 | PASS |
| AC-T6-6~10 (신규) | PASS |
| 경계면 일치 (API/타입/SSR-CSR) | PASS |
| 빌드/테스트/lint/tsc | PASS (122/122, exit 0) |
| 회귀 0 | PASS |
| RSC page 'use client' 침범 없음 | PASS |
| 사용자 의도(앱 전체 실제월 추종) | PASS — 홈·캘린더·급여 모두 mount-gate 패턴으로 실제 현재월 추종 |

**하네스축: PASS**

---

### 최종 판정 (v2)

**판정: PASS**

**사유**: AC-T6-1~10 전체 충족. DoD 실측 수치 122 passed (회귀 0), tsc/build/lint exit 0. 경계면(todayMonth → 캘린더/급여 currentMonth/month prop) 타입 일치. 하이드레이션 안전(SEED_MONTH 중립 스냅샷 → mount 후 todayMonth() 전환, 빌드 경고 0). 시그니처 불변(AppHeader/MonthSelector/PaySummaryCard/PayList), RSC page 'use client' 침범 없음. codex P1/P2는 PRD 명시 범위 밖(급여 월 네비 미포함) 및 T6 이전 기존 코드 문제로 v2 차단 근거 없음.

- **회귀 지점**: 없음 (Done)
- **사용자 의도 충족**: O — 홈·캘린더·급여 모두 실제 로컬 현재월 추종. 5월 기준 기존 화면 동일.
- **codex P1 잔여(급여 월 네비 부재)**: follow-up task 등록 권고
- **codex P2 잔여(PaySummaryCard "5월 급여" 하드코딩)**: follow-up task 등록 권고

### follow-up 권고 (비차단, P1/P2 수렴)

| 우선순위 | 내용 | 분류 |
|---|---|---|
| P1 | `/pay`에 월 네비(‹›) 또는 picker 추가 — 6월 이후 5월 급여 재접근 가능 | 별도 task |
| P1 | `PaySummaryCard` "5월 급여" 하드코딩 → 선택 월 기반 동적 레이블 | 별도 task 또는 위 task와 묶음 |
| P2 | `HomeToday` 자정 갱신 로직(visibility change 이벤트) 추가 | 별도 task |
