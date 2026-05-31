# 근무기록 상세 — 편집 시트 재구성 (휴게 시간변경 / 퇴근 상태변경)

생성일: 2026-05-31
작성자: task-planner
버전: v1

## 1. 배경 & 문제

- **현재**: `AttendanceDetail` 의 "휴게" 행에 달린 **'시간변경'** 버튼이 `TimeChangeSheet` 를 연다. 그런데 이 시트는 **퇴근시각(clockOut)** 만 편집한다(`src/features/attendance/components/AttendanceDetail.tsx:104~227`). 즉 휴게 행의 버튼이 의미상 무관한 퇴근시각을 수정하고 있다. 한편 "퇴근" 행에도 동일한 `changeBtn`(상태변경)이 붙어 있어 퇴근시각을 직접 편집할 정식 진입점이 사실상 휴게 행에만 잘못 존재한다.
- **문제**: (1) **휴게 행에서 휴게시간을 수정할 수 없다** — 휴게는 `breakMinutes` 표시(`DEFAULT_BREAK_RANGE` 11:30~12:00)뿐 편집 불가. (2) **퇴근시각 수정 진입점이 휴게 행에 잘못 매달려 있다** — 의미·라벨·동작 불일치. 참조 디자인(`public/sample/IMG_3609.png`)은 출근/퇴근=상태변경, 휴게=시간변경 구조를 의도한다.
- **근거**: 현재 코드 `AttendanceDetail.tsx:105~117`(휴게 행 → `setTimeSheetOpen`)과 `TimeChangeSheet`(`:165~227`, "퇴근 시각만 수정")의 라벨·동작 불일치. CONTEXT.md "근무시간 = 퇴근 − 출근 − 휴게" 정의상 휴게는 근무시간 산정의 1급 입력인데 편집 경로가 없다.

## 2. 목표 & 비목표

### 목표 (Goals)
1. **휴게 행의 '시간변경'** 시트에서 **퇴근시각 편집을 제거**하고, 대신 **휴게시간(breakMinutes)** 을 편집한다. 변경은 수정요청(EditRequest)으로 제출하고 **수락 시 반영**(기존 T4 approve 흐름과 일관)하여 근무시간(workMinutes)을 재계산한다.
2. **퇴근 행의 '상태변경'** 시트에 **퇴근시각(clockOut) 입력**을 추가한다(상태 라디오 + 퇴근시각). 변경은 수정요청으로 제출하고 **수락 시 반영**하여 clockOut + 연장(overtimeMinutes) + 근무시간을 재계산한다.
3. `EditRequest.after` 에 **`breakMinutes?: number`** 를 optional append 하여 휴게 편집을 계약·검증·재계산까지 일관 지원한다.
4. **출근시각(clockIn) 불변 원칙 유지**(T4 결정: 출근은 실제 기록값, 사후 보정 대상 아님).
5. **기존 122 테스트 회귀 0**, append-only(타입 확장은 optional 추가), feature-based, RSC/client 경계 유지.

### 비목표 (Non-goals / Out-of-scope)
- **출근 행의 동작 변경은 하지 않는다.** 출근 행의 상태변경 버튼·동작은 현행 유지(§11 Unresolved Q-2로 표면화하되 본 PRD 범위에서는 미변경).
- **휴게 행에서의 즉시 PATCH 적용은 하지 않는다.** 휴게/퇴근시각 모두 수정요청→수락 경로로만 반영(§11 Unresolved Q-3).
- **휴게 시작/종료 범위(time-range) 자유 편집은 본 버전에서 채택하지 않는다.** 휴게는 **분(minutes) 단위 단일 입력**으로 한정한다(§11 Unresolved Q-1에서 승인자 확인 요청; 본문 가정 = 분 단위). 범위 표기(`DEFAULT_BREAK_RANGE`)는 표시 전용으로 유지.
- **상태변경 즉시 PATCH(`changeStatus`) 경로 자체 폐지·통합은 하지 않는다.** 출근 행은 여전히 즉시 PATCH를 쓴다. 퇴근 행만 "상태+퇴근시각"을 수정요청으로 제출하는 별도 흐름을 갖는다.
- 거절/철회/수락취소, 휴게 0 이하 음수 입력의 신규 비즈니스 규칙 정의는 하지 않는다(엣지 처리는 기존 산식 하한 0 재사용).

