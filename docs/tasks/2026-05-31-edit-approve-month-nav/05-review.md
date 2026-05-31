# 05-review — 리뷰 보고서 (v1)

- **작성**: task-reviewer
- **대상**: `docs/tasks/2026-05-31-edit-approve-month-nav`
- **커밋 범위**: `d411bed..804dd91` (T4 변경분)
- **검토 기준**: PRD `01-prd.md` AC-1~12, 승인 `02-approval.md` Q1/Q2/Q4, 설계 `03-architecture.md` §1~§4

---

## AC 매트릭스

| AC# | 내용 | 충족 증거 | 정량 증거 | 일치 |
|---|---|---|---|---|
| AC-1 | after 반영 (레코드 status/clockIn/clockOut 갱신) | `store.ts:251-256` merged = {…base, status: after.status, clockIn, clockOut} → `store.records.set` | store.ts:251-256 | ✅ |
| AC-2 | status 대기→수락 전이 (타 요청 불변) | `store.ts:286` `req.status = "수락"` / `store.test.ts` "다른 대기 요청 status 불변" | store.test.ts > "다른 대기 요청 status 불변" | ✅ |
| AC-3 | work/overtime 재계산 (정합 규칙 적용) | `store.ts:24-41` `recalcClockFields` + `calcOvertimeByClock` / `store.test.ts` "15:34→458/34" | store.test.ts > "정상/연장 after 는 workMinutes 재계산 + overtime=clockOut 초과분(15:34→34)" | ✅ |
| AC-4 | 결근/휴가 정책 일관 (CONTEXT.md 차감 정책) | `store.ts:259-282` 결근 deduct=390/work=0, 휴가 deduct=0/work=0 분기 | store.test.ts > "after.status=결근 수락 시 결근 차감 정책" / "after.status=휴가 수락 시 휴가 차감 정책" | ✅ |
| AC-5 (연장 정합) | 07:58~15:00 → overtimeMinutes===0 | `time.ts:45-50` `calcOvertimeByClock` max(0, 900-900)=0 / `store.test.ts` "조기출근·정시퇴근(07:58~15:00) 수락 시 work 392·overtime 0" | time.test.ts > "07:58 출근·15:00 퇴근(조기출근·정시퇴근)이어도 연장 0" | ✅ |
| AC-6 (연장 정합) | 08:00~16:30 → overtimeMinutes===90 | `time.ts:49` max(0, 990-900)=90 | time.test.ts > "16:30 퇴근이면 연장 90(990−900)" | ✅ |
| AC-7 (연장 정합) | clockOut=15:00→0, clockOut=15:34→34, clockIn 무관 | `time.ts:45-50` clockIn 인자 없음 | time.test.ts > "15:00 정시 퇴근이면 연장 0 (clockIn 무관)" / "15:34 퇴근이면 연장 34(934−900)" | ✅ |
| AC-8 | POST /approve → 200/404/400, {request,record} 반환 | `route.ts:7-27` 유효→200/없는id→404/id누락→400 | route.test.ts > "유효 대기 요청 수락 시 200 과 {request, record}" / "존재하지 않는 id 는 404" / "id 누락 시 400" | ✅ |
| AC-9 | 수락 버튼 UI (대기에만 렌더, 수락엔 없음) + 수락 후 reload | `EditRequestList.tsx:38-46` `{req.status === "대기" && onApprove && <button>}` / `AttendanceDetail.tsx:133-139` `onApprove` 콜백 배선 + `reloadDay()` | EditRequestList.tsx:38-46 | ✅ |
| AC-10 (월 이동) | 이전/다음 화살표 + month 갱신 + 헤더 동기화 | `AttendanceCalendarView.tsx:19-35` `‹` `›` 버튼 / `shiftMonth(m, ±1)` / `formatMonthLabel(month)` | AttendanceCalendarView.tsx:19-35 | ✅ |
| AC-11 (빈 달 graceful) | 시드 없는 달 → 빈 그리드, 크래시 없음 | `getMonthRecords(month)` 빈 `[]` 반환 + `buildMonthGrid` 임의 월 처리 기존 유지 | date.test.ts > "shiftMonth" 연/월 경계 (2026-12→2027-01 / 2026-01→2025-12) | ✅ |
| AC-12 (회귀 0) | 기존 75 + 신규 25 = 100 GREEN | `pnpm test` 100 passed (15 files) — 회귀 0 | pnpm test: 100 passed (15 files) | ✅ |

