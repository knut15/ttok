# 05-review — 리뷰 보고서 (v1)

- **작성**: task-reviewer
- **대상**: T7 편집 시트 재구성 + 범위형 휴게
- **커밋**: da5d91c (branch: main)
- **검증 기준**: PRD `01-prd.md`, 승인 `02-approval.md`(Q1 범위형), 아키텍처 `03-architecture.md`, 구현 노트 `04-implementation.md`
- **날짜**: 2026-05-31

---

## AC 매트릭스

| AC# | 내용(승인 함의 반영) | 충족 증거 | 증거 유형 | 일치 |
|---|---|---|---|---|
| AC-1 | 휴게 시트에 clockOut 입력 없음 + 휴게 범위(시작/종료 HH:MM) 2입력 존재 | `BreakChangeSheet.tsx:34~53` — `type="time"` 2개(휴게 시작/종료), clockOut input 없음. 코드 주석 라인8 "퇴근시각(clockOut) 입력은 절대 없다" | file:line | ✅ |
| AC-2 | 휴게 변경 after.breakStart/breakEnd 범위로 제출, clockIn/clockOut 불변 | `AttendanceDetail.tsx:156~168` — `after.clockIn = record.clockIn`, `...(breakStart && breakEnd ? {breakStart, breakEnd} : {})` | file:line | ✅ |
| AC-3 | 휴게 변경 수락 → breakMinutes 파생 + work 재계산 | `store.ts:34~48` `recalcClockFields` R1 case1. `store.test.ts` "휴게 범위(11:30~13:00)→90, work 330" GREEN | file:line | ✅ |
| AC-4 | 퇴근 시트에 상태 라디오 5종 + clockOut 입력 | `ClockOutStatusSheet.tsx:31~57` — `WORK_STATUSES.map` 라디오, `aria-label="퇴근 시각"` time input | file:line | ✅ |
| AC-5 | 퇴근 변경 after{status, clockIn=record, clockOut}, 수정요청 경로 | `AttendanceDetail.tsx:152~170` — ClockOutStatusSheet onApply → draft → EditRequestForm submit, clockIn=record.clockIn 고정. 즉시 PATCH 없음 | file:line | ✅ |
| AC-6 | clockOut 변경 수락 → clockOut + overtime(clockOut 기준) + work 재계산 | `store.ts:319~323` `recalcClockFields` + `calcOvertimeByClock`. `store.test.ts` "퇴근시각 변경(16:30) 수락 시 clockOut/overtime/work 재계산" GREEN | file:line | ✅ |
| AC-7 | breakStart/breakEnd optional, 미명시 수락 = 기존 멱등 | `types/index.ts:25~26` `breakStart?/breakEnd?` optional. `store.ts:288` `hasAfterRange=Boolean(after.breakStart && after.breakEnd)` false면 기존 범위 유지 → `store.test.ts` "휴게 범위 미명시 요청 수락은 기존 동작과 동일" GREEN | file:line | ✅ |
| AC-8 | 어느 편집이든 clockIn 불변 | `AttendanceDetail.tsx:159` `clockIn: record.clockIn` (고정). `store.test.ts` "clockIn 불변" 단언 GREEN | file:line | ✅ |
| AC-Proj-1 | 컨벤션 준수 (CLAUDE.md/CONTEXT.md 도메인 용어) | `time.ts`, `store.ts`, 시트 컴포넌트 전부 CONTEXT.md 용어(breakMinutes/breakStart/breakEnd/calcBreakMinutes) 준수. `pnpm lint` 경고/에러 0 | lint pass | ✅ |
| AC-Proj-2 | PRD §3 명시 자원 활용 | `calcWorkMinutes`/`calcOvertimeByClock`/`recalcClockFields`/`approveRequest`/T4 파이프 전부 재사용. BottomSheet 패턴 재사용. ADR 0003 clockOut 기준 연장 재사용 | 코드 일치 | ✅ |
| AC-Proj-3 | 발견된 craft 우선 활용 | 신규 즉시-PATCH API 신설 안 함. T4 흐름(POST /requests→/approve) 재사용 — 설계 의도와 일치 | 코드 일치 | ✅ |
| AC-Struct-1 | 신규 파일 배치 | `BreakChangeSheet.tsx`, `ClockOutStatusSheet.tsx` → `src/features/attendance/components/` (architect §1 명시 경로) | file 경로 | ✅ |
| AC-Struct-2 | 폴더 책임 침범 금지 | store(server-only) 클라이언트 직접 import 없음. 시트 컴포넌트 `"use client"` 선언 | grep 확인 | ✅ |
| AC-Repo-1 | CONTEXT.md 갱신 | 휴게=범위저장·파생 1줄, EditRequest.after 휴게범위 1줄, 편집 시트 역할 3행 전부 추가 확인(CONTEXT.md:11~23) | file:line | ✅ |
| AC-Repo-2 | ADR 0004 작성 | `docs/adr/0004-edit-sheet-roles-and-break-edit.md` 신규 생성. 결정① 수정요청 경로 통일 ② 범위형 휴게 채택(분 파생) + R1 해소 명시 | file | ✅ |
| AC-Repo-3 | 갱신 시점 적절성 | CONTEXT.md·ADR 0004 변경 커밋 = `da5d91c` (feat(ui) 커밋과 동일 — inline update 원칙 준수) | commit da5d91c | ✅ |

