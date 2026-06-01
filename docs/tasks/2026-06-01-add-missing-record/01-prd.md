# 📋 PRD (v1) — 과거 누락 근무기록 추가 → 승인 대기 (T15)

- **Task**: 2026-06-01-add-missing-record
- **작성자**: task-planner
- **상태**: 승인 대기
- **유형**: 기존 Crewmon 앱 기능 추가 (1 FR)
- **참조 디자인**: `public/sample/IMG_3609.png` (근무기록 상세 — 출/퇴근/휴게 카드 + 요청사유 + 수정 요청내역 행)

---

## 1. 배경 / 문제 정의

- **현재**: Crewmon은 인메모리 store 기반 멀티크루 출퇴근·급여 앱이다(`CONTEXT.md` §"crewId 스코프"). 근무기록 상세(`AttendanceDetail`, `/attendance/[date]`)는 레코드가 있는 날에 대해 출/퇴근/휴게 편집(상태변경·시간변경 → 수정요청 → 마스터 수락) 경로를 제공한다. 단일일 상세 조회 계약은 유효 날짜면 기록 유무와 무관하게 200(기록 없음 시 body `null`)을 반환한다(`CONTEXT.md` §"단일일 상세 조회 계약").
- **문제**: **기록이 아예 없는 과거 날짜**(예 출근 자체를 안 찍은 날, 시스템 미입력)에서는 `AttendanceDetail`이 `!record` 분기로 "해당 날짜의 근무기록이 없습니다."만 표시하고(`AttendanceDetail.tsx` L81-87) **추가 진입점이 전혀 없다**. 크루가 누락된 과거 근무를 사후 등록할 방법이 없어, 해당 날짜의 급여·집계가 영구히 누락된다.
- **근거**: `AttendanceDetail.tsx` L81-87(빈 상태 dead-end), 사용자 요청("근무기록 누락 시 과거 기록 추가 → 크루가 직접 입력 후 승인 대기"). 백엔드 `approveRequest`는 이미 레코드 없는 날을 `after`로 신규 생성(upsert)하도록 구현되어 있어(`store.ts` L347-348 `newRecordFrom`, T4 Q1) 추가 기록의 레코드 생성 경로가 **준비되어 있다**(아래 §3 확인 결과).

---

## 2. 목표 / 비목표

### 목표 (Goals)
- 기록이 없는 과거 날짜의 상세에서 크루가 **출근/퇴근·상태를 직접 입력**하여 **수정요청(대기)을 생성**할 수 있다(기존 EditRequest 흐름·검증 재사용).
- 마스터가 그 추가요청을 수락하면 `approveRequest` upsert로 **해당 날짜·해당 크루 레코드가 신규 생성**되어 이후 캘린더·급여·집계에 반영된다.
- 크루는 **본인 날짜만** 추가할 수 있다(crewId 스코프 강제). 마스터 수락 게이트 유지.
- 추가요청은 **마스터 컨펌 목록(MasterRequestList)** 과 **크루 본인 요청내역(EditRequestList)** 양쪽에 대기 표시된다.
- 기존 **206개 테스트 회귀 0**, 기존 수정요청/수락/캘린더 동작 불변.

### 비목표 (Non-goals / Out-of-scope)
- 추가요청 **거절/철회/수락취소** (현행 EditRequest 정책 그대로 미지원, `CONTEXT.md` §EditRequest).
- **휴게 범위 입력** UI를 추가 폼에 신설 — 추가 시에는 휴게 미입력(레코드 생성 시 DEFAULT 30분, `newRecordFrom`). 휴게 편집은 기존 레코드 보유일의 `BreakChangeSheet` 경로 유지.
- **신규 store/API 함수 도입** — `addRequest`/`approveRequest`/`POST /api/attendance/requests`·`approve`·`GET /api/master/requests`·`MasterRequestList`를 그대로 재사용(백엔드 변경 없음 목표).
- **EditRequest 타입 스키마 변경** — 추가 vs 수정 구분은 `before`가 빈값(`{status:"정상", clockIn:null, clockOut:null}`)인 것으로 파생 판별(표시 전용). 신규 필드 미추가(append-only, 회귀 0).
- 실 DB·인증 도입(인메모리 store 유지). 출근시각 산식·연장 정책 변경 없음.
- 미래 날짜 추가 허용 여부의 **확정 정책** — §11 Q-3으로 승인자 위임(본 PRD는 default 권고만).