### 자동 추가 AC (Repo Artifacts)

| AC# | 항목 | 증거 | 일치 |
|---|---|---|---|
| AC-Repo-1 | CONTEXT.md 갱신 | "연장근무" 행: `max(0, parseHHMM(clockOut) − 900), clockIn·workMinutes 무관(ADR 0001)` + "근무기록 수정요청" 행에 수락 반영 명문화 | ✅ |
| AC-Repo-2 | ADR 작성 | `docs/adr/0003-overtime-by-clockout.md` 신규. PRD §10 요구 결정 2건(연장 기준 변경 + 수락 멱등) 모두 포함 | ✅ |
| AC-Repo-3 | 갱신 시점 | 커밋 804dd91 단일 커밋에 코드 + CONTEXT.md + ADR 포함 | ✅ |

### 자동 추가 AC (Struct)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Struct-1 | 신규 파일 배치 | `src/lib/constants.ts`(F1), `src/lib/time.ts`(F2), `src/lib/store.ts`(F3), `src/app/api/attendance/requests/approve/route.ts`(F4), `src/features/attendance/components/AttendanceCalendarView.tsx`(F10) — 설계 §1.1 경로 일치 | ✅ |
| AC-Struct-2 | 폴더 책임 침범 | `lib/*`에 React import 없음, `features/`는 client 컴포넌트만 | ✅ |
| AC-Struct-3 | user_notes 준수 | feature-based 패턴 유지, lib/features/app 분리 준수 | ✅ |

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 12개 (Repo/Struct 제외)
- file:line 증거: 9개
- test ID 증거: 12개 (file:line과 중복 포함)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 12 / 12 = **100%**

---

## 경계면 검증

### API ↔ Frontend Hook

- approve body `{id}` (hook: `useAttendance.ts:115`) ↔ route `body.id` (`route.ts:10`) ↔ `approveRequest(id: string)` (`store.ts:235`) — **일치**
- 응답 `{request, record}` (`ApproveResult`, `types/index.ts:36-39`) ↔ route `NextResponse.json(result)` ↔ hook `res.ok → reload()` — **일치**
- 월 GET `?month=` ↔ 기존 `getMonthRecords(month)` — 기존 계약 재사용, 변경 0 — **일치**

### PRD 데이터 모델 ↔ 구현

- `ApproveResult { request: EditRequest; record: AttendanceRecord }` (PRD §6 계약) ↔ `types/index.ts:35-39` — **일치**
- `approveRequest(id: string): ApproveResult | null` (PRD §6) ↔ `store.ts:235` — **일치**
- `calcOvertimeByClock(i: { clockOut: string | null }): number` (PRD §6) ↔ `time.ts:45-50` — **일치**
- `shiftMonth(month: string, delta: number): string` (설계 §2.2) ↔ `date.ts:56-60` — **일치**

### 승인 Q1/Q2/Q4 ↔ 구현

- Q1 upsert: `store.ts:249-250` `store.records.get(req.date) ?? newRecordFrom(req.date, after)` — **일치**
- Q2 멱등 no-op: `store.ts:241-245` `if (req.status === "수락") return { request: req, record }` — **일치**
- Q4 화살표 UI: `AttendanceCalendarView.tsx:19-35` `‹ {formatMonthLabel(month)} ›` — **일치**

### AppHeader.title 타입 확대 확인

- `AppHeader.tsx`: `title: ReactNode` (string→ReactNode 확대). string은 ReactNode 부분집합 → 기존 호출(`/`, `/pay`, `/mypage`, `/mypage/profile`) 모두 string literal 전달, 호환 유지 — 회귀 없음 확인

---

## 빌드/테스트 결과