## 3. 솔루션 개요

세 곳을 수정한다. (A) **타입/계약**: `EditRequest.after` 와 `EditRequestChange` 에 `breakMinutes?: number` 를 optional append. (B) **store/재계산**: `approveRequest` 가 after.breakMinutes 가 있으면 `recalcClockFields` 가 그 값으로 근무시간을 재계산하도록 연결(없으면 기존 동작 유지 = 멱등 보존). (C) **UI**: 휴게 행 시트를 "휴게시간 편집(분)"으로 교체(퇴근 입력 제거), 퇴근 행 시트를 "상태 라디오 + 퇴근시각 입력"으로 확장.

핵심은 **두 편집 모두 기존 T4 approve 파이프(POST /requests → POST /requests/approve)** 를 재사용한다는 점이다. 신규 즉시-적용 API를 만들지 않으므로 회귀면이 좁고, after 계약 확장만으로 휴게·퇴근시각을 동일 경로에 태운다. 출근시각은 모든 경로에서 `after.clockIn = record.clockIn`(불변)으로 고정한다.

### 활용할 프로젝트 자원
- `CONTEXT.md` §"근무시간/휴게시간/근무기록 수정요청": 작성·재계산 정의의 단일 출처 — phase 2.5/3 전 구간 기준.
- `docs/adr/0003-overtime-by-clockout.md` (연장 = clockOut − 900): 퇴근시각 변경 시 연장 재계산 근거 — phase 3에서 calcOvertimeByClock 재사용.
- `src/lib/time.ts` `calcWorkMinutes`/`calcOvertimeByClock`, `src/lib/store.ts` `recalcClockFields`/`approveRequest`: 재계산 단일 출처 — phase 3에서 확장(휴게 입력 연결).
- 기존 T4 흐름(`src/app/api/attendance/requests/route.ts` POST 검증, `.../approve/route.ts`): after 검증·수락 파이프 재사용 — phase 3에서 breakMinutes 검증 추가.
- `BottomSheet`, `StatusChangeSheet` 패턴: 시트 UI 재사용 — phase 3.

> 주: project_skills(commands/skills/agents) 입력은 미수신. 위는 레포 직접 정독으로 확인한 in-repo 자원이며, 발견되지 않은 글로벌 자원은 기재하지 않음.

### 프로젝트 구조 (Phase -0.5 결과 인용)
- 패턴: feature-based (`src/features/attendance/{components,hooks,domain}`) + leaf 계약 모듈(`src/types`, `src/lib`). project_structure 입력 미수신 → 레포 관측 구조로 대체.
- 신규/변경 산출물 배치:
  - 타입 확장 → `src/types/index.ts` (EditRequestChange append)
  - store 재계산 → `src/lib/store.ts` (recalcClockFields / approveRequest)
  - API 검증 → `src/app/api/attendance/requests/route.ts`
  - 시트 UI → `src/features/attendance/components/AttendanceDetail.tsx` 및 신규 `BreakChangeSheet`(또는 동 파일 내), `StatusChangeSheet.tsx`
- 사용자 메모: 입력의 user_notes 미수신.

## 1.5 Sub-task 분해

| ST | 작업 | 산출물(파일) | 사용 가능한 자원 | 의존 |
|---|---|---|---|---|
| ST-1 | **계약 확장**: `EditRequestChange.breakMinutes?: number` optional append. `before`/`after` 동일 타입이므로 양쪽 적용. | `src/types/index.ts` | CONTEXT.md 휴게 정의 | — |
| ST-2 | **store 재계산 연결**: `recalcClockFields`/`approveRequest` 가 `after.breakMinutes` 가 명시되면 그 값으로 휴게 적용 후 calcWorkMinutes 재계산. 미명시(undefined)면 기존 동작(기본 휴게 복원) 유지 → 기존 테스트 멱등. `addRequest` 의 before 스냅샷에 record.breakMinutes 포함. | `src/lib/store.ts` | calcWorkMinutes, recalcClockFields, ADR 0003 | ST-1 |
| ST-3 | **API 검증**: POST /requests 가 `after.breakMinutes` 가 존재하면 number·`0 ≤ v ≤ workSpan` 범위(또는 DEFAULT_BREAK_RANGE 정책) 검증. 명시 안 되면 기존 검증 그대로. | `src/app/api/attendance/requests/route.ts` | parseHHMM, DEFAULT_BREAK_MINUTES | ST-1, ST-2 |
| ST-4 | **휴게 시트 교체**: 휴게 행 '시간변경' → `BreakChangeSheet`(휴게 분 입력, 퇴근 입력 제거). onApply → after.breakMinutes 를 담아 수정요청 제출. 출근/퇴근시각은 record 값 고정. | `AttendanceDetail.tsx`(기존 `TimeChangeSheet` 대체) | BottomSheet, useEditRequests.submit | ST-1~3 |
| ST-5 | **퇴근 상태변경 시트 확장**: 퇴근 행 '상태변경' → 상태 라디오 + 퇴근시각 입력. onApply → after{status, clockIn(불변), clockOut, breakMinutes(현행)} 수정요청 제출. 출근 행은 기존 즉시-PATCH 유지. | `StatusChangeSheet.tsx` 또는 신규 `ClockOutStatusSheet`, `AttendanceDetail.tsx` | StatusChangeSheet 패턴, useEditRequests.submit | ST-1~3 |

