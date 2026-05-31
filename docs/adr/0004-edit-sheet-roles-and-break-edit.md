# ADR 0004 — 편집 시트 역할 분리 + 범위형 휴게 편집(분 파생)

Date: 2026-05-31
Status: Accepted

> NNNN 표기: `docs/adr/`에 0001~0003이 존재하여 "최대 번호 + 1" 규칙에 따라 0004로 채번한다.

## Context

`AttendanceDetail`의 "휴게" 행에 달린 '시간변경' 버튼이 의미상 무관한 **퇴근시각(clockOut)** 을 편집하던 `TimeChangeSheet`를 열고 있었다(잘못된 배선). 그 결과 (1) 휴게시간을 실제로 편집할 경로가 없고, (2) 퇴근시각 편집 진입점이 휴게 행에 오배치되어 라벨·동작이 불일치했다. 참조 디자인은 출근/퇴근=상태변경, 휴게=시간변경 구조를 의도한다.

또한 승인 단계에서 휴게 입력 형식을 PRD 가정(분 단위 단일 입력)에서 **범위형(휴게 시작~종료, HH:MM~HH:MM)** 으로 뒤집는 결정이 내려졌다(승인 Q1). 휴게를 어떻게 저장·반영할지, 그리고 휴게/퇴근 편집을 즉시 적용할지 수정요청 경로로 통일할지 결정이 필요했다.

## Decision

1. **편집 흐름을 수정요청→수락 경로로 통일한다**(즉시 PATCH 신설 금지, 승인 Q3). 휴게·퇴근시각 편집 모두 기존 T4 approve 파이프(`POST /requests` → `POST /requests/approve` → `approveRequest`)를 재사용한다. 출근 행 상태변경만 기존 즉시 PATCH(`changeStatus`)를 현행 유지한다(승인 Q2). PRD §3 "두 편집 모두 기존 T4 approve 파이프를 재사용한다 … 신규 즉시-적용 API를 만들지 않으므로 회귀면이 좁고".

2. **휴게를 범위(`breakStart`/`breakEnd`, HH:MM)로 저장하고 `breakMinutes`는 파생 캐시로 둔다**(아키텍처 §0 안 A). `AttendanceRecord`·`EditRequestChange`에 `breakStart?`/`breakEnd?`를 optional append하고, `breakMinutes`(필수 number)는 보존한다. 범위가 둘 다 있으면 `calcBreakMinutes`(`src/lib/time.ts`, `max(0, breakEnd−breakStart)`)로 파생, 없으면 기존 `breakMinutes` 유지. 시드 근무일에 `11:30`/`12:00`을 부여해 파생 30분 = 기존값으로 회귀 0을 보장한다.

3. **R1(휴게 0 복원 충돌) 해소**: `recalcClockFields`에서 ① 범위 둘 다 명시 → 파생값 절대 존중(0이어도 DEFAULT 복원 안 함), ② 범위 없음 + `breakMinutes>0` → 기존값, ③ 범위 없음 + `breakMinutes===0` → DEFAULT 복원(레거시·휴가 역전환 호환). 범위 명시일 때만 `===0` 복원을 우회한다.

## Consequences

- 시트 3종으로 역할이 명확히 분리된다: 출근=`StatusChangeSheet`(즉시 PATCH), 퇴근=`ClockOutStatusSheet`(상태+퇴근시각, 요청), 휴게=`BreakChangeSheet`(범위 2입력, 요청). 잘못 배선된 `TimeChangeSheet`는 제거.
- `breakMinutes`의 기존 소비처(seed/pay/store/PayDetail)는 시그니처 불변 — append-only로 회귀 0(기존 122 테스트 유지). 이중 저장(범위+분)의 정합 책임은 `calcBreakMinutes` 단일 파생 규칙으로 흡수.
- 출근시각(clockIn)은 모든 편집 경로에서 불변(`after.clockIn = record.clockIn`).
- 휴게 0 의도는 범위형 UX에서 동일/역전 시각 입력 시 '적용' 비활성으로 흡수되며, 서버는 동일/역전 범위를 fallback(0)으로 처리한다.

## Alternatives Considered

- **휴게를 분 단위 단일 입력(`breakMinutes` 직접 편집)으로 유지** → 채택 안 함. 승인이 범위형으로 결정했고, 범위 표시(`DEFAULT_BREAK_RANGE`)와 편집의 정합이 깨진다.
- **`breakStart`만 저장 + duration 파생(안 B)** → 채택 안 함. 종료시각 표현 불가로 범위 표시가 불가능(디자인 위배).
- **`breakMinutes` 제거하고 전면 파생(안 C)** → 채택 안 함. seed/pay/store 등 소비처 전면 개수 필요 → append-only 위배·122 회귀 위험.
- **휴게/퇴근 편집을 즉시 PATCH로 적용** → 채택 안 함. T4 approve 파이프와 흐름이 갈라져 회귀면이 넓어진다(승인 Q3는 수정요청 경로 채택).
