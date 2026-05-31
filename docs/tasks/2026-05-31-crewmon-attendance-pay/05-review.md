# 리뷰 보고서 (v1) — Crewmon 출퇴근·급여 웹앱

- **작성자**: task-reviewer
- **작성일**: 2026-05-31
- **운영 모드**: teammate (Notion 미사용)
- **검증 입력**: PRD (01-prd.md), 승인서 (02-approval.md §0), 아키텍처 (03-architecture.md), 구현노트 (04-implementation.md), 실제 코드 `src/**`

---

## AC 매트릭스

> 3중 매핑: PRD AC — 아키텍처 §매핑 — 코드 파일:라인

| AC# | 내용 (요약) | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| **AC-1** | `calcWorkMinutes({clockIn:"08:00",clockOut:"15:00",breakMinutes:30})` = 390분 | `src/lib/time.ts:19-28` (end-start-break=390), `src/lib/time.test.ts:6-10` (vitest PASS) | ✅ | file:line + test |
| **AC-2** | `calcDailyPay({paidMinutes:390,hourlyWage:10320})` = 67,080원 | `src/lib/pay.ts:15-22` (Math.round(390/60×10320)=67080), `src/lib/pay.test.ts:7-9` (vitest PASS) | ✅ | file:line + test |
| **AC-3** | status=휴가 → 0원, paidMinutes=0 | `src/lib/pay.ts:17` (status==="휴가" return 0), `src/lib/pay.ts:11` (calcPaidMinutes 휴가→0), `src/lib/pay.test.ts:13-16,20-23` (vitest PASS) | ✅ | file:line + test |
| **AC-4** | clockOut:"17:00", break:30 → work=510, overtime=120 | `src/lib/time.ts:31-36` (calcOvertime), `src/lib/time.test.ts:37-46` (vitest PASS) | ✅ | file:line + test |
| **AC-5** | paidMinutes = workMinutes − deductMinutes, 0하한 | `src/lib/pay.ts:6-13` (Math.max(0,...)), `src/lib/pay.test.ts:28-40` (vitest PASS) | ✅ | file:line + test |
| **AC-6** | `GET /api/attendance?month=2026-05` → AttendanceRecord[] | `src/app/api/attendance/route.ts:13-18` (getMonthRecords), `src/app/api/attendance/route.test.ts` (vitest PASS) | ✅ | file:line + test |
| **AC-7** | GET `/api/attendance/2026-05-28` → 200, 없는 날짜 → 404 | `src/app/api/attendance/[date]/route.ts:7-19` (record? 200:404), `route.test.ts` (vitest PASS) | ✅ | file:line + test |
| **AC-8** | PATCH 상태변경 → 응답에 반영, 직후 GET에서 동일 | `src/app/api/attendance/route.ts:20-59` (updateStatus), `src/app/api/attendance/route.test.ts` (PATCH 검증 PASS) | ✅ | file:line + test |
| **AC-9** | POST 수정요청 → status:"대기", GET에 포함 | `src/app/api/attendance/requests/route.ts:13-39` (addRequest+status:"대기"), `requests/route.test.ts` (vitest PASS) | ✅ | file:line + test |
| **AC-10** | GET /api/pay → {summary,items}, summary.totalPay=Σitems | `src/app/api/pay/route.ts:10-27` (buildPaySummary), `src/lib/seed.test.ts:21-28` (totalPay=Σitems 불변식 PASS) | ✅ | file:line + test |
| **AC-11** | 홈 헤더·날짜·매장명·"N시간 근무했어요!"·진행바·공지·바로가기 2개 렌더 | `src/app/page.tsx:11-84` (AppHeader+ClockToggle+Card 공지+Link 바로가기), `src/features/attendance/components/ClockToggle.tsx:54-58` (headline "N시간 근무했어요!") | ✅ | file:line |
| **AC-12** | 미출근→"출근" 노출, 클릭→"퇴근" 전환, 퇴근→마감 표시 | `src/features/attendance/components/ClockToggle.tsx:30-34,78-106` (phase 분기 3종), `src/app/api/attendance/route.ts:35-43` (upsertTodayClock 경로) | ✅* | file:line |
| **AC-13** | 캘린더 2026-05 그리드, 근무시간 셀, 배지, 휴가 라벨, 상태점 | `src/features/attendance/components/MonthlyCalendar.tsx:28-49`, `src/features/attendance/components/CalendarCell.tsx:19-57`, `src/features/attendance/domain.ts:20-26` (formatBadge +0분 숨김) | ✅ | file:line |
| **AC-14** | 날짜 탭→해당일 상세 | `src/features/attendance/components/CalendarCell.tsx:36` (Link href=`/attendance/${view.date}`), `src/app/attendance/[date]/page.tsx` (RSC 셸→AttendanceDetail) | ✅ | file:line |
| **AC-15** | 상세에서 "상태변경" → 바텀시트 + 라디오 5종 + 변경 버튼 → PATCH | `src/features/attendance/components/StatusChangeSheet.tsx:8-53` (BottomSheet+WORK_STATUSES 라디오), `AttendanceDetail.tsx:55-63` (setSheetOpen→changeStatus) | ✅ | file:line |
| **AC-16** | textarea 0/100 카운터, 100자 초과 차단, POST → 요청내역 "대기" | `src/features/attendance/components/EditRequestForm.tsx:1-48` (maxLength=100, reason.length카운터, disabled=trimmed.length===0), `EditRequestList.tsx:6-47` (req.status="대기") | ✅ | file:line |
| **AC-17** | /pay 월 선택·요약카드(합계/차감440분/연장6회9h4m)·일별 리스트 | `src/features/pay/components/PayList.tsx:13-79` (PaySummaryCard+리스트), `src/features/pay/components/PaySummaryCard.tsx:7-46`, `src/lib/seed.test.ts:12-18` (440분/6회/544분 PASS) | ✅ | file:line + test |
| **AC-18** | /pay/[date]: 출/퇴근·시급·급여인정시간·휴게·차감·연장·확인 버튼, 일급 검산 | `src/features/pay/components/PayDetail.tsx:44-94` (DetailRow 6종+확인버튼), `src/app/api/pay/[date]/route.ts:39-42` (amount=calcDailyPay) | ✅ | file:line |
| **AC-19** | (a)코랄 색, (b)바텀탭 4개+하이라이트, (c)라운드 카드, (d)바텀시트 모달, (e)모바일 세로 | (a)`globals.css:9` (#F26B4D), (b)`BottomNav.tsx:14-18` (TABS 4개), (c)`components/Card.tsx`, (d)`BottomSheet.tsx`, (e)`layout.tsx:28` (max-w-md) | ✅ | file:line |
| **AC-20** | 홈↔출퇴근↔급여 탭 이동, 마이페이지 비활성 플레이스홀더 | `src/components/BottomNav.tsx:18` (disabled:true), `BottomNav.tsx:90-99` (disabled button, 깨진 라우트 없음) | ✅ | file:line |

**AC 충족: 20/20** (모든 AC 코드 증거 확인)

### AC-12 (*주석): codex P1-2 관련 실질 검증

- `2026-05-29`는 시드에서 `status:"휴가"`로 정의됨 (`src/lib/seed.ts:51`)
- `upsertTodayClock`에서 `{ ...prev, [field]: time }` spread 시 `status:"휴가"`, `breakMinutes:0` 유지됨 (`src/lib/store.ts:86`)
- 출근 PATCH 후 ClockToggle의 `phase` 판정은 `clockIn` 여부로만 판단 → "퇴근" 버튼 전환은 동작함
- 그러나 `workMinutes` 계산 후 `/api/pay`에서 `buildPayItems`가 `status==="휴가"` 조건으로 `amount=0` 반환 → **출퇴근 토글은 동작하지만 급여는 여전히 0원으로 표시되는 불일치** 발생
- 이는 codex P1-2의 지적이 타당함. AC-12의 UI 전환 자체는 통과하나 데이터 일관성에 결함이 있음

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 20개
- file:line 증거: 20개
- test ID 증거: 10개 (AC-1~10 각 vitest 테스트명 확인)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

**AC 정량 증거 보유율: 20/20 = 100%**

---

## 경계면 검증

| 경계 | 기대 shape | 실제 구현 | 일치 |
|---|---|---|---|
| `GET /api/attendance` → FE | `AttendanceRecord[]` | `route.ts:17` NextResponse.json(records), records = `getMonthRecords()` → `Map<string,AttendanceRecord>` values | ✅ 동일 타입 |
| `GET /api/attendance/[date]` → FE | `AttendanceRecord \| 404` | `[date]/route.ts:7-19` (record? 200:404) | ✅ |
| `PATCH /api/attendance?date=` → store | `{status?}` 또는 `{field,time}` 분기 | `route.ts:20-59` 메서드 분기, `updateStatus` / `upsertTodayClock` | ✅ |
| `POST /api/attendance/requests` → store | `{date,reason,after}` → `EditRequest(대기)` | `requests/route.ts:13-39` 201 반환 | ✅ |
| `GET /api/pay` → FE | `{summary:PaySummary, items:PayItem[]}` | `pay/route.ts:10-27` (`PayResponse` 타입 명시) | ✅ |
| `GET /api/pay/[date]` → FE | `PayDetail` 필드셋 | `pay/[date]/route.ts:29-44` (`PayDetail` 타입 명시) | ✅ |
| `src/types/index.ts` ↔ 모든 레이어 | 단일 출처 타입 계약 | FE hooks, Route Handler, store 모두 `@/types` import | ✅ |

**RSC/Client 경계**: page.tsx/layout.tsx에서 `useState/useEffect` 직접 호출 없음. ClockToggle, MonthlyCalendar, AttendanceDetail, PayList, PayDetail 모두 `"use client"` 선언됨.

**의존성 방향**: `app→features→components→lib→types` 단방향. `components/`는 `AttendanceRecord` 직접 import 없고 표현 props만 수신(확인: `CalendarCell.tsx`는 `CellView` props, `StatusBadge.tsx`는 `tone` props).

---

## DoD 4종 실제 실행 결과

| 명령 | 결과 | 수치 |
|---|---|---|
| `pnpm test` | ✅ PASS | 36 passed (10 files), 161ms |
| `pnpm exec tsc --noEmit` | ✅ PASS | exit 0, 에러 0 |
| `pnpm lint` | ✅ PASS | exit 0, 에러 0 |
| `pnpm build` | ✅ PASS | 11개 라우트 컴파일 성공 (/, /attendance, /pay 정적; api·[date] 동적) |

---

## 발견된 프로젝트 자원 검증 (AC-Proj)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Proj-1 | 컨벤션 준수 | ✅ CLAUDE.md/AGENTS.md 없는 신규 repo, Next/React 관례 준수 (PascalCase 컴포넌트, useXxx 훅, camelCase 함수) |
| AC-Proj-2 | PRD §3 명시 자원 활용 | ✅ Tailwind v4 토큰(`globals.css @theme`), `src/lib/` util/store, `src/components/` 공용 UI 모두 활용 |
| AC-Proj-3 | 발견된 craft 스킬 우선 | ✅ 신규 repo, project_skills 없음 — 임의 호출 없음 |

---

## 프로젝트 구조 준수 검증 (AC-Struct)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Struct-1 | 신규 파일 배치 | ✅ feature 코드→`src/features/`, 공용 UI→`src/components/`, util/store→`src/lib/`, API→`src/app/api/`, 타입→`src/types/` |
| AC-Struct-2 | 폴더 책임 침범 금지 | ✅ `components/`가 도메인 타입 미import 확인, store는 Route Handler 경유만 |
| AC-Struct-3 | user_notes 규칙 준수 | ✅ lib/utils 구분 없는 신규 repo, 해당 없음 |

---

## Repository Artifacts 검증 (AC-Repo)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Repo-1 | CONTEXT.md 갱신 | ✅ `/Users/goyoung/workspace/Study/ttok/CONTEXT.md` 신규 생성 — 급여인정시간/급여차감시간/연장근무/주휴수당/출근상태/근무기록수정요청 6개 용어 정의 포함. PRD §10 캐논 정의와 일치. |
| AC-Repo-2 | ADR 작성 | ✅ `docs/adr/0001-in-memory-route-handler.md` 신규 — 결정 A(인메모리 store), 결정 B(순수함수 분리) 2건 기술. |
| AC-Repo-3 | 갱신 시점 적절성 | ⚠️ git log상 CONTEXT.md·ADR은 untracked(별도 커밋 없음). 오케스트레이터가 개발자 API 과부하 후 직접 작성했다는 구현노트 §7 기재. 파일 내용은 PRD §10과 일치하나, developer 커밋과 동일 시점 반영은 확인 불가. 단, 내용 정합성은 충족 — 허용 |

---

## 도메인 검산

| 항목 | 검산값 | 코드 확인 | 일치 |
|---|---|---|---|
| AC-2: `calcDailyPay({paidMinutes:390,hourlyWage:10320})` | 67,080원 | `pay.ts:21` Math.round(390/60×10320)=67080, pay.test.ts:7-9 PASS | ✅ |
| 시드 차감Σ | 440분 | seed.test.ts:12-13, buildSeedRecords deductMinutes 합 (90+50+300=440) | ✅ |
| 시드 연장 6회·544분 | 6회, 544분 | seed.test.ts:16-18 (34+90+90+80+130+120=544) | ✅ |
| totalPay=Σitems | 주휴 67,080 포함 | seed.test.ts:21-28 PASS | ✅ |
| 쟁점 A (+0분 숨김) | null 반환 | `domain.ts:23` (if diff===0 return null) | ✅ |
| 쟁점 B (주휴 시드고정) | seed.ts WEEKLY_HOLIDAY=67080 | `seed.ts:55-59` | ✅ |
| 쟁점 C (토글 현재시각) | `new Date()` 기록 | `date.ts` nowHHMM(), ClockToggle.tsx:41 | ✅ |

---

## 🤝 교차 검증 (codex review)

- **자체 판정 (하네스축)**: PASS
- **codex 호출 방식**: `codex review --base ce98f0e` (초기 커밋 대비 diff)
- **codex 모델**: gpt-5.5
- **codex 판정**: **FAIL** (P1 2개, P2 2개 finding)
- **호출 시각**: 2026-05-31T04:46:51Z (codex session: 019e7c5b)

### codex 지적사항

**[P1-1] Include the imported UI modules in the patch — `layout.tsx:4-4`**

diff base(ce98f0e)가 initial commit이고 `src/components/`, `src/features/` 파일들이 untracked 상태이므로 "diff만으로는 module resolution 실패"라고 지적. 그러나 실제 `pnpm build` (exit 0)과 `tsc --noEmit` (exit 0)이 통과했고 untracked 파일들도 파일시스템에 존재함. codex가 diff 범위 내 커밋만 본 결과 생긴 false positive — **실제 빌드 실패 없음**. 단, git history 관점에서 ST-3~ST-7 코드가 별도 커밋 없이 untracked 상태인 것은 구조적 문제 (git 추적 미완료).

**[P1-2] Reset vacation state when clocking in — `store.ts:86-86`**

`TODAY = "2026-05-29"` (시드 = 휴가)인 날 출근 PATCH 시 `upsertTodayClock`에서 `{ ...prev }` spread가 `status:"휴가"`, `breakMinutes:0`을 유지함. 이후 `/api/pay`에서 `buildPayItems`가 `status==="휴가"` 조건으로 `amount=0` 반환 → 홈 화면은 "N시간 근무" 표시, 급여 화면은 0원 표시되는 **데이터 불일치** 발생. **타당한 지적 — 실제 버그**.

**[P2-1] Keep payroll fields consistent after status changes — `store.ts:58-58`**

`updateStatus`가 `status`만 교체하고 `deductMinutes` 등 연산 필드는 유지. 예: 05-05(지각, deduct=90분)를 "정상"으로 변경해도 deduct=90이 남아 월 급여 summary에 포함됨. **타당한 지적 — 실제 버그**.

**[P2-2] Reject out-of-range clock values — `time.ts:7-9`**

`parseHHMM`이 `99:99`처럼 논리적으로 유효하지 않은 시각을 통과시킴. 예: `clockOut:"99:99"` → 6039분 근무로 계산. PATCH 엔드포인트는 client-supplied time을 직접 store에 기록하므로 악의적 입력이나 실수로 급여 과다 산정 가능. **타당한 지적 — 실제 버그**.

### 불일치 평가

| Finding | 심각도 | AC 위배 | 분류 |
|---|---|---|---|
| P1-1 UI 모듈 untracked | P1 (false positive) | 빌드 실패 없음 — git history 미완료만 해당 | 분류 A (git 관리 품질) |
| P1-2 휴가일 clock-in 상태 미리셋 | P1 (실제 버그) | AC-12 데이터 일관성 위배 | 분류 A (에러 핸들링 누락) |
| P2-1 status 변경 시 payroll 필드 미갱신 | P2 (실제 버그) | AC-8·AC-10 경계면 불일치 | 분류 A (에러 핸들링 누락) |
| P2-2 parseHHMM 범위 미검증 | P2 (실제 버그) | PRD 엣지#4 방어 불완전 | 분류 A (에러 핸들링 누락) |

**gate_mode: and** 적용 — codex 코드축 FAIL이므로 최종 PASS 불가.

---

## 최종 판정

**REWORK (A)**

### 사유

하네스축(AC 매트릭스 20/20 충족, DoD 4종 통과, 경계면 일치)은 PASS이나, codex 코드축에서 P1 2개·P2 2개 finding이 발견됨. gate_mode=and 원칙에 따라 코드축 FAIL이 하네스축 PASS를 덮을 수 없다.

P1-1은 git history 미완료에 의한 false positive이지만, P1-2/P2-1/P2-2는 실제 동작 버그로 확인됨.

### 분류: A (품질/완성도 — 에러 핸들링 보강)

모든 AC 자체는 충족되어 있으나, 경계 조건 처리(휴가일 clock-in 상태 리셋 미처리, status 변경 후 연산 필드 미갱신, 시각 범위 미검증)가 구현에서 누락됨.

### 회귀 지점: developer

### 수정 요청 항목

1. **[P1-2] `store.ts:upsertTodayClock`**: `field === "clockIn"` 시 `status`가 `"휴가"`이면 `"정상"`으로 변경하고 `breakMinutes`를 `DEFAULT_BREAK_MINUTES`로 리셋. 또는 홈 화면의 `TODAY` 날짜를 휴가가 아닌 날(예: 2026-05-28)로 변경.
   - 근거: `src/lib/store.ts:86` — spread가 status:"휴가", breakMinutes:0 유지. 토글 동작은 되나 급여 화면과 불일치.

2. **[P2-1] `store.ts:updateStatus`**: status 변경 시 status-dependent 필드(`deductMinutes`, 경우에 따라 `workMinutes`) 갱신 여부를 결정·구현. 최소한 `status==="휴가"`로 변경 시 `deductMinutes=0`, `workMinutes=0`으로 초기화. 역으로 비휴가로 변경 시 현재 clock값으로 재계산 또는 기존 값 유지 정책을 명시.
   - 근거: `src/lib/store.ts:57-60` — `{ ...rec, status }` 만으로 업데이트, 연산 필드 미갱신.

3. **[P2-2] `time.ts:parseHHMM`**: 시(hour) 0~23, 분(minute) 0~59 범위 검증 추가. 범위 초과 시 NaN 반환.
   - 근거: `src/lib/time.ts:7-9` — 정규식 `\d{1,2}:\d{2}`만 검증, 숫자 범위 미검사. `99:99` 입력 시 6039분으로 계산됨.

4. **[P1-1] git commit 완성**: ST-3~ST-7 산출물(`src/components/`, `src/features/`, `src/app/(pages)`, `CONTEXT.md`, `docs/adr/`) untracked 파일들을 커밋에 포함. 빌드 자체는 통과하나 git history에서 추적 불가 상태.
   - 근거: `git status` — `src/components/`, `src/features/`, `src/app/attendance/`, `src/app/pay/`, `CONTEXT.md`, `docs/adr/` 모두 `??` (untracked).

---

## 미충족 AC 목록

없음 (AC-1~20 전부 충족). 수정 요청은 AC 충족 여부가 아닌 **경계 조건 품질** 문제임.

---

## AC 정량 증거 상세 — 보유율 100%

```
## 📊 AC 정량 증거 검증 (정량 #1)
- 전체 AC: 20개
- file:line 증거: 20개
- test ID 증거: 10개 (AC-1~5 pay/time.test.ts, AC-6~10 route.test.ts 각)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 20/20 = 100%
```

---

## 부록 — codex 불일치 로그

```jsonl
{"task_url":"docs/tasks/2026-05-31-crewmon-attendance-pay","ts":"2026-05-31T13:49:24+09:00","category":"error-handling","codex_rationale":"upsertTodayClock preserves status=휴가 when clocking in on vacation day","final_decision":"rework_A","review_iter":1}
{"task_url":"docs/tasks/2026-05-31-crewmon-attendance-pay","ts":"2026-05-31T13:49:24+09:00","category":"error-handling","codex_rationale":"updateStatus replaces status only, leaving stale deductMinutes — pay summary inconsistent","final_decision":"rework_A","review_iter":1}
{"task_url":"docs/tasks/2026-05-31-crewmon-attendance-pay","ts":"2026-05-31T13:49:24+09:00","category":"error-handling","codex_rationale":"parseHHMM accepts out-of-range values like 99:99, allowing inflated payroll","final_decision":"rework_A","review_iter":1}
```

로그 파일: `~/.claude/state/task-orchestrator/cross_verify_log.jsonl`