---

## 3. 솔루션 개요

빈 날짜 상세(`AttendanceDetail`, `record === null` 분기)에 현재의 dead-end 빈 메시지 대신 **"근무 추가" 진입점(버튼/폼)** 을 노출한다. 크루가 출근 시각·퇴근 시각·상태를 입력하고 사유를 적어 제출하면, 기존 `useEditRequests.submit` → `POST /api/attendance/requests`(after = {status, clockIn, clockOut}, before는 store `addRequest`가 레코드 없으므로 자동으로 빈 스냅샷 생성) 경로로 **대기 상태 EditRequest**가 생성된다. 마스터가 컨펌 목록(`MasterRequestList`)에서 수락하면 기존 `approveRequest`의 upsert 분기(`store.ts` L347-348)가 해당 `crewId`·날짜 레코드를 신규 생성하고 `대기→수락` 전이한다 — 이후 캘린더·급여에 자연히 반영된다.

**백엔드 준비 확인 결과(정독 완료)**:
- `addRequest`(`store.ts` L278-306): 대상 날짜 레코드가 없으면 `before = {status:"정상", clockIn:null, clockOut:null}`로 생성하고 `after`를 그대로 담아 `대기` 요청 push. **레코드 없는 날 요청 생성 동작 확인됨** — 추가 시나리오 그대로 사용 가능.
- `approveRequest`(`store.ts` L315-391): `records.get(req.date) ?? newRecordFrom(req.date, after)`로 **레코드 없으면 신규 생성(upsert)** 후 status별 정책(정상/연장 → clock 재계산, 결근 → 전액차감, 휴가 → 무급) 적용. **추가요청 수락 시 레코드 생성 경로 준비됨 확인** — Q1 멱등·upsert 기존 검증 계승.
- `POST /api/attendance/requests`(`route.ts`): after `status`/`clockIn`/`clockOut` 완전체 요구, 형식(HH:MM, NaN → 400)·휴게 역전 검증 + 빈 사유 400 + 생성자 본인 crewId 태그(`readScope`). **추가요청도 이 검증을 그대로 통과해야 함** — 추가 폼이 동일 body 계약을 따르면 신규 검증 불필요.
- `MasterRequestList`/`GET /api/master/requests`: `listRequests()`(전체 최신순) ⨝ 크루명을 내려 마스터가 수락. **추가요청도 동일 목록에 떠야 함**(별도 필터 없음 → 자동 포함).
- 따라서 본 task는 **FE 추가 진입/폼이 핵심**이며 백엔드는 무변경을 목표로 한다(검증 결과 §S2/S3에서 통합테스트로 확정).

추가 vs 수정 구분이 표시상 필요하면(요청내역 행에 "추가" 라벨 등) `before.clockIn === null && before.clockOut === null && before.status === "정상"`(레코드 없던 날 = 빈 before)로 파생 판별한다 — 백엔드/타입 무변경, 표시 전용(§11 Q-4).

### 활용할 프로젝트 자원
- `CONTEXT.md` §"근무기록 수정요청(EditRequest)"/"단일일 상세 조회 계약"/"마스터 수정요청 컨펌"/"crewId 스코프"/"읽기 스코프 강제": 추가요청 흐름·격리·upsert·표시 정의의 단일 출처 — phase 2.5/3 작성 기준 (정독 완료).
- `src/lib/store.ts`(`addRequest`, `approveRequest` upsert, `newRecordFrom`): 레코드 없는 날 요청 생성·수락 시 레코드 신규 생성 재사용(신규 store 함수 불필요 목표) — phase 3.
- `src/app/api/attendance/requests/route.ts`(POST 형식·역전·빈사유 검증 + crewId 태그): 추가요청 제출이 통과해야 할 계약 — phase 3에서 재사용(신규 검증 지양).
- `src/features/attendance/hooks/useAttendance.ts`(`useDayAttendance`, `useEditRequests.submit`/`requests`): 빈 날짜에서도 본인 스코프 GET·POST·요청내역 표시 재사용 — phase 3.
- `src/features/attendance/components/EditRequestForm.tsx`(사유 0~100자·trim·빈값 비활성), `EditRequestList.tsx`(요청내역·대기 배지): 추가 폼 사유부·본인 요청내역 표시 재사용 — phase 2.5/3.
- `src/features/attendance/components/ClockOutStatusSheet.tsx`/`StatusChangeSheet.tsx`(상태 라디오 5종 + 시각 입력 + `parseHHMM` 유효성): 추가 입력 UI 패턴 참조 — phase 2.5/3.
- `src/features/accounts/components/MasterRequestList.tsx` + `GET /api/master/requests`: 추가요청 마스터 컨펌 표시(자동 포함) — phase 3 통합테스트 대상.
- `src/lib/date.ts`(`isValidDateString`, `todayDate`), `src/lib/time.ts`(`parseHHMM`): 날짜 유효·시각 형식 검증 — phase 3.

