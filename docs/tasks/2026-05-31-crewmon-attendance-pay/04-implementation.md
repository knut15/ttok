# 🛠 구현 노트 (v1) — Crewmon 출퇴근·급여 웹앱

- **구현**: task-developer (139 tool_uses 후 API Overloaded 중단 — 코드/테스트는 완성, 본 노트·최종 보고만 오케스트레이터가 마감)
- **검증 실행**: orchestrator (2026-05-31, DoD 4종 직접 실행)
- **운영 모드**: teammate

> ⚠️ developer 에이전트가 마지막 보고 직전 API 과부하로 중단됨. 실제 레포 산출물은 완성 상태였고, 오케스트레이터가 DoD 명령을 직접 재실행하여 결과를 아래에 기록함.

## DoD 검증 결과 (오케스트레이터 직접 실행)

| 명령 | 결과 |
|---|---|
| `pnpm test` | ✅ **36 passed** (10 test files), 193ms |
| `pnpm exec tsc --noEmit` | ✅ exit 0 (타입 에러 0) |
| `pnpm lint` | ✅ exit 0 |
| `pnpm build` | ✅ 성공 — 11개 라우트 컴파일 (/, /attendance, /pay 정적; api·[date] 동적) |

## Sub-task 진행

| ST | 내용 | 상태 |
|---|---|---|
| ST-1 | 도메인 타입(`src/types/index.ts`) + 계산 util(`lib/time.ts`,`lib/pay.ts`,`lib/date.ts`) + 테스트 | ✅ |
| ST-2 | 인메모리 store(`lib/store.ts`) + 시드(`lib/seed.ts`) + API route 6종 + route 테스트 | ✅ |
| ST-3 | 디자인 시스템(`globals.css` @theme 코랄) + 셸(`layout.tsx`) + 공용 UI 7종(`components/`) | ✅ |
| ST-4 | 홈(`app/page.tsx`) + 출퇴근 토글(`features/attendance/.../ClockToggle.tsx`) | ✅ |
| ST-5 | 캘린더(`MonthlyCalendar`,`CalendarCell`) + 상세(`AttendanceDetail`) + 상태변경 바텀시트(`StatusChangeSheet`) + 수정요청(`EditRequestForm`,`EditRequestList`) | ✅ |
| ST-6 | 급여 메인(`PaySummaryCard`,`PayList`) + 일별 상세(`PayDetail`) | ✅ |
| ST-7 | 통합/라우팅/DoD 마감 | ✅ (CONTEXT.md·ADR 작성 여부는 §미결로 리뷰 확인 대상) |

## 주요 생성 파일

**lib (순수 도메인 + store)**
- `src/lib/time.ts` (+`time.test.ts`) — 근무/휴게/연장 분 계산
- `src/lib/pay.ts` (+`pay.test.ts`) — `calcPaidMinutes`(휴가0·차감 음수하한0), `calcDailyPay`(round(분/60×시급)), `buildPaySummary`(totalPay=Σitems)
- `src/lib/date.ts` (+`date.test.ts`) — 시각문자열↔분, 날짜 포맷
- `src/lib/seed.ts` (+`seed.test.ts`) — 2026-05 시드, 불변식 강제
- `src/lib/store.ts` — 모듈 싱글톤 인메모리 store
- `src/lib/constants.ts` — 컬러 토큰·상태 enum·정규근무시간

**types**: `src/types/index.ts` (AttendanceRecord, WorkStatus, PayItem, PaySummary, EditRequest 등 단일 출처)

**API (Route Handler, cache:'no-store')**
- `api/attendance/route.ts` (GET 월간 / PATCH 상태변경) +test
- `api/attendance/[date]/route.ts` (GET 단일·404) +test
- `api/attendance/requests/route.ts` (GET/POST 수정요청) +test
- `api/pay/route.ts` (GET 월간 {summary,items}) +test
- `api/pay/[date]/route.ts` (GET 일별 상세) +test

**컴포넌트(공용)**: AppHeader, BottomNav, BottomSheet, Card, MonthSelector, ProgressBar, StatusBadge

**features**: attendance(MonthlyCalendar/CalendarCell/AttendanceDetail/ClockToggle/StatusChangeSheet/EditRequestForm/EditRequestList + useAttendance 훅 + domain), pay(PaySummaryCard/PayList/PayDetail + usePay 훅 + domain)