- **빌드**: `pnpm build` ✅ exit 0 — Compiled successfully (7 API 라우트 + 8 페이지). `/api/attendance/requests/approve` 신규 노출 확인
- **단위 테스트**: `pnpm test` ✅ **100 passed (15 files)** — 기존 75 회귀 0 + 신규 25
  - time +8, date +4, store +9, approve route +4
- **타입체크**: `tsc --noEmit` ✅ exit 0
- **린트**: `pnpm lint` ✅ exit 0

### 신규 테스트 커버리지 확인

| 파일 | 추가 케이스 | AC 매핑 |
|---|---|---|
| `time.test.ts` | calcOvertimeByClock 8케이스 (07:58→0, 16:30→90, 15:00→0, 15:34→34, 17:00→120, 14:00→0, null→0, "bad"→0) | AC-5,6,7 / E-4,5,6,7,8 |
| `date.test.ts` | shiftMonth 4케이스 (±1, 연말/연초 경계) | AC-10 / E-10 |
| `store.test.ts` | approveRequest 9케이스 (after반영, 재계산, 조기출근, 타요청불변, E-1/E-2/E-3, 결근, 휴가) | AC-1,2,3,4,5 / E-1,2,3 |
| `route.test.ts` | 4케이스 (200+{req,rec}, 404, 400, 멱등) | AC-8 / E-1,2 |

---

## 회귀 확인

- **`calcOvertime(workMinutes)` 불변**: `time.ts:34-39` 시그니처/구현 보존(append-only). `time.test.ts:67` `calcOvertime(510)===120` GREEN ✅
- **기존 75 테스트**: 전량 GREEN — `pnpm test: 100 passed (15 files)` (75+25) ✅
- **seed 불변식 ②(연장 6회/544분)**: `seed.test.ts` GREEN. `buildSeedRecords()`는 `calcOvertimeByClock`을 호출하지 않음 — 리터럴 매핑만(architect §3.3 증명). 런타임 재계산 없음 ✅
- **5/28(07:58~15:00) T3 follow-up 해소**: `calcOvertimeByClock("15:00")=0`. `store.test.ts` "조기출근·정시퇴근(07:58~15:00) 수락 시 work 392·overtime 0" GREEN ✅ → **T3 follow-up(연장 오산정 P1) 완전 해소**
- **라우트 정상**: build 출력 `/`, `/attendance`, `/attendance/[date]`, `/pay`, `/pay/[date]`, `/mypage`, `/mypage/profile` 모두 정적/동적 렌더 정상 확인 ✅

---

## 🤝 교차 검증 (codex review)

- 자체 판정 (하네스축): PASS 후보
- codex 호출: `codex review --base d411bed`
- codex 모델: gpt-5.5
- 호출 시각: 2026-05-31T07:22:53 (UTC)
- **codex 판정: FAIL (P1 × 2)**

### codex 지적 상세

**[P1-1] after 페이로드 검증 부재 — `store.ts:253-255`**

`POST /api/attendance/requests` 생성 route가 `after` 객체의 내부 필드(`status`, `clockIn`, `clockOut`)를 검증하지 않는다. `after: {}` 같은 형식 불량 요청이 생성되면 `approveRequest` 수락 시 `merged.status = undefined`로 저장되어 데이터 손상이 발생한다. 이번 diff에서 `approveRequest`가 신규 추가됨으로써 기존 `addRequest` 생성 route의 검증 부재가 실제 손상 경로로 연결된다.

- **diff 내 여부**: ✅ diff 내 (approveRequest 신규 추가가 손상 표면 생성)
- **PRD 매핑**: E-8 "API는 입력 검증 단계에서 400(또는 0 처리)" — after 내부 필드 검증 미비
- **분류**: REWORK (A) — 품질 미흡, 에러 핸들링 보강 필요

**[P1-2] seed 연장 리터럴과 신규 clockOut 기준 불일치 — `time.ts:49`**

seed 5/04(07:26~15:00, overtimeMinutes=34)와 5/24(07:00~16:00, overtimeMinutes=130)가 신규 `calcOvertimeByClock` 기준으로 재계산되면 각각 0분, 60분으로 달라진다. `updateStatus` 호출 시 이 drift가 발생한다.