### 불일치 행 없음 (자연어 증거 0건, file:line/test ID 위주)

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 16개 (도메인 8 + 자동추가 8)
- file:line 증거: 13개
- test ID 증거: 4개 (store.test 명칭 인용)
- commit hash 증거: 1개
- lint/build pass: 2개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 16/16 = 100%

---

## 경계면 검증

### API ↔ FE 훅 (break 범위)
- FE `AttendanceDetail.tsx:162~166`: `after.breakStart/breakEnd: "HH:MM"` 조건부 포함
- API `requests/route.ts:62~68`: `parseHHMM(bound) NaN→400` 검증
- store `store.ts:288~296`: `hasAfterRange=true`면 `breakStart/breakEnd` merged → `recalcClockFields` → `calcBreakMinutes` 파생
- **일치**: HH:MM 형식 검증 ✅, 미명시 멱등 ✅

### API 역전 검증 불일치 (중요)

아키텍처 §1 및 §2.7 경계면 표에 **"API 검증: end<=start→400"** 명시:

> `src/app/api/attendance/requests/route.ts` | 수정 | POST 검증에 "after.breakStart/breakEnd 존재 시 HH:MM 형식·역전 검증"

> 경계면 표: `break 범위 | API 검증: 존재 시 parseHHMM NaN→400, end<=start→400`

실제 구현(`requests/route.ts:62~68`)에는 **HH:MM 형식 검증(NaN→400)만 있고 역전 검증(end<=start→400) 없음**.

역전 범위(`breakStart="13:00"`, `breakEnd="11:30"`)로 POST 시 201 수락됨. 수락 후 `recalcClockFields` R1 case1에서 `calcBreakMinutes(fallback=0)` → `breakMinutes=0` → work 과대 산정 가능.

**ADR 0004 Consequences 마지막 항목** ("서버는 동일/역전 범위를 fallback(0)으로 처리한다")은 역전을 fallback으로 수용하도록 기술되어 있으나, 이는 아키텍처 §2.7 경계면 표의 "end<=start→400"과 **명시적 모순**.

판단: architect §2.7("end<=start→400") vs ADR §Consequences("fallback(0) 처리") 간 설계 내 모순이 구현에서 후자(허용)로 구현됨. AC 조건 자체는 충족(AC-1~8 전부 break 범위 역전 거부를 직접 요구하지 않음)이나, **아키텍처 스펙(§2.7)과 구현의 불일치** — 분류 B 대상.

### API ↔ store (clockIn 불변)
- FE: `after.clockIn = record.clockIn` 고정(`AttendanceDetail.tsx:159`)
- API: `after.clockIn` null/string 검증(`requests/route.ts:45~58`)
- store: `merged.clockIn = after.clockIn` → `recalcClockFields` clockIn 그대로 전달
- **일치** ✅

