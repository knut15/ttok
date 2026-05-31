# ADR 0003 — 연장 산정 기준을 clockOut 정규 종료시각 초과분으로 변경 + 수정요청 수락 멱등 정책

Date: 2026-05-31
Status: Accepted

> NNNN 표기: PRD §10은 파일명을 `0001-overtime-by-clockout.md`로 제안했으나, 본 레포 `docs/adr/`에 이미 0001(in-memory-route-handler)·0002(readonly-profile-fields)가 존재하여 "최대 번호 + 1" 규칙에 따라 0003으로 채번한다.

## Context

선행 task(payroll-bugfix) 리뷰의 T3 follow-up(P1)에서 연장 산정 결함이 드러났다. 기존 `calcOvertime(workMinutes) = max(0, workMinutes − 390)`은 연장을 **근무시간(workMinutes) 초과분**으로 계산한다. 그러나 조기출근으로 workMinutes가 정규 390분을 넘는 경우(예 5/28 07:58 출근·15:00 정시 퇴근 → 392분), 정시에 퇴근했음에도 연장이 2분으로 오산정된다. CONTEXT.md "실근무 인정" 정책은 "연장은 정시 퇴근(15:00) 초과분만 인정"으로, 조기출근분은 연장이 아니다. 본 task의 수정요청 수락(`approveRequest`)으로 clock이 변경되면 이 결함이 런타임에 표면화된다.

또한 수정요청 수락 경로(`approveRequest`/`POST /api/attendance/requests/approve`)를 신규 추가하면서, 동일 요청을 두 번 수락할 때 레코드가 중복 반영되어 work/overtime이 이중 계산될 위험(R2)이 있다.

## Decision

1. **연장 산정 기준 변경**: 연장 = `max(0, parseHHMM(clockOut) − REGULAR_END_MINUTES(900=15:00))`로 정의한다. clockIn·workMinutes에 무관하며 clockOut(퇴근시각)에만 의존한다. 신규 순수 함수 `calcOvertimeByClock({ clockOut })`(`src/lib/time.ts`)와 상수 `REGULAR_END_MINUTES = 900`(`src/lib/constants.ts`)을 추가한다. 재계산을 수행하는 모든 경로(`approveRequest`, `updateStatus` 정상/연장 분기, `upsertTodayClock`)가 이 함수를 사용한다. PRD §3 G2 / 승인 02-approval 핵심 기술 결정 인용: "조기출근·정규내 근무는 연장 아님".
   - **기존 `calcOvertime(workMinutes)`는 시그니처/구현을 보존**한다(append-only). 인자 의미가 workMinutes→clockOut으로 바뀌므로 시그니처 파괴를 피하기 위해 신규 함수를 추가하고 호출부만 교체한다.
2. **수락 멱등 정책(Q2)**: 이미 `status="수락"`인 요청을 재수락하면 레코드를 재반영하지 않고 현 `{request, record}`만 반환하는 **멱등 no-op**(200)으로 처리한다. 409 거부는 채택하지 않는다.
3. **레코드 없는 날 수락(Q1)**: 대상 날짜 레코드가 없으면 after 값으로 신규 레코드를 생성(upsert)한다. 404가 아니다.

## Consequences

- 조기출근·정시퇴근 케이스의 연장 오산정(5/28: 2분 → 0분)이 해소된다(메트릭 "오산정 0건").
- 재계산 로직이 store 내부 private 헬퍼 `recalcClockFields`로 단일화되어 3경로(`approveRequest`/`updateStatus`/`upsertTodayClock`)의 연장 산정이 한 곳으로 수렴한다(DRY).
- seed 불변식 ②(연장 6회/544분)는 보존된다: `buildSeedRecords`는 리터럴 `overtimeMinutes`를 매핑할 뿐 연장 함수를 호출하지 않으므로 함수 변경의 영향을 받지 않는다. 5/28(15:00 퇴근)이 런타임 재계산되어도 `calcOvertimeByClock=0`으로 불변식과 일치한다.
- 멱등 no-op으로 work/overtime 이중 계산이 방지된다(R2 완화).
- 기존 75 테스트는 회귀 0(기존 단정값은 신규 함수로도 동일 통과: 17:00→120, 15:00→0).

## Alternatives Considered

- **`calcOvertime` 시그니처를 clockOut 기반으로 변경** → 채택 안 함. 인자 의미가 바뀌어 기존 호출부·테스트(append-only 원칙)를 파괴한다. 신규 함수 추가가 회귀 위험이 낮다.
- **연장을 `workMinutes − 390`로 유지하되 조기출근을 별도 보정** → 채택 안 함. clockOut 기준 단일 식이 더 단순하고 CONTEXT 정책("정시 퇴근 초과분")과 직접 대응한다.
- **재수락 409 거부** → 채택 안 함. 데모 UX상 멱등 no-op(현 상태 반환)이 클라이언트 reload 흐름과 더 부드럽게 맞물린다(승인 Q2).
- **레코드 없는 날 404** → 채택 안 함. 승인 Q1에서 upsert(after 신규 생성)로 확정.
