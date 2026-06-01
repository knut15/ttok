# ADR 0007 — 과거 누락 근무기록 추가: 빈 날짜 상세 통합 + 추가/수정 스키마 통합

Date: 2026-06-01
Status: Accepted

## Context

기록이 아예 없는 과거 날짜(출근 자체를 안 찍은 날)에서 `AttendanceDetail`은 `record === null` 분기로 "해당 날짜의 근무기록이 없습니다." 빈 메시지만 표시하는 dead-end였다(`AttendanceDetail.tsx` L81-87). 크루가 누락된 과거 근무를 사후 등록할 진입점이 전혀 없어 해당 날짜의 급여·집계가 영구 누락되었다.

백엔드는 이미 레코드 없는 날을 처리할 준비가 되어 있었다 — `addRequest`는 레코드가 없으면 `before`를 빈 스냅샷(`{정상, null, null}`)으로 생성하고, `approveRequest`는 `records.get(date) ?? newRecordFrom(date, after)`로 레코드를 신규 생성(upsert)한다. 두 가지 결정이 필요했다.

- 결정① 추가 진입점을 **빈 날짜 상세(`record===null` 분기)에 통합**할지, **별도 화면/모달**을 신설할지(Q-1).
- 결정② "추가"와 "수정"을 구분하기 위해 **EditRequest 스키마에 신규 필드를 추가**할지, **기존 스키마를 그대로 두고 파생 판별**할지(Q-4).

## Decision

**결정① 빈 날짜 상세 통합** — `AttendanceDetail`의 `record === null` 분기를 교체하여, 미래 날짜(`date > todayDate()`)는 추가 불가 안내, 과거/오늘은 신규 `AddRecordForm`(상태 라디오 5종 + 출근 필수 + 퇴근 선택 + 사유) + 본인 `EditRequestList`(해당 date 필터)를 노출한다(승인 Q1). 진입 동선이 캘린더→날짜 클릭으로 단일하고, 기존 `useEditRequests.submit`·`EditRequestForm` 사유 패턴·`EditRequestList`를 최대 재사용한다. 제출은 `submit({date, reason, after:{status,clockIn,clockOut}})`로 `before`를 보내지 않아 store가 빈 스냅샷을 자동 생성한다. `record≠null` 분기는 불변(AC-2).

**결정② 스키마 통합(파생 판별)** — `EditRequest`/`EditRequestChange` 타입을 변경하지 않고, "추가" vs "수정"을 `before`가 빈 스냅샷(`clockIn===null && clockOut===null && status==="정상"`)인지로 파생 판별한다(`requestKindLabel`, 표시 전용). `EditRequestList`·`MasterRequestList`가 경량 라벨로 표시한다(승인 Q4). 백엔드·타입 무변경(append-only, 회귀 0).

부수 결정: clockIn·clockOut 둘 다 명시된 경우의 역전(`clockOut<=clockIn`)을 `POST /api/attendance/requests`에 1블록 추가(Q5, 진입 가드 = 둘 다 non-null이라 기존 휴게/clockOut-null 요청 미진입). 미래 날짜 서버 방어(`date>todayDate()`→400, Q3)도 추가.

## Consequences

- 누락 과거일 사후 등록 경로 0개 → 1개(추가 폼 → 대기 → 마스터 수락 → upsert 레코드 → 캘린더/급여 반영).
- store/`approveRequest`/`addRequest`/`useEditRequests.submit` 신규 함수 0 — 검증된 upsert 경로 재사용으로 회귀 표면 최소.
- 마스터 컨펌 목록(`GET /api/master/requests`)은 별도 필터 없이 추가요청을 자동 포함(수정요청과 동일 목록).
- 폼 검증(`canSubmitAddRecord`)·라벨 파생(`requestKindLabel`)을 순수 함수로 `domain.ts`에 추출 → node 환경 단위테스트로 행위 검증.
- 기존 206 테스트 불변 + 신규 20(route Q5/미래 4, S3 통합 4, 폼검증 7, 라벨 4, route 정상추가/출근만 등) = 226.

## Alternatives Considered

- **별도 추가 화면/모달 신설** → 채택 안 함: 라우팅·가드 신설 비용이 크고, 빈 날짜 상세가 이미 진입 동선의 자연스러운 종착점이라 기존 컴포넌트 재사용도가 떨어진다(PRD R-5).
- **EditRequest 스키마에 `kind:"add"|"edit"` 필드 추가** → 채택 안 함: append-only·회귀 0 원칙상 타입 변경은 store·route·기존 테스트 전반에 표면을 넓힌다. before 빈값은 이미 "레코드 없던 날"의 충분조건이라 파생 판별로 동일 정보를 무비용 표현한다.
- **clock 역전 미거부(workMinutes 0 하한에 위임)** → 채택 안 함: 데이터는 안전하나 사용자가 역전 입력의 의미를 오인할 수 있어, 폼 비활성 + 서버 400 이중 방어로 명시 거부(승인 Q5).