### pay/[date] breakRange 하드코딩
- `src/app/api/pay/[date]/route.ts:36`: `breakRange: record.breakMinutes > 0 ? DEFAULT_BREAK_RANGE : null`
- T7 이후 레코드에 `breakStart/breakEnd`가 저장되지만, `pay/[date]` 응답은 항상 `DEFAULT_BREAK_RANGE("11:30~12:00")`를 반환
- T7 diff 대상 파일 아님(architect §1 파일 목록에 없음). PRD §10에 미명시. 아키텍처 §0 안A 채택 근거 "breakMinutes 기존 소비처(seed/pay/store) **무수정**"으로 의도적 미변경
- codex P2-2 지적이지만 T7 설계 범위 밖(후속 task 대상). **이번 리뷰 차단 사유 아님**.

---

## 빌드/테스트 결과

| 항목 | 결과 | 수치 |
|---|---|---|
| `pnpm build` | ✅ PASS | 15 라우트 컴파일 성공, Compiled in 1464ms |
| `tsc --noEmit` | ✅ PASS | 에러 0 |
| `pnpm lint` | ✅ PASS | 경고/에러 0 |
| `pnpm test` | ✅ PASS | 135/135 (기존 122 + 신규 13, 회귀 0) |

### seed 불변식 확인

- `seed.test.ts` ① 차감 합계 440 ✅ ② 연장 6회·544분 ✅ ③ totalPay=Σitems ✅ ⑤ 근무일 breakStart="11:30"/breakEnd="12:00", 파생 30=기존값 ✅

### T4 회귀 확인

`store.test.ts` 기존 케이스:
- 멱등 no-op(이미 수락된 재수락) ✅
- upsert(레코드 없는 날) ✅
- 결근/휴가 정책 ✅
- clockIn 불변 단언 ✅

---

## 🤝 교차 검증 (codex review)

- 자체 판정(하네스축): 조건부 PASS (AC 8/8 충족, DoD 수치 통과, 단 아키텍처 §2.7 역전 검증 구현 누락 발견)
- codex 호출: `codex review --base 9bfd9f9` (T7 diff 대상)
- codex 판정: **FAIL** (P2 finding 2건)
- 호출 시각: 2026-05-31T20:44

### codex 지적사항

**[P2-1] 역전 휴게 범위 API 경계 미거부** — `requests/route.ts:62~69`
> "When a client posts breakStart >= breakEnd directly, this validation accepts the request because each timestamp is individually valid. Approval then derives breakMinutes = 0, increasing payable work time. The UI disables this input, but the route is a public boundary and must reject reversed or equal ranges with 400."
- 등급: P2 (비차단 원칙상 비차단이나 아키텍처 §2.7 명시 스펙과 불일치 → 아키텍처 검증으로 REWORK 분류 B 해당)
- 차단성 판단: codex는 P2로 분류. 그러나 architect §2.7 "end<=start→400" 명시 스펙과 구현 불일치 → 독자적으로도 REWORK (B) 트리거

**[P2-2] pay/[date] 응답 breakRange 하드코딩** — `store.ts:294~296` (실제 위치: `pay/[date]/route.ts:36`)
> "When an approved request stores a non-default range such as 11:30~13:00, the attendance record is updated correctly, but GET /api/pay/[date] still returns the hard-coded DEFAULT_BREAK_RANGE."
- T7 diff 대상 파일 아님. architect §0 안A "breakMinutes 기존 소비처 무수정"으로 의도적 범위 제외. **이번 task 범위 외 — follow-up P1**.

### 최종 결정

gate_mode=and 원칙: 하네스축(내가) PASS 확정 불가 — architect §2.7 스펙 불이행(end<=start→400 누락) 확인. codex P2-1과 하네스축 독립 발견이 **일치**.

**최종 결정: REWORK (B) — developer 회귀**

---

## 3중 매핑 매트릭스 (PRD AC ↔ 아키텍처 § ↔ 코드)

