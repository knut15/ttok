# 05-review — 리뷰 보고서 (v1)

- **task**: 2026-05-31-nav-enhancements
- **author**: task-reviewer
- **date**: 2026-05-31
- **mode**: teammate (Notion 미사용 — 본 문서가 단일 산출물)
- **입력**: `01-prd.md`, `02-approval.md`, `03-architecture.md`, `04-implementation.md`, 코드 7개 파일
- **최신 커밋**: 14f8cb0 (브랜치 feat/crewmon-attendance-pay)
- **T5 diff 기준**: 3e152e0(T4 최종) → 14f8cb0

---

## AC 매트릭스

| AC# | 내용 | 충족 증거 | 일치 |
|---|---|---|---|
| AC-1 | `shiftDay("2026-05-29",+1)==="2026-05-30"` / `-1)==="2026-05-28"` | `date.test.ts:53-55` (describe "shiftDay" > "AC-1 같은 달 안에서 ±1") — 116 passed | ✅ |
| AC-2 | 월 경계: `2026-05-31+1=2026-06-01` / `2026-06-01-1=2026-05-31` | `date.test.ts:57-59` (AC-2 월 경계) — 116 passed | ✅ |
| AC-3 | 연 경계: `2026-12-31+1=2027-01-01` / `2026-01-01-1=2025-12-31` | `date.test.ts:61-63` (AC-3 연 경계) — 116 passed | ✅ |
| AC-4 | 윤년 2월 경계(2028-02-28, 2028-03-01) / 비윤년 2026-02-28 | `date.test.ts:65-74` (AC-4 윤년 / 비윤년) — 116 passed | ✅ |
| AC-5 | zero-pad `YYYY-MM-DD` 보존, 부수효과·전역 Date.now 의존 없음 | `date.ts:67-71` 로컬 `new Date(y,m-1,d+delta)` + zero-pad 재조립. `date.test.ts:72` `shiftDay("2026-01-05",-4)==="2026-01-01"` | ✅ |
| AC-6 | 다음 날 버튼 → `/attendance/shiftDay(date,+1)`, 타이틀 갱신 | `AttendanceDetailNav.tsx:41` `router.push(\`/attendance/${shiftDay(date,1)}\`)`. 타이틀 = 라우트 재진입 후 `page.tsx`가 `formatLongDate` 재계산(설계 §2.2 일치) | ✅ |
| AC-7 | 이전 날 버튼 → `/attendance/shiftDay(date,-1)` | `AttendanceDetailNav.tsx:33` `router.push(\`/attendance/${shiftDay(date,-1)}\`)` | ✅ |
| AC-8 | 월/연 경계 이동: 5/31→6/01, 1/1→2025-12-31 | `shiftDay` 단일 출처(AC-2/3 검증 완료). `AttendanceDetailNav.tsx` 동일 함수 호출 | ✅ |
| AC-9 | 데이터 없는 날 graceful(빈 상태 + 버튼 계속 동작, 앱 크래시/404 없음) | `AttendanceDetail` 무변경 보존. `page.tsx:13` `isValidDateString` 통과 시 `notFound()` 미호출. Q3 무제한 승인 | ✅ |
| AC-10 | 뒤로 버튼 → `/attendance` 결정적 목적지(history 무관) | `AttendanceDetailNav.tsx:20` `router.push("/attendance")` — 브라우저 history 무관, 딥링크 안전 | ✅ |
| AC-11 | 뒤로/이전/다음 버튼 `aria-label` 보유 | `AttendanceDetailNav.tsx:19,32,40` — `aria-label="뒤로"`, `aria-label="이전 날"`, `aria-label="다음 날"` 전부 확인 | ✅ |
| AC-12 | 월 라벨 클릭 → picker 열림 | `AttendanceCalendarView.tsx:31-34` `MonthSelector onClick={() => setPickerOpen(true)}` | ✅ |
| AC-13 | picker 월 선택 → 닫힘 + 캘린더 해당 월 전환 + 라벨 갱신 | `AttendanceCalendarView.tsx:57-60` `onSelect={(m)=>{setMonth(m);setPickerOpen(false)}}`. `MonthPickerSheet.tsx:30-48` 목록 렌더 + `onSelect(m)` 콜백 | ✅ |
| AC-14 | ‹ › 화살표 병존(picker 도입 후에도 step 이동 동작) | `AttendanceCalendarView.tsx:26,38` `shiftMonth` 핸들러 불변. T4 base(3e152e0)와 AppHeader/MonthSelector 시그니처 동일 | ✅ |
| AC-15 | picker 배경/닫기 클릭 → 월 변경 없이 닫힘 | `AttendanceCalendarView.tsx:61` `onClose={() => setPickerOpen(false)}`. `MonthPickerSheet.tsx:28` `BottomSheet onClose` 연결. month 상태 불변 | ✅ |
| AC-16 | 회귀 0: 기존 106 GREEN + 신규 추가 + tsc/build/lint 0 | `pnpm test` 116 passed (0 fail). `pnpm tsc --noEmit` 에러 0. `pnpm build` 7라우트 전부 생성. `pnpm lint` 에러 0 | ✅ |