### 프로젝트 구조 (feature-based, append-only)
- 패턴: feature-based (`src/features/{attendance,accounts,...}`) + Next.js App Router route handlers (`src/app/api/...`) + 인메모리 store 단일 진실원.
- 신규 산출물 배치:
  - 추가 진입/폼 컴포넌트 → `src/features/attendance/components/` (예 `AddRecordForm.tsx` 또는 `AttendanceDetail` 빈 분기 내 인라인 — §11 Q-1 결정에 따름).
  - 컴포넌트 테스트 → 동일 폴더 `*.test.tsx`, 통합테스트 → `src/app/api/attendance/requests/route.test.ts` 등 기존 패턴 답습.
  - 백엔드 변경 목표 없음(무변경 시 신규 API 파일 없음). 변경 발생 시 in-place append.

---

## 1.5 Sub-task 분해

| # | Sub-task | 산출물 | 사용 가능한 자원 | 의존 |
|---|---|---|---|---|
| **S1** | 빈 날짜 추가 진입/폼 UI | `AttendanceDetail` `record===null` 분기에 "근무 추가" 진입(버튼→폼 또는 인라인 폼). 입력: 출근시각·퇴근시각·상태(기본 정상)·사유. 미래/이미기록일은 §S4 가드 적용. | `EditRequestForm`(사유), `ClockOutStatusSheet`/`StatusChangeSheet` 패턴, `parseHHMM` | — |
| **S2** | 추가요청 제출 → 대기 생성 배선 | 폼 submit → `useEditRequests.submit({date, reason, after:{status, clockIn, clockOut}})` → `POST /api/attendance/requests` 201. 본인 crewId 태그(authHeaders). 제출 후 요청내역 reload. | `useEditRequests.submit`, `route.ts` POST(기존 검증) | S1 |
| **S3** | 마스터 수락 → 레코드 upsert 검증(통합테스트) | `route.test.ts`: 레코드 없는 날 추가요청 생성 → 마스터 수락 → 해당 crewId·날짜 레코드 신규 생성 + status별 재계산 + 캘린더/월조회 반영 케이스. 백엔드 무변경 확인. | `addRequest`/`approveRequest`/`__resetStore`, `api/master/requests` | S2(계약), 백엔드 |
| **S4** | 입력 가드/엣지 처리 | 이미 기록 있는 날 추가 버튼 미노출(record≠null이면 기존 편집 경로), 미래 날짜(§Q-3 정책), 시각 역전·형식, 사유 빈값(§Q-2), 중복 추가요청(§E-7) 처리. | `route.ts` 형식·역전 검증, `isValidDateString`/`todayDate` | S1 |
| **S5** | 표시 일관성(추가 vs 수정 라벨, 선택) | (§Q-4 결정 시) 요청내역·마스터 목록에서 before 빈값=추가 파생 라벨 표시. 미채택 시 무산출물. | `EditRequestList`/`MasterRequestList`, before 파생 판별 | S2, Q-4 |

---

## 4. Acceptance Criteria (객관 검증 가능)

### 추가 진입 & 폼

- **AC-1** (빈 날짜 추가 진입): Given 크루 본인의 **기록 없는 과거 날짜** 상세(`/attendance/<date>`, GET 200 + body `null`), When 상세가 렌더되면, Then "해당 날짜의 근무기록이 없습니다." dead-end 대신 **"근무 추가" 진입점(버튼/폼)** 이 노출된다.
- **AC-2** (이미 기록 있는 날 미노출): Given 크루 본인의 **레코드가 있는 날짜** 상세, When 상세가 렌더되면, Then "근무 추가" 진입점은 **노출되지 않고** 기존 출/퇴근/휴게 편집(상태변경·시간변경) 카드가 그대로 표시된다(record≠null 분기 불변).
- **AC-3** (입력 필드): Given 추가 폼 노출, When 입력하면, Then 출근시각(HH:MM)·퇴근시각(HH:MM, §Q-2)·상태(라디오 5종, 기본 "정상")·사유(0~100자 카운터)를 입력할 수 있다.