## 4. Acceptance Criteria

> 가정(§11 Q-1): 휴게 입력은 **분(minutes) 단위 정수 단일 입력**으로 명세한다. 범위형 채택 시 AC-1/AC-5 재작성 필요.

| # | AC | 검증 방법 |
|---|---|---|
| AC-1 | Given 휴게 행, When '시간변경' 시트를 연다, Then 시트에 **퇴근시각(clockOut) 입력이 존재하지 않고** 휴게시간(분) 입력 1개가 표시된다. | UI 확인 / 컴포넌트 테스트(시트에 clockOut input 부재) |
| AC-2 | Given 휴게 시트의 휴게(분) 입력에 유효 정수, When '적용'(요청 제출), Then `POST /api/attendance/requests` 의 `after.breakMinutes` 에 입력값이 담기고 `after.clockIn = record.clockIn`(불변)·`after.clockOut = record.clockOut`(불변)으로 제출된다. | API 호출 인자 검증 / 단위 테스트 |
| AC-3 | Given `after.breakMinutes` 가 담긴 대기 요청, When 수락(`approveRequest`), Then 해당 날짜 레코드의 `breakMinutes` 가 after 값으로 반영되고 `workMinutes = max(0, clockOut−clockIn−breakMinutes)` 로 재계산된다. | store 단위 테스트(전/후 workMinutes 비교) |
| AC-4 | Given 퇴근 행, When '상태변경' 시트를 연다, Then 상태 라디오 5종 + **퇴근시각(clockOut) 입력**이 함께 표시된다. | UI 확인 / 컴포넌트 테스트 |
| AC-5 | Given 퇴근 상태변경 시트에서 상태·퇴근시각 변경, When '적용', Then `after{status, clockIn=record.clockIn, clockOut=입력값}` 로 수정요청이 제출된다(즉시 PATCH 아님). | API 호출 인자 검증 / 단위 테스트 |
| AC-6 | Given clockOut 이 변경된 대기 요청, When 수락, Then 레코드의 `clockOut` 이 반영되고 `overtimeMinutes = max(0, parseHHMM(clockOut)−900)` 및 `workMinutes` 가 재계산된다(ADR 0003). | store 단위 테스트(overtime/work 검증) |
| AC-7 (계약) | Given `EditRequestChange`, Then `breakMinutes` 는 **optional(`number?`)** 이며, 미명시 요청의 수락은 기존과 동일하게 휴게를 변경하지 않는다(기본 휴게 복원 동작 보존, 멱등). | 타입 컴파일 + store 단위 테스트(breakMinutes 없는 after 수락 = 기존 결과) |
| AC-8 (불변) | Given 휴게/퇴근시각 어느 편집이든, When 수락, Then 레코드의 `clockIn` 은 변경 전과 동일하다(출근 불변). | store 단위 테스트(clockIn 동일 단언) |

## 5. 엣지 케이스