| AC | PRD 조항 | architect § | 코드 위치 | 판정 |
|---|---|---|---|---|
| AC-1 | §4 AC-1, §11 Q1 범위형 함의 | §1 BreakChangeSheet 신규, §4.2 | `BreakChangeSheet.tsx:1~68` | ✅ |
| AC-2 | §4 AC-2, §6 API 계약 | §2.3, §2.1 | `AttendanceDetail.tsx:156~168` | ✅ |
| AC-3 | §4 AC-3 | §2.5, §3.2 R1 case1 | `store.ts:28~57` | ✅ |
| AC-4 | §4 AC-4 | §1 ClockOutStatusSheet 신규, §4.2 | `ClockOutStatusSheet.tsx:1~70` | ✅ |
| AC-5 | §4 AC-5 | §2.4 | `AttendanceDetail.tsx:186~200` | ✅ |
| AC-6 | §4 AC-6, ADR 0003 | §2.5, §3.2 | `store.ts:319~323` | ✅ |
| AC-7 | §4 AC-7 | §2.1, §2.6 R1 case2/3 | `types/index.ts:25~26`, `store.ts:34~43` | ✅ |
| AC-8 | §4 AC-8 | §2.3/§2.4 after.clockIn 고정 | `AttendanceDetail.tsx:159` | ✅ |
| 역전 검증 | PRD E-2/E-3(시트 비활성), §9 R1 | architect **§1 "역전 검증" + §2.7 end<=start→400** | `requests/route.ts:62~68` — **역전 검증 없음** | ❌ REWORK(B) |

---

## 최종 판정

- **판정: REWORK (B)**
- **사유**: 아키텍처 §1("POST 검증에 역전 검증 분기 append")·§2.7 경계면 표("end<=start→400") 명시 스펙이 구현(`requests/route.ts:62~68`)에서 이행되지 않음. HH:MM 형식 검증(NaN→400)만 존재하고 역전 범위 거부 없음. codex P2-1도 동일 지적. AC-1~8 자체는 역전 거부를 직접 요구하지 않으나 승인 스펙(아키텍처)과 구현 불일치 → 분류 B.
- **회귀 지점**: developer
- **수정 요청 항목**:
  1. `src/app/api/attendance/requests/route.ts` — `after.breakStart`/`after.breakEnd` 둘 다 있을 때 `parseHHMM(breakEnd) <= parseHHMM(breakStart)` 이면 400 반환 추가 (architect §2.7 "end<=start→400" 이행). 검증 위치: 기존 NaN 루프 이후, `addRequest` 호출 전.
  2. (선택, follow-up) `src/app/api/pay/[date]/route.ts:36` — `breakRange` 필드를 `record.breakStart && record.breakEnd ? \`${record.breakStart}~${record.breakEnd}\` : (record.breakMinutes > 0 ? DEFAULT_BREAK_RANGE : null)`로 교체. T7 범위 외이므로 이번 REWORK 필수 아님 — 후속 task(P1) 권장.

---

## follow-up 목록

| # | 항목 | 우선순위 | 분류 |
|---|---|---|---|
| F-1 | `pay/[date]` `breakRange` 실제 저장 범위 반환(현재 DEFAULT_BREAK_RANGE 하드코딩) | P1 | follow-up task |
| F-2 | `EditRequestList`에 after.breakStart~breakEnd 표시(현재 비표시 — architect §4.4 "선택") | P2 | follow-up task |
| F-3 | API 역전 범위 거부 단위 테스트 추가(`route.test.ts` — "breakStart>=breakEnd는 400") | P1 (수정 후 함께) | 이번 REWORK 포함 권장 |

---

## 재검증 (v2)

- **작성**: task-reviewer
- **대상 커밋**: 725e0b9 (v2 수정 — P2-1 역전 거부 추가)
- **base diff**: da5d91c..725e0b9
- **날짜**: 2026-05-31

### P2-1 해소 확인

`route.ts:71~80` — `breakStart !== undefined && breakEnd !== undefined` 조건 하에 `parseHHMM(breakEnd) <= parseHHMM(breakStart)` 이면 400 반환 분기 추가 확인. 위치: 기존 NaN 루프(line 62~69) 직후, `addRequest` 호출(line 82) 전.