### 제출 → 대기 생성

- **AC-4** (제출 → 대기 EditRequest 생성): Given 크루B(`crew-2`)가 기록 없는 날 `2026-05-04`에 출근 08:00·퇴근 15:00·상태 정상·사유 입력, When 제출하면, Then `POST /api/attendance/requests`가 `x-crew-id: crew-2` 헤더 + body `{date:"2026-05-04", reason, after:{status:"정상", clockIn:"08:00", clockOut:"15:00"}}`로 전송되어 **201 + status `대기`** EditRequest가 `crew-2` 태그로 생성된다(레코드는 아직 미생성).
- **AC-5** (before 빈 스냅샷): Given AC-4의 생성된 요청, When store에서 조회하면, Then 레코드가 없던 날이므로 `before = {status:"정상", clockIn:null, clockOut:null}`이고 `after`는 입력값 그대로다(`addRequest` L292 동작).
- **AC-6** (크루 본인 스코프): Given 크루B가 추가 제출, When 서버가 처리하면, Then 요청은 항상 **생성자 본인 `crewId`(crew-2)** 로 태그되며(`readScope(request).crewId`, route.ts L99) 타 크루 날짜·태그로 생성될 수 없다.

### 마스터 수락 → 레코드 upsert 생성

- **AC-7** (수락 시 레코드 신규 생성): Given AC-4의 대기 추가요청, When 마스터(`x-role: master`)가 `POST /api/attendance/requests/approve` `{id}`로 수락하면, Then `approveRequest` upsert로 **`crew-2`·`2026-05-04` 레코드가 신규 생성**되고(`newRecordFrom` 기반) status="정상"이라 clock 재계산(`recalcClockFields`)되며 요청 status가 `대기→수락`으로 전이된다. 응답 200 `{request, record}`.
- **AC-8** (캘린더/월조회 반영): Given AC-7 수락 후, When `crew-2`로 `GET /api/attendance?month=2026-05`(또는 `/api/attendance/2026-05-04`)를 조회하면, Then 신규 생성된 `2026-05-04` 레코드가 포함되어 캘린더·급여 집계에 반영된다(이전엔 미포함).
- **AC-9** (마스터 컨펌 목록 표시): Given AC-4의 추가요청 대기, When 마스터가 `GET /api/master/requests`를 조회하면, Then 해당 추가요청이 **수정요청과 동일 목록**에 크루명과 함께 최신순 포함되고 `MasterRequestList`에 대기 행 + 수락 버튼으로 렌더된다(추가요청 전용 필터 없음, 자동 포함).

### 요청내역 표시 & 검증

- **AC-10** (크루 본인 요청내역 표시): Given 크루B가 추가요청 제출 후 해당 날짜 상세를 보면, When `EditRequestList`(본인 `crewId` 태그 + `r.date===date` 필터)가 렌더되면, Then 방금 만든 추가요청이 **대기 배지**로 표시된다.
- **AC-11** (형식 검증 — 역전/잘못된 시각): Given 추가 폼에서 출근 15:00·퇴근 08:00(역전) 또는 비-HH:MM 시각을 제출, When `POST /api/attendance/requests`가 처리하면, Then 기존 route 검증(clock NaN → 400; after 완전체 요구)으로 차단되거나 폼 단계에서 비활성/검증되어 **대기 요청이 생성되지 않는다**. (시각 역전 자체에 대한 clockIn/clockOut 역전 거부 정책 확정은 §Q-5 — 현 route는 휴게 역전만 거부, clock 역전은 미거부 가능성 → 확인 필요.)
- **AC-12** (사유 빈값): Given 추가 폼 사유가 빈값/공백, When 제출하려 하면, Then `EditRequestForm` 패턴대로 버튼이 **비활성**(trim 길이 0)이고, 우회 제출 시 route가 **빈 사유 400**(`route.ts` L40-45)으로 차단한다.

### 회귀 방지

