# ADR 0006 — 마스터 수정요청 컨펌: 신규 라우트 + 서버 조인

Date: 2026-06-01
Status: Accepted

## Context

크루가 생성한 근무기록 수정요청(`EditRequest`)은 `crewId`로 태그되고, 수락(`approveRequest` / `POST /api/attendance/requests/approve`, 마스터 게이트 403)은 이미 존재했다. 그러나 마스터가 **전체 크루의 수정요청을 한 화면에서 조회·수락하는 경로가 없었다.** 기존 `GET /api/attendance/requests`는 크루 본인 스코프(`enforceReadScope`)에 묶여 있어 마스터가 타 크루 요청을 보지 못했다. 두 가지 결정이 필요했다.

- 결정① 조회 API를 **신규 라우트로 분리**할지, 기존 `/api/attendance/requests`에 **마스터 분기를 재사용**할지.
- 결정② 요청 행에 표시할 크루 이름을 **서버에서 조인**할지, 클라가 `/api/crews`로 **별도 매핑**할지(요청 2회).

## Decision

**결정① 신규 라우트 `GET /api/master/requests`** — `api/master/crews` 게이트 패턴을 복제(`readScope(req).role !== "master"` → 403)하여 마스터 전용 조회 경로를 신설한다(PRD §3 FR-2, architect §1.2). 기존 `/api/attendance/requests`의 크루 본인 스코프 계약을 건드리지 않아 회귀 표면이 0이다.

**결정② 서버 조인** — 라우트가 `listRequests()`(전체 최신순) ⨝ `listCrews()`(`Map<id,name>`)로 `crewName`(폴백 crewId)을 합성하여 `MasterRequestsResponse{requests: MasterRequestRow[]}`로 내려준다. 복잡도 O(R log R + C), 중첩 O(R·C) 회피.

## Consequences

- 마스터 화면(`/master` "수정요청 컨펌" 섹션)은 단일 fetch로 크루명 포함 목록을 받는다(클라 2-fetch 제거).
- 수락은 기존 `POST /api/attendance/requests/approve`를 그대로 재사용 → store 신규 함수 0, 마스터 게이트 이중 방어 유지.
- types에 `MasterRequestRow extends EditRequest { crewName }` / `MasterRequestsResponse`를 append(leaf, 회귀 0).
- 크루 본인 스코프(`GET /api/attendance/requests`)·폴백(김민정)·기존 186 테스트 불변.

## Alternatives Considered

- **기존 `/api/attendance/requests` 마스터 분기 재사용** → 채택 안 함: 크루/마스터 응답 형태(스코프·crewName 유무)가 갈려 단일 핸들러 분기 복잡도가 커지고, 검증된 크루 스코프 계약을 변경하면 회귀 위험이 커진다.
- **클라 `/api/crews` 별도 조인** → 채택 안 함: 요청 2회 + 클라에서 매핑 로직 보유. 인메모리 store가 서버에 있어 서버 조인 비용이 사실상 무료이며 1회 fetch로 단축된다(PRD R-4).