**AC 총계: 16/16**

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 16개
- file:line 증거: 14개 (AC-1~5: date.test.ts:53-74, AC-6~15: 코드 파일 직접 라인 인용)
- test ID 증거: 10개 (describe/it 블록: 116 passed 숫자로 커버)
- commit hash 증거: 0개 (커밋 인용 없음 — file:line으로 대체)
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 16/16 = **100%**

---

## 경계면 검증

### API ↔ Frontend 훅
- `useDayAttendance(date)` 시그니처 무변경 확인. `AttendanceDetailNav`는 route만 전환하고 훅을 직접 호출하지 않음. `AttendanceDetail`(데이터 소유)는 무변경 보존. **일치**.
- `/api/attendance/[date]` 응답 스키마 무변경. T5 diff에 route handler 변경 없음(`git diff 3e152e0..HEAD --name-only` 결과에 API 파일 부재). **일치**.

### Picker → MonthlyCalendar
- `MonthPickerSheet.onSelect` 반환값 = `"YYYY-MM"`. `AttendanceCalendarView.setMonth(m)` = `useState<string>(SEED_MONTH)`. `MonthlyCalendar month` prop = `"YYYY-MM"`. `/api/attendance?month=` 형식 그대로. **일치**.

### 범위 상수 경계
- `SEED_JOIN_DATE = "2026-04-01"` (constants.ts:28). `.slice(0,7)` = `"2026-04"`. `SEED_MONTH = "2026-05"` (constants.ts:24). `monthsBetween("2026-04","2026-05")` = `["2026-04","2026-05"]`. Q1 승인 지침(입사월~현재월) **일치**.

### AppHeader ↔ 공용 시그니처 불변
- T4 base(3e152e0)와 현재 `AppHeader.tsx` 완전 동일(`brand?/title?/right?` 3 props). **일치**. 4개 공유 라우트 회귀 없음.

### MonthSelector ↔ 공용 시그니처 불변
- T4 base(3e152e0)와 현재 `MonthSelector.tsx` 완전 동일(`label/onClick?`). **일치**.

### RSC/client 경계
- `src/app/attendance/[date]/page.tsx` — `"use client"` 없음(확인). `isValidDateString`, `notFound()`, `AttendanceDetailNav`, `AttendanceDetail` 마운트만. RSC 유지. **일치**.
- `AttendanceDetailNav.tsx:1` `"use client"`. `MonthPickerSheet.tsx:1` `"use client"`. `AttendanceCalendarView.tsx:1` `"use client"`. **모두 일치**.

---

## 빌드/테스트 결과

