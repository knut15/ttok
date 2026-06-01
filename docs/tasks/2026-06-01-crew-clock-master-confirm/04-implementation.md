# 🛠 구현 History (v1) — 크루 출근 격리 + 마스터 수정요청 컨펌 + 아이콘 버튼 통일

- **Task**: 2026-06-01-crew-clock-master-confirm / task-developer
- **기준**: 03-architecture.md §"developer 인계" 5개 충실 이행. append-only, 회귀 0.

## AC 충족 매핑

| AC | 충족 근거 |
|---|---|
| AC-1/AC-3 (격리 기록·전환 무효화) | `ClockToggle.tsx`: `useCurrentUser`+`authHeaders(user)`(GET·PATCH), effect dep `[date, crewId]`, `setRecord(null)` 동기 리셋 |
| AC-2 (타 크루 무노출) | 헤더 부착으로 본인 crewId GET → 타 크루 레코드 미반환(404→phase before) |
| AC-4 (서버 통합테스트) | `api/attendance/route.test.ts`: crew-2 PATCH→crew-2 GET 반영·crew-3/기본 GET 미반영 |
| AC-5 (전체 조회) | `api/master/requests/route.ts` `listRequests()` 전체 + route.test 2건 포함 검증 |
| AC-6 (크루명) | 서버 조인 `listCrews()` Map → `crewName`(폴백 crewId). route.test `crewName` 검증 |
| AC-7 (수락 반영) | `useMasterRequests.approve` → 기존 `POST .../approve` 재사용 → reloadKey reload. `MasterRequestList` 대기/수락 배지 |
| AC-8/AC-R3 (크루 403) | route 게이트(role≠master→403) + route.test 2건(crew/헤더부재). UI는 MasterView 마스터 가드 하위 |
| AC-9/AC-R2 (크루 본인 스코프 불변) | `GET /api/attendance/requests` 무변경, 기존 테스트 GREEN |
| AC-10/AC-12 (32×32 적용·누락0) | 12개 버튼 `grid h-8 w-8 place-items-center leading-none`. grep 카운트 2+2+2+2+3+1=12 |
| AC-11 (텍스트 버튼 불변) | 수락/급여명세서/MonthSelector/⤓/🔔 미변경 |
| AC-R1 (186 회귀0) | pnpm test 191 passed (186 기존 + 5 신규) |
| AC-R4 (김민정 폴백) | 서버 무변경, route.test 헤더부재 케이스 GREEN |
| AC-R5 (하이드레이션) | ClockToggle=HomeToday mount-gate 하위, MasterView=client 마스터 가드 하위 섹션 append |

## 작업 로그 (시간순, TDD)

- FR-1 RED: `route.test.ts`에 크루별 격리 통합테스트 추가 → 실행(서버가 이미 `enforceReadScope`로 격리 → 10 passed). 서버 contract 고정. 클라 버그(ClockToggle 헤더 누락)는 build/type/lint로 검증(vitest node UI 미지원).
- FR-1 GREEN: `ClockToggle.tsx` in-place — authHeaders GET/PATCH(PATCH는 Content-Type 병합), dep `[date,crewId]`+`setRecord(null)`(eslint-disable, useAttendance 패턴).
- FR-2 RED: `types/index.ts` append(`MasterRequestRow`/`MasterRequestsResponse`) → `master/requests/route.test.ts` 작성 → 실행 = route 부재로 import 실패(RED 확인).
- FR-2 GREEN: `master/requests/route.ts` 생성(게이트 복제 + listRequests⨝listCrews 서버 조인) → 4 passed.
- FR-2 UI: `useMasterRequests.ts`(GET+approve+reloadKey) + `MasterRequestList.tsx`(presentational) + `MasterView.tsx` 섹션 append. build/type/lint 검증.
- FR-3: 12개 클릭 버튼 STD className in-place 교체 → grep 누락0.
- REFACTOR: lint 위반 2건(set-state-in-effect) → 프로젝트 컨벤션(`eslint-disable-next-line react-hooks/set-state-in-effect` / useMasterSummary 패턴 동기 setLoading 제거)으로 정리. 전 테스트 GREEN 유지.
- Artifacts: CONTEXT.md 3건 추가, ADR 0006 작성.

## 자가 검증

- 빌드: ✅ (`/api/master/requests` 라우트 생성 확인)
- 타입체크: ✅ (`tsc --noEmit` exit 0)
- 단위/통합 테스트: ✅ 191/191 (기존 186 + 신규 5)
- Lint: ✅ (0 errors)
- TDD 사이클: 2 (FR-1 RED→GREEN, FR-2 RED→GREEN) + REFACTOR(lint 정리). UI는 node 미지원으로 build/type/lint+코드 일치.
- Horizontal slicing: ❌ (vertical slice만)

## 경계면 일치 확인

- store `listRequests():EditRequest[]` ↔ route `MasterRequestRow[]`(crewName 파생) ↔ hook `MasterRequestsResponse` ↔ `MasterRequestList` props. 타입 일치(tsc GREEN).
- approve: `useMasterRequests.approve` ↔ 기존 `POST /api/attendance/requests/approve` {id} 계약 동일.
- ClockToggle GET/PATCH URL·body 불변(헤더만 추가) → 서버 회귀 0.

## 산출물

| 종류 | 파일 |
|---|---|
| 수정 | `src/features/attendance/components/ClockToggle.tsx` (FR-1) |
| 수정 | `src/types/index.ts` (MasterRequestRow/MasterRequestsResponse append) |
| 신규 | `src/app/api/master/requests/route.ts` (+ route.test.ts) |
| 신규 | `src/features/accounts/hooks/useMasterRequests.ts` |
| 신규 | `src/features/accounts/components/MasterRequestList.tsx` |
| 수정 | `src/features/accounts/components/MasterView.tsx` (섹션 append + FR-3 2버튼) |
| 수정 (FR-3) | AttendanceCalendarView, PayView, MasterCrewDetail, AttendanceDetailNav, BackButton |
| 테스트 | `src/app/api/attendance/route.test.ts` (FR-1 격리 케이스 추가) |
| Artifacts | CONTEXT.md 용어 3건, `docs/adr/0006-master-edit-request-confirm.md` |
| 프로젝트 자원 활용 | `api/master/crews` 게이트 패턴 복제, `listRequests`/`listCrews`/`approveRequest` 재사용(store 신규함수 0), useAttendance/useMasterSummary 훅 패턴, eslint set-state-in-effect 컨벤션 |

## 미충족 AC

- 없음. 전 AC(AC-1~AC-12, AC-R1~AC-R5) 충족. 아이콘 적용 12개(§4 baseline 일치, Q-4=클릭버튼만 확정).