| 검증 항목 | 코드 위치 | 결과 |
|---|---|---|
| 역전(12:00~11:30) → 400 | `route.ts:73~80` + `route.test.ts:127~143` | ✅ |
| 동일(11:30~11:30) → 400 | `route.ts:73~80` + `route.test.ts:145~161` | ✅ |
| 정상(11:30~12:00) → 201 | `route.ts:73~80` + `route.test.ts:163~179` | ✅ |
| 미명시(break 키 없음) → 분기 미진입, 멱등 | `route.ts:73` (undefined 조건 미진입) | ✅ |
| NaN 선차단 유지 | `route.ts:62~69` (기존 루프 불변) | ✅ |

아키텍처 §2.7 경계면 표 "end<=start→400" 이행 완료. ADR 0004 Consequences와의 모순 — §2.7(거부 우선) 으로 해소됨.

### DoD 수치 (직접 Bash)

| 항목 | 결과 | 수치 |
|---|---|---|
| `pnpm test` | PASS | 138/138 (기존 135 + 신규 3, 회귀 0) |
| `tsc --noEmit` | PASS | 에러 0 |
| `pnpm lint` | PASS | 경고/에러 0 |
| `pnpm build` | PASS | 15 라우트 컴파일 성공, 1493ms |

### 회귀 확인

- 기존 135 테스트 전부 GREEN. 신규 3건(역전 400, 동일 400, 정상 201) 추가 후 138/138.
- `route.test.ts` 기존 케이스(빈 사유 400, status 불량 400, clockIn NaN 400, break NaN 400, 유효 201) 전부 회귀 없음.
- seed 불변식(440/544/totalPay) 및 store.test 기존 케이스(clockIn 불변, 멱등 no-op, 결근·휴가 정책) GREEN 유지.

### AC 매트릭스 갱신

| AC# | 내용 | 충족 증거 | 일치 |
|---|---|---|---|
| 역전 검증 (§2.7) | breakStart/breakEnd 둘 다 명시 시 end<=start → 400 | `route.ts:71~80` + `route.test.ts:127~179` | ✅ (v2 해소) |

v1 매트릭스 나머지 16개 AC — 변경 없음, 전부 ✅ 유지.

### AC 정량 증거 갱신

- 전체 AC: 17개 (기존 16 + 역전 검증 1)
- 정량 증거 부재 (FAIL): 0개
- AC 정량 증거 보유율: 17/17 = 100%

### 교차 검증 — codex 재게이트 (gate_mode=and, rework_count=1)

- base: da5d91c (v1), head: 725e0b9 (v2)
- codex CLI: v0.135.0 (gpt-5.5)
- 호출 시각: 2026-05-31T20:52
- 호출 명령: `codex review --base da5d91c`

codex 출력 (요약):

> "The added boundary validation correctly rejects reversed and equal break ranges before persistence while preserving valid and omitted-range behavior. No actionable regression was found."

- P1 findings: 0건
- P2 findings: 0건
- P3 findings: 0건 (nit 포함 없음)
- codex 판정: **PASS** (findings 없음)

gate_mode=and: 하네스축 PASS + 코드축(codex) PASS → 최종 PASS 확정.

불일치 누적 로그: 합치(PASS)이므로 `cross_verify_log.jsonl` append 없음.

### follow-up 잔여 항목 (차단 아님)

| # | 항목 | 우선순위 | 상태 |
|---|---|---|---|
| F-1 | `pay/[date]` `breakRange` 실제 저장 범위 반환 (DEFAULT_BREAK_RANGE 하드코딩) | P1 | 후속 task 권장 |
| F-2 | `EditRequestList` after.breakStart~breakEnd 표시 | P2 | 후속 task (선택) |

F-3(역전 거부 테스트 추가) — v2에서 완료됨(route.test.ts:127~179).

### 최종 판정 (v2)

- **판정: PASS**
- **사유**: P2-1(역전 휴게 범위 미거부) 해소 확인. architect §2.7 "end<=start→400" 이행 완료. 신규 테스트 3건(역전/동일/정상) 추가. DoD 수치 138/138, tsc/lint/build 전부 PASS. 기존 135 회귀 0. codex 재게이트(gate_mode=and) PASS — P1/P2 finding 없음.
- **회귀 지점**: 없음 (종료, Done)
- **수정 요청 항목**: 없음