- **AC-R1**: 기존 **206개 테스트 전부 통과**(회귀 0). 신규 테스트는 총계 증가만(기존 감소 0).
- **AC-R2** (기존 수정요청 흐름 불변): 레코드 **있는** 날의 상태변경·시간변경·휴게변경 → 수정요청 → 마스터 수락 경로가 변경 없이 동작한다(`AttendanceDetail` record≠null 분기 불변).
- **AC-R3** (수락/upsert 멱등 불변): 기존 `approveRequest` 멱등 no-op(이미 수락 재수락 시 레코드 불변)·status별 정책(결근 전액차감/휴가 무급)이 추가요청 수락에도 동일 적용된다(`store.test.ts` 통과).
- **AC-R4** (마스터 게이트 유지): `POST /api/attendance/requests/approve`·`GET /api/master/requests`는 role≠master → **403 + store 불변**(approve 미호출).
- **AC-R5** (캘린더 불변): 기존 레코드 보유일의 캘린더 배지·급여 집계는 본 task로 변경되지 않는다(추가는 신규 날짜에만 레코드 생성).
- **AC-R6** (단일일 상세 계약 불변): `GET /api/attendance/[date]`는 유효 날짜면 기록 유무와 무관 200(+ null), 잘못된 형식만 404 — 빈 날짜 추가 진입 도입이 이 계약을 깨지 않는다(`CONTEXT.md` §"단일일 상세 조회 계약").

---

## 5. 엣지 케이스

| # | 케이스 | 기대 동작 |
|---|---|---|
| **E-1** | 이미 기록 있는 날 추가 시도 | 추가 진입점 **미노출**(record≠null 분기는 기존 편집 카드). 추가 폼은 빈 날짜에만(AC-2). |
| **E-2** | 미래 날짜 추가 | §Q-3 정책 적용. 권고 default: **미래 날짜는 추가 진입점 비노출/거부**(누락 보정은 과거 한정 의미). 확정은 승인자. |
| **E-3** | 시각 형식 오류(비 HH:MM) | route `parseHHMM` NaN → **400**, 대기 요청 미생성. 폼에서도 input type=time/검증으로 1차 차단(AC-11). |
| **E-4** | 출/퇴근 시각 역전(퇴근<출근) | §Q-5. 현 route는 clock 역전 미거부 가능성(휴게 역전만 명시 거부). 거부 정책 채택 시 폼/route 검증 추가, 미채택 시 `recalcClockFields`가 workMinutes 음수→0 하한 처리(`CONTEXT.md` 근무시간 정의)로 안전. **확인 필요**(developer/architect). |
| **E-5** | 사유 빈값/공백 | 버튼 비활성(EditRequestForm trim 0) + route 빈사유 400(AC-12). |
| **E-6** | 퇴근시각 미입력 | §Q-2. after.clockOut=null 허용 시 레코드 생성 후 `recalcClockFields`가 clock 한쪽 null → work/overtime 0(`store.ts` L69). 필수화 채택 시 폼 비활성. **확정은 승인자**. |
| **E-7** | 중복 추가요청 | 같은 날 추가요청을 또 제출 → store는 막지 않고 **별도 대기 요청 누적**(append). 마스터가 2건 각각 수락하면 두 번째가 레코드를 덮어씀(멱등 아님, 다른 id). 권고: 표시상 경고 또는 기존 대기 요청 존재 시 추가 진입 제한(§Q-6) — default는 **누적 허용**(기존 EditRequest 동작과 일관, 막지 않음). |
| **E-8** | 잘못된 날짜 형식 URL | `/attendance/2026-05-99`는 RSC 셸 `notFound()`(page.tsx L13) — 추가 진입 자체 도달 불가(AC-R6 계약 불변). |
| **E-9** | 신규/타 크루 빈 Map | 추가 수락 시 `crewRecords`가 해당 crewId Map 없으면 생성(`store.ts` L107-114) — 본인에게만 기록(격리). |

---

## 6. 데이터 모델 / API 계약 (재사용 — 신규 없음 목표)

```
// 추가요청 제출 (기존 재사용)
POST /api/attendance/requests
  headers: { x-crew-id, x-role }   // 본인 스코프 태그
  body: {
    date: "2026-05-04",            // 기록 없는 과거 날짜
    reason: "출근 미입력 누락 보정", // 1~100자 (trim)
    after: { status: "정상", clockIn: "08:00", clockOut: "15:00" }
                                    // before 는 store 가 빈 스냅샷 자동 생성
  }
  → 201 EditRequest(status:"대기", crewId 태그, before:빈)

// 마스터 수락 → 레코드 upsert (기존 재사용)
POST /api/attendance/requests/approve  { id }  // role=master only
  → 200 { request:(수락), record:(신규 생성) }   // 404/403 그대로

// 마스터 컨펌 목록 (기존 재사용 — 추가요청 자동 포함)
GET /api/master/requests  → 200 { requests: MasterRequestRow[] }
```