| 게이트 | 결과 | 수치 |
|---|---|---|
| `pnpm test` | ✅ PASS | **116 passed, 0 failed**, 15 test files |
| `tsc --noEmit` | ✅ PASS | 에러 0 (빌드 시 TypeScript 확인 포함) |
| `pnpm build` | ✅ PASS | 7라우트 전부 생성(`/`,`/attendance`,`/attendance/[date]`,`/pay`,`/pay/[date]`,`/mypage`,`/mypage/profile`) + API 라우트 |
| `pnpm lint` | ✅ PASS | 에러 0 |

**회귀 확인**: 기존 106 테스트 회귀 0. 신규 10개(shiftDay 6 + monthsBetween 4) 추가. 총 116 GREEN.

### 신규 테스트 분포
- `shiftDay` describe: 6 it (AC-1/2/3/4(윤년)/4(비윤년)/5 — 경계 전수 커버)
- `monthsBetween` describe: 4 it (데모 범위, 단일 월, 연 경계 횡단, 역전 방어)

---

## 🤝 교차 검증 (codex review)

- 자체 판정(하네스축): PASS
- codex 호출: `codex review --base 3e152e0` (OpenAI Codex v0.135.0, model: gpt-5.5, sandbox: read-only)
- 호출 시각: 2026-05-31T08:04:59Z
- codex 판정: **PASS**
- codex 출력 요약: "No actionable regressions were found. The navigation additions preserve the existing RSC/client boundaries, the month picker uses the approved seeded range, and the new date helpers cover the required boundary cases."
- P1 finding: 0개
- P2 finding: 0개
- P3(경미) finding: 0개
- 최종 결정: **PASS 확정** (하네스축 PASS AND 코드축 PASS, gate_mode=and 충족)

불일치 없음 — `cross_verify_log.jsonl` 기록 없음.

---

## 설계 3중 매핑 매트릭스 (PRD AC ↔ 설계 § ↔ 코드)

| PRD AC | 설계 §(03-architecture) | 코드 파일:라인 |
|---|---|---|
| AC-1~5 (shiftDay) | §1.1 `date.ts` append / §2.1 계약 / §3.1 의사코드 | `date.ts:67-71` / `date.test.ts:52-75` |
| AC-6~8 (일자 이동) | §1.1 `AttendanceDetailNav` / §2.2 데이터 흐름 | `AttendanceDetailNav.tsx:33,41` |
| AC-9 (graceful) | §1.1 "AttendanceDetail 불변" / §2.2 "없으면 빈 상태" | `AttendanceDetail` 무변경 / `page.tsx:13` |
| AC-10 (뒤로 목적지) | §1.5 Q2 결정 "래퍼 상단 뒤로" / §2.2 `router.push("/attendance")` | `AttendanceDetailNav.tsx:20` |
| AC-11 (aria-label) | §4 접근성 명세 | `AttendanceDetailNav.tsx:19,32,40` |
| AC-12 (라벨→열림) | §1.4 MonthSelector 재사용 / §2.3 `setPickerOpen(true)` | `AttendanceCalendarView.tsx:31-34` |
| AC-13 (선택→전환) | §2.3 `onSelect(m)→setMonth(m)+setPickerOpen(false)` | `AttendanceCalendarView.tsx:57-60` / `MonthPickerSheet.tsx` |
| AC-14 (화살표 병존) | §1.3 "화살표 핸들러 불변" / §2.3 "‹›setMonth shiftMonth 그대로" | `AttendanceCalendarView.tsx:26,38` |
| AC-15 (닫기) | §2.3 `onClose→setPickerOpen(false)` | `AttendanceCalendarView.tsx:61` |
| AC-16 (회귀/DoD) | §1.7 commands / §4 "회귀 없음" | 빌드 로그 전부 GREEN |

---