**페이지**: `app/page.tsx`(홈), `app/attendance/page.tsx`, `app/attendance/[date]/page.tsx`, `app/pay/page.tsx`, `app/pay/[date]/page.tsx`

## 설계 결정 반영 확인 (architect 인계)
- ✅ 시드 불변식 `seed.test.ts`로 강제: 차감 Σ=440분 / 연장 6회·544분 / totalPay=Σitems(주휴 67,080원 1건)
- ✅ 순수함수 부수효과 0, store 비의존 (`pay.ts` 확인)
- ✅ 쟁점 A/B/C 반영(배지 0분 숨김 / 주휴 시드고정 / 토글 현재시각 — 단위테스트는 고정입력 격리)
- 검산: `calcDailyPay({paidMinutes:390, hourlyWage:10320})` = round(6.5×10320) = 67,080원 ✔ (AC-2)

## 리뷰 확인 필요(미결/주의)
1. ~~CONTEXT.md / docs/adr/0001 작성 여부~~ → ✅ **해소**: developer 중단으로 미작성이던 `CONTEXT.md`·`docs/adr/0001-in-memory-route-handler.md`를 오케스트레이터가 PRD §10·아키텍처 명세대로 작성 완료(2026-05-31).
2. **UI 화면별 AC 충족(AC-11~20)** — 빌드/타입은 통과하나 실제 렌더 내용(디자인 충실도 AC-19 5요소, 토글 플로우 AC-12, 캘린더 배지 AC-13)은 리뷰에서 코드/실행 확인 필요.
3. developer 자가 보고가 없으므로 reviewer가 AC 매트릭스를 PRD↔코드로 처음부터 대조.

## REWORK v2 (분류 A — 품질/견고성, 2026-05-31)

codex 교차검증이 발견한 실제 버그 3건 수정. 범위 한정(신규 기능·리팩토링 없음). 회귀 없음 — DoD 4종 전부 재GREEN.

### 수정 매핑 (파일:라인)
- **버그1** `src/lib/store.ts` `upsertTodayClock` (~L92-101): 토글로 시각 기록 시 prev.status가 "휴가"/"결근"이면 status="정상", breakMinutes=DEFAULT_BREAK_MINUTES, deductMinutes=0 으로 정상화. 휴가일(5/29) 출근 토글 → 근무일로 전환되어 급여 0원 문제 해소.
- **버그2** `src/lib/store.ts` `updateStatus` (~L50-92): status 의존 연산필드 일관 재계산. 휴가/결근 → work/overtime/deduct=0 (clock 보존). 정상/연장/지각 & clock 존재 → calcWorkMinutes/calcOvertime 재계산, deduct는 보존(지각 산식 미정의 — 임의추정 금지).
- **버그3** `src/lib/time.ts` `parseHHMM` (L6-14): 시 0~23·분 0~59 범위 검증 추가. 초과 시 NaN(기존 형식불량과 동일 처리). "99:99"=6039분 과다산정 위험 제거.

### 추가 테스트 (TDD RED→GREEN, vertical slice)
- `src/lib/time.test.ts` +6 케이스: 23:59→1439, 00:00→0, 99:99→NaN, 24:00→NaN, 12:60→NaN, "bad"→NaN.
- `src/lib/store.test.ts` (신규 파일) +7 케이스: 휴가일 clockIn/clockOut 토글 시 status="정상"·급여>0·work=390·deduct=0; clockIn만으로도 정상화; 정상→휴가 시 work/overtime/deduct=0; 결근 전환 clock 보존; 휴가→정상(clock) work=510·overtime=120 재계산; 정상→지각 deduct(50) 보존; 없는 날짜 null.

### TDD 사이클
| 버그 | RED | GREEN | REFACTOR |
|---|---|---|---|
| 버그3 parseHHMM | time.test.ts 3 fail | 범위검증 추가, 11 pass | 불필요(clean) |
| 버그1+2 store | store.test.ts 5 fail | upsertTodayClock+updateStatus 수정, 7 pass | 불필요 |

### DoD 재확인 결과
- `pnpm test`: **49 passed (11 files)** — 기존 36 + 신규 13.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm build`: exit 0, "Compiled successfully".
- `pnpm lint`: exit 0.

### 버그4 (untracked 해소)
신규 repo 초기 산출물 + 본 수정을 main에 커밋(별도 브랜치 지시 없음).