EditRequest/EditRequestChange 타입 변경 없음(`types/index.ts` L22-39). "추가" 구분은 `before`가 빈값인 것으로 파생(표시 전용, §Q-4).

---

## 7. 메트릭 (성공 판정 정량 지표)

| 지표 | 현재 | 목표 |
|---|---|---|
| 누락 과거일 사후 등록 가능 경로 | 0개(dead-end) | 1개(추가 폼 → 대기 → 수락 → 레코드) |
| 추가요청 수락 → 레코드 생성 통합테스트 통과율 | — | **100%**(생성·재계산·월조회 반영) |
| 기존 테스트 회귀율 | 206 통과 | **0건 감소**(206 + 신규) |

---

## 8. 의존성 / 선행 조건

- **선행 없음**(독립 task). `addRequest`/`approveRequest` upsert·`POST /api/attendance/requests`·`approve`·`GET /api/master/requests`·`MasterRequestList`가 모두 기존 존재 — 신규 서버 인프라 불필요(무변경 목표).
- 테스트 러너(vitest 추정)·`__resetStore` 격리 유틸 의존.
- T8(crewId 스코프)·T10(마스터 컨펌)·T4(approveRequest upsert) 선행 구현에 의존(모두 완료 상태).

---

## 9. 리스크

- **R-1** (백엔드 무변경 가정 오류): `addRequest`/`approveRequest` upsert가 추가 시나리오에서 예상대로 동작하지 않으면 백엔드 수정 필요. → §S3 통합테스트로 **승인 전 가정 검증**(정독상 준비됨 확인, 테스트로 확정).
- **R-2** (clock 역전 미거부): route가 clockIn/clockOut 역전을 거부하지 않으면 퇴근<출근 레코드 생성 가능. → workMinutes 0 하한으로 데이터 안전하나 UX 혼란. §Q-5 정책 확정 + 폼 검증으로 완화.
- **R-3** (중복 추가요청 누적): 같은 날 다중 대기 요청 → 마스터 혼란/이중 수락. → §Q-6 default 누적 허용(기존 동작 일관)이되 표시 경고/진입 제한은 승인자 판단.
- **R-4** (미래 날짜 의미 모호): "과거 누락"이 본질이나 폼이 미래도 허용하면 의도 이탈. → §Q-3 default 과거 한정 권고.
- **R-5** (추가 진입 위치 혼선): 빈 날짜 상세 vs 별도 화면 — 사용자가 어디서 추가하는지. → §Q-1 default 빈 날짜 상세 권고(진입 동선 단일, 기존 EditRequestForm/List 재사용 최대화).

---

## 10. Repository Artifacts 갱신 대상

| 종류 | 대상 파일 | 갱신 사유 |
|---|---|---|
| 도메인 용어 | `CONTEXT.md` §"근무기록 수정요청(EditRequest)" 보강 | "**레코드 없는 과거 날짜에서 크루가 출/퇴근·상태를 직접 입력해 추가요청(before 빈 스냅샷)을 생성하고, 마스터 수락 시 approveRequest upsert로 레코드를 신규 생성**한다. 추가 vs 수정은 before 빈값으로 파생 판별(표시 전용, 스키마 무변경)." 1~2줄 추가. |
| 도메인 용어 | `CONTEXT.md` §"편집 시트 역할(AttendanceDetail)" 보강 | "**record 없는 날: 편집 카드 대신 '근무 추가' 폼 노출**(크루 본인·과거 한정), 제출 시 수정요청(대기) 경로 공유." 1줄 추가. |
| 결정 사유 (ADR) | (조건부) `docs/adr/0007-add-missing-record.md` | **결정 2건 이상일 때만**. 후보 결정: ① 추가 진입을 빈 날짜 상세에 통합(별도 화면 X, Q-1) ② 추가/수정 EditRequest 스키마 통합(신규 필드 X, before 파생 판별, Q-4). 이 2건이 승인에서 확정되면 ADR 1개 작성. 미확정/단일이면 미작성. |
| 운영 메타 | `.task-orchestrator.yml` | 변경 없음(protected_files/검증강도 오버라이드 불필요). |