## 프로젝트 자원 검증 (AC-Proj)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Proj-1 | 컨벤션 준수 | `"use client"` 선두, PascalCase 컴포넌트, `src/features/attendance/components/` 배치, RSC page 유지. ✅ |
| AC-Proj-2 | PRD §3 명시 자원 활용 | `shiftMonth` 미러링(shiftDay), `MonthSelector` orphan 재사용, `BottomSheet` 재사용, `AppHeader` right 슬롯 활용, `next/navigation useRouter`. 전부 확인. ✅ |
| AC-Proj-3 | project_skills 적합 스킬 활용 | `formatMonthLabel`, `formatLongDate`, `isValidDateString` 기존 함수 재사용. 직접 재작성 없음. ✅ |

## 구조 준수 검증 (AC-Struct)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Struct-1 | 신규 파일 배치 | `AttendanceDetailNav.tsx`, `MonthPickerSheet.tsx` → `src/features/attendance/components/`. 설계 §1.1 및 `ai_suggested_placements` 일치. ✅ |
| AC-Struct-2 | 폴더 책임 침범 금지 | `src/lib/date.ts`(순수함수), `src/features/`(도메인 UI), `src/app/`(RSC 셸). 역참조 없음. ✅ |
| AC-Struct-3 | user_notes 규칙 준수 | append-only 원칙 준수. `AttendanceDetail`/store/API/훅 무변경. ✅ |

## Repository Artifacts 검증 (AC-Repo)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Repo-1 | CONTEXT.md 갱신 | PRD §10 "해당 없음" 선언(순수 내비게이션 확장, 새 도메인 용어 없음). 자동 통과. ✅ |
| AC-Repo-2 | ADR 작성 | PRD §10 "해당 없음"(결정 2개 미만). 자동 통과. ✅ |
| AC-Repo-3 | 갱신 시점 적절성 | CONTEXT.md/ADR 갱신 불요 선언이므로 해당 없음. ✅ |

---

## 최종 판정

**판정: PASS**

- AC: **16/16** 충족
- 회귀: **0** (기존 106 테스트 전부 GREEN)
- 테스트 총계: **116 passed, 0 failed**
- tsc: **에러 0**
- build: **OK** (7 app 라우트 + API)
- lint: **에러 0**
- codex 교차검증(코드축): **PASS** — P1/P2 finding 없음
- gate_mode=and: 하네스축 PASS AND 코드축 PASS = **PASS 확정**
- 경계면: 전 항목 일치 (AppHeader/MonthSelector 시그니처 불변, RSC 경계 보존, API/훅 무변경)

**사유**: AC 16개 전부 코드 라인/테스트 ID로 정량 증거 확보. shiftDay 경계(월말/연말/윤년) 단위 테스트 GREEN. 뒤로/이전/다음 라우팅 설계 그대로 구현. 월 picker Q1 입사월~현재월 범위를 constants.ts 상수에서 도출(하드코딩 없음). T4 공용 컴포넌트(AppHeader, MonthSelector) 시그니처 무변경. RSC 경계 보존. codex(gpt-5.5)도 동일 판정.

**회귀 지점**: 없음 (종료 — Done)

---

## Follow-up (P2, 비차단)

이번 PASS와 무관한 개선 후보. 별도 task 판단 위임.

| 우선순위 | 항목 | 비고 |
|---|---|---|
| P2 | 월 picker 범위를 실제 `storeInfo.joinDate`(서버)에서 동적으로 도출 | 현재 `SEED_JOIN_DATE` 정적 상수. 데모 범위에서는 동작하나, 다수 매장·실 데이터 시 불일치 가능 |
| P2 | `AttendanceDetailNav`에 "현재 달 범위 밖" 시 이전/다음 비활성화 UI | Q3 무제한 허용이나 빈 날 무한 탐색 UX 개선 후보(E3/R3) |
| P2 | `MonthPickerSheet` 목록 최신월 먼저(내림차순) 정렬 옵션 | 현재 오름차순. 사용자가 가장 최근 달을 자주 선택 시 유리 |
| P3 | `AttendanceDetailNav` `‹` 문자 대신 SVG 아이콘으로 교체 | 현재 텍스트 문자. 다른 라우트 아이콘과 일관성 |
