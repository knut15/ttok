# ADR 0005 — 계정/권한 분리(마스터·크루) mock 전략: crewId 스코프 전달 + 역할전환 신뢰모델

Date: 2026-06-01
Status: Accepted

## Context

T8(계정/권한 분리)에서 단일 사용자(김민정) 기반 앱을 마스터(점주) 1 + 크루 3 구조로 확장한다.
두 가지 설계 결정이 필요했다.

1. **현재 사용자의 crewId/role 을 어떻게 store/API 까지 전달할 것인가.** 기존 138개 테스트가
   GET 라우트의 URL(쿼리스트링)을 단언하고 있어, 전달 방식이 URL 을 바꾸면 대규모 회귀 보정이 발생한다.
   또 store 의 9개 함수 시그니처를 어떻게 확장해야 단일 사용자 흐름이 깨지지 않는지 결정해야 했다.
2. **인증/세션이 없는 mock 환경에서 "현재 사용자"의 신뢰 모델을 어떻게 둘 것인가.**
   외부 인증·DB 가 없고(ADR 0001), 역할전환은 데모 목적의 클라이언트 토글이다. 서버가
   사용자를 강제 검증할 수단이 없는 상태에서 권한 게이트(수락·집계·초대)를 어디에 둘지 정해야 했다.

## Decision

### 결정 ① crewId 스코프 전략 = 전략 A(trailing append + fallback) + 헤더 전달

- store 의 9개 함수는 **맨 뒤 optional 인자** `crewId: string = DEFAULT_CREW_ID("crew-minjung")` 로 확장한다.
  인자 생략 시 김민정으로 fallback → 기존 단일 사용자 흐름·테스트가 그대로 통과한다(회귀 0). ADR 0004 의
  append-only 선례를 계승한다(`src/lib/store.ts`).
- 내부 표현은 `recordsByCrew: Map<crewId, Map<date, AttendanceRecord>>` / `profilesByCrew` 로 크루별
  물리 분리한다. 김민정 Map 은 기존 `buildSeedRecords()` 를 그대로 재사용(바이트 동일)해 시드 불변식을 보존한다.
- 클라이언트 → 서버 전달은 **HTTP 헤더 `x-crew-id` / `x-role`**(`authHeaders()`)로 한다. 쿼리스트링이 아니므로
  기존 GET URL 단언 테스트가 무영향(회귀 0). 서버는 `readScope(req)`(`src/lib/scope.ts`)로 단일 추출한다.
- 읽기 스코프는 `enforceReadScope` 로 강제한다: **크루는 requested 를 무시하고 본인 crewId 강제**(타인 노출 0),
  **마스터는 requested 허용**(없으면 self). 크루가 타 crewId 를 요청해도 403 이 아니라 본인 데이터로 조용히 강제한다.

### 결정 ② mock 역할전환 신뢰모델 = 클라이언트 선언 + 서버 게이트(이중 방어)

- 현재 사용자는 클라이언트 컨텍스트(`CurrentUserProvider`, `localStorage:crewmon.currentUser`)가 진실원이다.
  역할전환은 검증 없는 클라이언트 토글로, 헤더로 자기 역할을 "선언"한다(인증 없음, mock 신뢰).
- 권한이 필요한 액션(수락·집계·초대)은 **서버 라우트가 `readScope(req).role !== "master"` → 403** 으로 게이트한다
  (`POST /api/attendance/requests/approve`, `GET /api/master/crews`, `POST /api/invites`). store 는 게이트하지 않고
  순수 데이터 연산만 담당(게이트 책임은 라우트로 단일화).
- UI 도 동시에 숨긴다(`EditRequestList.canApprove`, role별 `BottomNav`/`InvitePanel`). **UI 숨김 + API 403 이중 방어**.
- 헤더는 위조 가능하지만(클라이언트 토글이므로 당연), 이는 데모 신뢰 모델상 의도된 한계다(실제 인증은 미구현).

## Consequences

- 기존 138 테스트 + 청크별 신규 테스트 모두 GREEN(회귀 0). 헤더 방식 덕에 URL 단언 보정 0줄.
- 크루 데이터 격리·마스터 집계·초대·수락 게이트가 일관된 단일 스코프 추출(`readScope`/`enforceReadScope`)로 동작.
- 한계: 헤더 위조 방어 없음(mock). 서버 재시작 시 초대·전환 상태 소실(인메모리, ADR 0001). 실제 배포 시 세션 인증으로 교체 필요.
- `/master` 가드는 클라이언트에서만 가능(role 진실원이 localStorage) → mount 게이트로 하이드레이션 안전·섣부른 리다이렉트 방지.

## Alternatives Considered

- **전략 B: store 를 crewId 필수 인자로 전면 리팩토링** → 기존 9개 함수 호출부·테스트 전부 수정 필요(회귀 대량). 채택 안 함.
- **쿼리스트링 `?crewId=` 로 현재 사용자 전달** → 기존 GET URL 단언 테스트가 깨짐(회귀). 마스터의 명시적 target 조회에만 보조로 허용하고, 현재 사용자 전달은 헤더로 분리. 채택 안 함(주 전달 수단으로는).
- **서버 세션/쿠키 기반 인증** → 외부 인증·DB 부재(ADR 0001)와 충돌, mock 데모 범위 초과. 채택 안 함.
- **크루의 타 crewId 요청을 403 으로 거부** → UX 상 조용한 본인 강제가 더 단순하고 노출 위험 동일하게 0. 마스터 전용 액션만 403 으로 구분. 채택 안 함(읽기 스코프에 한해).