---

## 11. 📌 Unresolved Questions (승인자 판단 위임)

- **Q-1 (추가 진입 위치)** — 추가 진입점을 **(a) 빈 날짜 상세(`/attendance/[date]` record=null 분기)에 통합** vs **(b) 별도 화면/모달**?
  - planner 권고: **(a) 빈 날짜 상세**. 진입 동선이 캘린더→날짜 클릭으로 단일하고, 기존 `EditRequestForm`(사유)·`EditRequestList`(본인 내역)·시각 입력 시트 패턴을 최대 재사용. (b)는 라우팅/가드 신설 비용.
- **Q-2 (퇴근시각 필수 여부)** — 추가 시 퇴근시각을 **필수** vs **선택(null 허용)**?
  - planner 권고: **선택(null 허용)**. `ClockOutStatusSheet`도 clockOut 빈값(null)을 허용하고(`canApply` L27), 레코드 생성 시 clock 한쪽 null → work/overtime 0으로 안전. 단 "누락 보정"의 실용성상 출근만 입력하는 케이스 드물면 필수화도 합리적 — 승인자 확정.
- **Q-3 (미래 날짜 허용 여부)** — 미래 날짜 추가를 **거부(과거 한정)** vs **허용**?
  - planner 권고: **거부(과거+오늘 한정)**. "근무기록 누락"의 의미상 미래 사전 등록은 범위 밖. 폼 진입 시 `date > todayDate()`면 비노출/거부. (사용자가 사전 스케줄 입력을 의도했다면 별도 task로 분리.)
- **Q-4 (추가/수정 표시 구분)** — 요청내역·마스터 목록에서 "추가"와 "수정"을 **시각적으로 구분 표시** vs **동일 표시**?
  - planner 권고: **경량 구분**(before 빈값 → "추가" 라벨/배지, 표시 전용·스키마 무변경). 마스터가 신규 생성인지 정정인지 판단에 유용. 미채택 시 동일 표시(S5 무산출물).
- **Q-5 (clockIn/clockOut 역전 거부)** — 출근>퇴근(역전) 입력을 **명시 거부(400/폼 비활성)** vs **허용(workMinutes 0 하한)**?
  - planner 권고: **폼 단계 비활성 + (가능하면) route 검증 추가**. 현 route는 휴게 역전만 거부하고 clock 역전은 미거부로 보임 → developer가 기존 route 검증 정독 후 확정(역전 거부를 route에 추가하면 기존 수정요청에도 영향 → 회귀 확인 필요). **확인 필요 항목**.
- **Q-6 (같은 날 중복 추가요청)** — 같은 빈 날짜에 대기 추가요청이 이미 있을 때 **추가 진입 제한** vs **누적 허용**?
  - planner 권고: **누적 허용**(기존 EditRequest 다건 동작과 일관, 막지 않음). 단 UX상 "이미 대기 중 요청 있음" 안내 표시는 선택적. 강제 제한은 승인자 판단.

---

## ✅ Definition of Done

- [ ] S1~S5 산출물 구현 완료, feature-based·append-only 준수.
- [ ] AC-1 ~ AC-12 전부 충족(검증 가능 근거 첨부).
- [ ] AC-R1 ~ AC-R6 회귀 방지 충족 — 기존 **206 테스트 통과** + 신규 추가요청 통합/컴포넌트 테스트 추가(기존 감소 0).
- [ ] 엣지 E-1 ~ E-9 처리·검증.
- [ ] 백엔드 무변경 가정이 S3 통합테스트로 확정(addRequest/approveRequest upsert 추가 시나리오 통과). 변경 필요 시 회귀 0 확인.
- [ ] 크루 본인 스코프(crewId 태그)·마스터 수락 게이트(403 이중 방어) 유지.
- [ ] 단일일 상세 조회 계약(200+null) 불변, 캘린더/급여 집계 기존 레코드 불변.
- [ ] §10 Repository Artifacts(CONTEXT.md 용어 2건 보강, ADR 0007 조건부) 갱신.
- [ ] Unresolved Q-1~Q-6 승인 게이트에서 확정 → AC/엣지 정책 fix(특히 Q-2 퇴근필수·Q-3 미래·Q-5 역전).
- [ ] reviewer 검증 통과.