| # | 케이스 | 기대 동작 |
|---|---|---|
| E-1 | 휴게 > 근무 span (예 clockIn 08:00, clockOut 09:00, break 120분) | `calcWorkMinutes` 가 `Math.max(0, …)` 하한으로 `workMinutes = 0`. 음수 금지(기존 산식 재사용). 수락은 성공하되 work=0. |
| E-2 | 잘못된 휴게 입력 형식(비정수·공백·문자) | 시트 '적용' 비활성 + POST /requests 가 `after.breakMinutes` 비정수면 400. store 미반영. |
| E-3 | 휴게 0 입력 | `breakMinutes=0` 으로 제출. 단, `recalcClockFields` 의 기존 `breakMinutes===0 → DEFAULT_BREAK_MINUTES` 복원 로직과 충돌 가능 → ST-2 에서 "after 에 명시적으로 0 이 온 경우" 와 "필드 미명시(undefined)" 를 구분 처리. 명시 0 은 0 으로 존중(§11 Q-3 관련). |
| E-4 | 잘못된 퇴근시각 형식(HH:MM NaN) | 시트 '적용' 비활성(`parseHHMM` NaN 검사) + POST /requests 가 clockOut NaN 이면 400(기존 검증). |
| E-5 | 퇴근시각 < 출근시각(역전) | `calcWorkMinutes` 에서 `end<=start → 0`. `calcOvertimeByClock` 는 clockOut 단독 기준이므로 비음수면 값 산출(역전이어도 900 초과면 연장 발생 가능) — 기존 산식 그대로(신규 규칙 미정의, Non-goal). |
| E-6 | clock 한쪽이 null(미퇴근) 상태에서 휴게만 변경 | `recalcClockFields` 가 clock 한쪽 null 이면 work/overtime=0 유지(기존 E-4 동작). breakMinutes 는 저장되나 work 재계산 0. |

## 6. 데이터 모델 / API 계약

```ts
// src/types/index.ts — optional append (append-only, 기존 필드 불변)
export interface EditRequestChange {
  status: WorkStatus;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes?: number; // 신규(optional). 휴게(분) 편집 시에만 포함.
}
```

```
POST /api/attendance/requests
body: { date, reason, after: { status, clockIn, clockOut, breakMinutes? } }
- after.breakMinutes 존재 시: number & 정수 & 0 이상 검증, 아니면 400
- 미존재 시: 기존 검증·동작 동일

POST /api/attendance/requests/approve
body: { id }
- after.breakMinutes 명시 → 레코드 breakMinutes 반영 후 work 재계산
- after.clockOut 변경 → work + overtime(=max(0, clockOut−900)) 재계산
- after.clockIn 은 항상 변경 전과 동일(불변)
- 멱등: 이미 "수락" 이면 no-op (기존 보존)
```

## 7. 메트릭

| 지표 | 현재 | 목표 |
|---|---|---|
| 휴게 행 '시간변경' 시트의 clockOut 입력 개수 | 1 | **0** |
| 휴게시간 편집 가능 여부 | 불가(표시 전용) | **가능(분 입력 → 수락 반영)** |
| 퇴근 행에서 퇴근시각 편집 진입점 | 0(휴게 행에 오배치) | **1(퇴근 상태변경 시트)** |
| 기존 테스트 통과 | 122/122 | **122/122 (회귀 0) + 신규 AC 테스트 추가** |

## 8. 의존성

- 선행 task: T4 (`2026-05-31-edit-approve-month-nav`) — approve 파이프·after 계약·멱등 동작이 본 task의 토대. 회귀 금지 대상.
- 외부 API: 없음(인메모리 store).
- 데이터 마이그레이션: 없음(optional 필드 추가, 기존 레코드/요청 영향 없음).
- 산식 의존: ADR 0003(연장 = clockOut−900), CONTEXT.md 근무시간 정의.

## 9. 리스크

- **R1**: `breakMinutes=0` 명시값이 `recalcClockFields` 의 "0 → 기본값 복원" 로직에 흡수되어 의도(휴게 0)가 무시될 수 있음. → ST-2 에서 after.breakMinutes 의 **명시 여부(undefined vs 0)** 를 구분해 명시 0 을 존중. 테스트 E-3 로 강제.
- **R2**: after 계약 확장이 기존 POST /requests 검증 분기(undefined 차단 가드)와 충돌. → breakMinutes 는 optional 이므로 "있을 때만 검증" 분기로 추가, 기존 clockIn/clockOut undefined 차단 로직 불변. AC-7 로 멱등 보장.
- **R3**: 퇴근 상태변경을 즉시 PATCH 가 아닌 수정요청으로 바꾸면서 사용자 기대(즉시 반영)와 어긋날 수 있음. → 사용자 결정(T4 흐름)이 명시됨. Q-3 로 승인자 재확인.
- **R4**: 출근/퇴근 행이 동일 `changeBtn` 을 공유하던 구조를 분리하면서 출근 행 동작 회귀 가능. → 출근 행은 명시적으로 현행 유지(Non-goal), AC-8/회귀 테스트로 clockIn 불변 단언.