- **diff 내 여부**: diff 내 변경(G2 연장 정합)이 원인이지만, PRD §3 "시드 레코드는 명시값 보존(불변식②: 연장 6회/544분)이며, seed는 재계산 경로를 타지 않으므로 불변식이 깨지지 않는다"(architect §3.3)로 명시 수용된 trade-off
- **seed.test.ts**: 불변식② GREEN (buildSeedRecords 리터럴 매핑, 재계산 경로 없음)
- **분류**: **diff 밖 — follow-up P1** (PRD 수용 trade-off이나 updateStatus 호출 시 seed 레코드 overtime drift 잠재 위험)

### disagreement_action 적용

- P1-1: diff 내 실질 결함 → **REWORK (A)** 판정 (`rework` action)
- P1-2: PRD 수용 trade-off + diff 밖 follow-up → PASS 확정하되 follow-up P1에 기록

### 최종 결정: **REWORK (A) — developer 회귀**

gate_mode: and 원칙에 따라 codex P1-1(diff 내 결함)을 하네스축이 덮을 수 없음.

---

## T3 Follow-up 해소 여부

**T3 follow-up P1 (연장 재계산 정합): 완전 해소됨**

- 5/28(07:58~15:00) `approveRequest` 수락 시 overtime=0 유지 → `store.test.ts:"조기출근·정시퇴근(07:58~15:00) 수락 시 work 392·overtime 0"` GREEN
- seed 불변식②(6회/544분) 보존: `seed.test.ts` GREEN
- `calcOvertimeByClock("15:00")=0` 확인: `time.test.ts` GREEN

---

## 최종 판정

| 항목 | 결과 |
|---|---|
| **판정** | **REWORK (A)** |
| AC 충족 | 12/12 (AC-12 포함) — 하네스축 PASS |
| DoD 수치 | pnpm test 100/100 GREEN / tsc 0 / build 0 / lint 0 |
| codex 판정 | FAIL (P1×2) — P1-1: diff 내 차단, P1-2: follow-up 분류 |
| 회귀 | 0 (기존 75 GREEN, calcOvertime 불변) |
| T3 follow-up 해소 | ✅ 완전 해소 (5/28 overtime=0, seed 불변식②) |
| 분류 | A (품질 미흡 — 에러 핸들링 보강) |
| 회귀 지점 | developer |

### 수정 요청 항목

1. **[필수] `POST /api/attendance/requests` route에서 `after` 내부 필드 검증 추가** (`store.ts:253-255` 관련):
   - `after.status`가 유효한 `WorkStatus` 리터럴(`"정상"|"지각"|"결근"|"휴가"|"연장"`)인지 확인
   - 검증 실패 시 400 반환 (PRD E-8 "입력 검증 단계에서 400")
   - 또는 `approveRequest` 진입부에서 `after.status` 미존재 시 null 반환으로 방어
   - 대상 파일: `src/app/api/attendance/requests/route.ts` (POST 핸들러) 또는 `src/lib/store.ts` (addRequest)

---

## 남은 Follow-up

| 등급 | 항목 | 사유 |
|---|---|---|
| P1 | seed 5/04(07:26~15:00, overtime=34)·5/24(07:00~16:00, overtime=130) 리터럴이 신규 clockOut 기준(각 0·60)과 불일치 → `updateStatus` 호출 시 seed overtime drift 발생 | 이번 diff의 의도된 G2 결과지만 데모 데이터 정합성 잠재 위험. 시드 리터럴을 새 정책 기준으로 정정하거나, 영향 범위 문서화 |
| P2 | `POST /api/attendance/requests` route: `after.clockIn`/`after.clockOut` HH:MM 형식 검증 미비 (E-8 clockOut < clockIn 역전 케이스 — 현재 calcWorkMinutes가 0 반환으로 방어되나 명시 검증 없음) | 에러 핸들링 강화 |
| P3 | `useEditRequests.approve`가 `res.ok` 여부만 반환 — 400/404 오류 메시지를 UI에 노출하는 에러 토스트 없음 | UX 개선 |