## 10. Repository Artifacts 갱신 대상

| 종류 | 대상 파일 | 갱신 사유 |
|---|---|---|
| 도메인 용어 | `CONTEXT.md` | (1) **근무기록 수정요청(EditRequest)** 항목에 `after.breakMinutes`(휴게 편집) 추가 사실과 "수락 시 휴게 반영 후 work 재계산" 1줄 보강. (2) "휴게 행 시간변경 = 휴게시간 편집(퇴근시각 아님)", "퇴근 행 상태변경 = 상태+퇴근시각" UI 의미 1줄씩 명시. |
| 결정 사유 (ADR) | `docs/adr/0004-edit-sheet-roles-and-break-edit.md` (신규) | 결정 2개 이상: ① 휴게/퇴근시각 편집을 **즉시 PATCH 가 아닌 수정요청→수락 경로**로 통일(이유: T4 파이프 재사용·회귀면 축소). ② 휴게 입력을 **분 단위**로 채택(범위형 미채택 이유). → ADR 1개 작성. |
| 운영 메타 | `.task-orchestrator.yml` | 해당 없음(protected_files·검증강도 변경 없음). |

## 11. Unresolved Questions

- **Q-1 (휴게 입력 형식)**: 휴게를 **분(minutes) 단위 단일 입력**으로 할지, **휴게 시작~종료 범위(HH:MM~HH:MM)** 로 할지? 본 PRD는 분 단위를 가정해 AC-1/AC-5 를 작성. 범위형 채택 시 타입(`breakStart/breakEnd`)·검증·AC 재작성 필요. → 승인자 결정 요청.
- **Q-2 (출근 행 상태변경 처리)**: 퇴근 행에 퇴근시각 입력을 넣는 것과 **일관성** 관점에서, 출근 행 상태변경에도 무언가(출근시각?)를 넣어야 하는가? 단, T4 결정상 **출근시각은 불변(실제 기록값)** 이므로 출근 행에 시각 입력 추가는 원칙과 충돌. 본 PRD는 출근 행 **현행 유지(Non-goal)** 로 가정. → 승인자가 출근 행도 손댈지 확인.
- **Q-3 (휴게 수정 즉시 vs 요청)**: 휴게/퇴근시각 변경을 **수정요청→수락**(본 PRD 채택, T4 일관)으로 할지, **즉시 적용**(상태변경의 changeStatus 처럼)으로 할지? 사용자 지시는 "수정요청 수락 반영"이나, 출근 행 상태변경이 즉시 PATCH 인 것과 흐름이 섞여 UX 일관성 이슈 존재. → 승인자 최종 확인.

## DoD (Definition of Done)

- [ ] AC-1~AC-8 전부 검증 통과(컴포넌트/단위 테스트 + UI 확인).
- [ ] 엣지 E-1~E-6 처리 확인(특히 E-3 명시 휴게 0, E-1 휴게>근무 하한 0).
- [ ] `EditRequestChange.breakMinutes?: number` optional append 완료, 기존 필드·시그니처 불변(append-only).
- [ ] **기존 122 테스트 회귀 0** + 신규 AC 테스트 추가(휴게 반영, 퇴근시각+연장 재계산, breakMinutes 없는 요청 멱등).
- [ ] T4 approve 흐름(멱등 no-op, upsert, 결근/휴가 정책) 회귀 없음.
- [ ] **출근시각(clockIn) 불변** 단언 테스트 통과(AC-8).
- [ ] 휴게 시트에 clockOut 입력 부재 / 퇴근 상태변경 시트에 clockOut 입력 존재 단언.
- [ ] RSC/client 경계 유지(시트 컴포넌트 "use client", store는 server-only).
- [ ] CONTEXT.md §EditRequest·UI 의미 보강 + ADR 0004 작성.
- [ ] Unresolved Q-1~Q-3 승인 게이트에서 해소.
```